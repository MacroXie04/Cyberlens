from django.utils import timezone

from scanner.models import AiReport, GitHubScan

from ...adk_trace import record_phase_metric, record_trace_event


def reset_dependency_report_state(scan: GitHubScan) -> None:
    scan.adk_trace_events.filter(
        phase__in=["dependency_input", "dependency_adk_report"]
    ).delete()
    AiReport.objects.filter(scan=scan).delete()


def record_dependency_input_stage(scan: GitHubScan, vuln_data: list[dict]) -> None:
    started_at = timezone.now()
    payload = {
        "repository": scan.repo_name,
        "total_dependencies": scan.total_deps,
        "vulnerable_dependencies": scan.vulnerable_deps,
        "vulnerability_count": len(vuln_data),
    }
    record_trace_event(
        scan,
        phase="dependency_input",
        kind="stage_started",
        status="running",
        label="Build dependency risk input",
        started_at=started_at,
    )
    record_trace_event(
        scan,
        phase="dependency_input",
        kind="artifact_created",
        status="success",
        label="Dependency vulnerability batch",
        payload_json={**payload, "batch_index": 1, "batch_size": len(vuln_data)},
    )
    record_phase_metric(
        scan,
        phase="dependency_input",
        label="Dependency input metrics",
        status="success",
        update_scan_stats=False,
        payload_json=payload,
    )
    record_trace_event(
        scan,
        phase="dependency_input",
        kind="stage_completed",
        status="success",
        label="Built dependency risk input",
        payload_json=payload,
        duration_ms=int((timezone.now() - started_at).total_seconds() * 1000),
        started_at=started_at,
        ended_at=timezone.now(),
    )
