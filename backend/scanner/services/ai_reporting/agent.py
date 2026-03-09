import time

from google.genai import types

from .schemas import build_report_agent


def coerce_token_count(value) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def run_report_agent(
    *,
    runner_cls,
    model_builder,
    scan,
    input_data: str,
    model_name: str,
    api_key: str,
) -> tuple[str, dict[str, int], int]:
    agent = build_report_agent(model_builder(model_name, api_key))
    runner = runner_cls(agent=agent, app_name="cyberlens_report")
    runner.auto_create_session = True
    response_text = ""
    metrics = {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}
    start_time = time.time()

    for event in runner.run(
        user_id="system",
        session_id=f"scan-{scan.id}",
        new_message=types.UserContent(parts=[types.Part(text=input_data)]),
    ):
        if event.is_final_response() and event.content:
            for part in getattr(event.content, "parts", None) or []:
                if part.text:
                    response_text += part.text
        if getattr(event, "usage_metadata", None):
            meta = event.usage_metadata
            metrics["input_tokens"] = coerce_token_count(
                getattr(meta, "prompt_token_count", 0)
            )
            metrics["output_tokens"] = coerce_token_count(
                getattr(meta, "candidates_token_count", 0)
            )
            metrics["total_tokens"] = coerce_token_count(
                getattr(meta, "total_token_count", 0)
            )

    duration_ms = int((time.time() - start_time) * 1000)
    return response_text, metrics, duration_ms
