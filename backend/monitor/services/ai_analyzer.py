import json
import logging
import os
from pydantic import BaseModel, Field
from google.adk import Agent
from google.adk.runners import InMemoryRunner
from google.genai import types
from django.conf import settings
from monitor.models import HttpRequest, AnalysisResult, Alert
from monitor.serializers import HttpRequestSerializer, AlertSerializer
from . import redis_publisher
from celery import shared_task

logger = logging.getLogger(__name__)

SYSTEM_INSTRUCTION = """You are a network security analyst expert. Analyze the provided HTTP request logs
and identify potential security threats.

For each request in the input array, provide a corresponding analysis entry.
Evaluate patterns like SQL injection signatures, XSS payloads, path traversal attempts,
brute force indicators (high frequency from same IP), and bot/scraper user agents."""


class ThreatAnalysis(BaseModel):
    request_id: int = Field(description="The ID of the request being analyzed")
    threat_level: str = Field(description="One of: safe, suspicious, malicious")
    threat_type: str = Field(
        description="One of: none, sql_injection, xss, path_traversal, brute_force, bot_scraping, ddos, unknown"
    )
    confidence: float = Field(description="Confidence score from 0.0 to 1.0", ge=0.0, le=1.0)
    reason: str = Field(description="Brief analysis of why this classification was made")
    recommendation: str = Field(description="Suggested response action")


class BatchAnalysisResult(BaseModel):
    analyses: list[ThreatAnalysis] = Field(
        description="One analysis entry per input request, in the same order"
    )


# Create the threat analysis agent
threat_agent = Agent(
    name="threat_analyzer",
    model="gemini-2.5-flash",
    instruction=SYSTEM_INSTRUCTION,
    output_schema=BatchAnalysisResult,
    generate_content_config=types.GenerateContentConfig(
        temperature=0.2,
    ),
)


@shared_task
def analyze_batch(request_ids: list[int]):
    """Analyze a batch of HTTP requests using Google ADK with Gemini."""
    if not settings.GOOGLE_API_KEY:
        logger.warning("GOOGLE_API_KEY not set, skipping AI analysis")
        return

    os.environ.setdefault("GOOGLE_API_KEY", settings.GOOGLE_API_KEY)

    http_requests = HttpRequest.objects.filter(id__in=request_ids)
    if not http_requests:
        return

    # Format requests for analysis
    batch_data = []
    for req in http_requests:
        batch_data.append(
            {
                "id": req.id,
                "ip": req.ip,
                "method": req.method,
                "path": req.path,
                "ua": req.user_agent,
                "status": req.status,
                "time": req.timestamp.isoformat(),
            }
        )

    try:
        runner = InMemoryRunner(agent=threat_agent, app_name="cyberlens_threat")

        response_text = ""
        for event in runner.run(
            user_id="system",
            session_id=f"batch-{request_ids[0]}",
            new_message=types.UserContent(
                parts=[types.Part(text=json.dumps(batch_data))]
            ),
        ):
            if event.is_final_response() and event.content:
                for part in event.content.parts:
                    if part.text:
                        response_text += part.text

        from cyberlens.utils import clean_json_response
        parsed = BatchAnalysisResult.model_validate_json(clean_json_response(response_text))
        results = parsed.analyses
        results_by_id = {r.request_id: r for r in results}

        for req_data in batch_data:
            result = results_by_id.get(req_data["id"])
            if not result:
                continue
            req = http_requests.get(id=req_data["id"])
            analysis = AnalysisResult.objects.create(
                request=req,
                threat_level=result.threat_level,
                threat_type=result.threat_type,
                confidence=result.confidence,
                reason=result.reason,
                recommendation=result.recommendation,
            )

            # Publish analyzed request via Redis
            serialized = HttpRequestSerializer(req).data
            redis_publisher.publish_request(serialized)

            # Create alert for malicious threats
            if analysis.threat_level == "malicious":
                alert = Alert.objects.create(
                    request=req,
                    severity="critical",
                    message=f"{analysis.threat_type}: {analysis.reason}",
                )
                redis_publisher.publish_alert(AlertSerializer(alert).data)

        # Publish updated stats
        total = HttpRequest.objects.count()
        analyzed = AnalysisResult.objects.count()
        threats = AnalysisResult.objects.exclude(threat_level="safe").count()
        malicious = AnalysisResult.objects.filter(threat_level="malicious").count()
        redis_publisher.publish_stats(
            {
                "total_requests": total,
                "ai_analyzed": analyzed,
                "threats_detected": threats,
                "malicious_count": malicious,
            }
        )

    except Exception:
        logger.exception("AI analysis failed")
