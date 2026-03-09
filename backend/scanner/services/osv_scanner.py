import logging

from celery import shared_task
from django.utils import timezone

from monitor.services.redis_publisher import publish_scan_complete, publish_scan_progress
from scanner.models import Dependency, GitHubScan, Vulnerability

from .ai_reporter import generate_report
from .code_scanner import scan_code_security_github
from .dependency_parser import parse_dependencies
from .github_client import get_dependency_files
from .osv_scanner_support import classify_severity as _classify_severity
from .osv_scanner_support import mark_scan_failed, query_osv

logger = logging.getLogger(__name__)


def _run_scan_pipeline(scan_id, dep_files, dir_path="", pat="", repo_full_name="", user_id=None, scan_mode=GitHubScan.Mode.FAST):
    scan = GitHubScan.objects.get(id=scan_id)
    if not dep_files:
        publish_scan_progress({"scan_id": scan_id, "step": "parsing", "message": "No dependency files found. Continuing with code security scan..."})
        scan.total_deps = 0
        scan.vulnerable_deps = 0
        scan.save(update_fields=["total_deps", "vulnerable_deps"])
    else:
        publish_scan_progress({"scan_id": scan_id, "step": "parsing", "message": "Parsing dependencies..."})
        all_deps = [parsed for filename, content in dep_files.items() for parsed in parse_dependencies(filename, content)]
        unique_deps, seen = [], set()
        for dep in all_deps:
            key = (dep["name"], dep["ecosystem"])
            if key not in seen:
                seen.add(key)
                unique_deps.append(dep)
        dep_records = [Dependency.objects.create(scan=scan, name=dep["name"], version=dep.get("version", ""), ecosystem=dep["ecosystem"]) for dep in unique_deps]
        scan.total_deps = len(dep_records)
        scan.save(update_fields=["total_deps"])
        publish_scan_progress({"scan_id": scan_id, "step": "scanning", "message": "Querying vulnerability database..."})
        vulnerable_count = 0
        for dep_record, osv_result in zip(dep_records, query_osv(unique_deps) if unique_deps else []):
            vulns = osv_result.get("vulns", [])
            if not vulns:
                continue
            dep_record.is_vulnerable = True
            dep_record.save()
            vulnerable_count += 1
            for vuln in vulns:
                severity_items = vuln.get("database_specific", {}).get("severity", [])
                cvss = float(severity_items[0].get("score", 0)) if severity_items else 0.0
                fixed_version = ""
                for affected in vuln.get("affected", []):
                    for range_item in affected.get("ranges", []):
                        for event in range_item.get("events", []):
                            if "fixed" in event:
                                fixed_version = event["fixed"]
                Vulnerability.objects.create(
                    dependency=dep_record,
                    cve_id=next((alias for alias in vuln.get("aliases", []) if alias.startswith("CVE-")), ""),
                    cvss_score=cvss,
                    severity=_classify_severity(cvss),
                    summary=vuln.get("summary", ""),
                    fixed_version=fixed_version,
                    osv_id=vuln.get("id", ""),
                )
        scan.vulnerable_deps = vulnerable_count
        scan.save(update_fields=["vulnerable_deps"])

    publish_scan_progress({"scan_id": scan_id, "step": "analyzing", "message": "Generating AI risk assessment..."})
    generate_report(scan, user_id=user_id)
    if dir_path:
        from .code_scanner import scan_code_security

        publish_scan_progress({"scan_id": scan_id, "step": "code_scan", "message": "Scanning source code for security issues..."})
        scan_code_security(scan_id, dir_path, user_id=user_id)
    elif pat and repo_full_name:
        publish_scan_progress({"scan_id": scan_id, "step": "code_scan", "message": "Scanning source code for security issues..."})
        scan_code_security_github(scan_id, pat, repo_full_name, user_id=user_id)

    from .score_calculator import calculate_code_security_score, calculate_composite_score

    scan.refresh_from_db()
    findings = list(scan.code_findings.values("severity"))
    code_score = calculate_code_security_score(findings) if findings else 100
    scan.code_security_score = code_score
    scan.security_score = calculate_composite_score(scan.dependency_score, code_score)
    scan.scan_status = "completed"
    scan.completed_at = timezone.now()
    scan.error_message = ""
    scan.save(update_fields=["code_security_score", "security_score", "scan_status", "completed_at", "error_message"])
    publish_scan_complete({"scan_id": scan_id, "status": "completed", "message": "Scan complete"})


@shared_task
def run_full_scan(scan_id, pat, repo_full_name, user_id=None, scan_mode=GitHubScan.Mode.FAST):
    try:
        publish_scan_progress({"scan_id": scan_id, "step": "fetching", "message": "Fetching dependency files from GitHub..."})
        _run_scan_pipeline(scan_id, get_dependency_files(pat, repo_full_name), pat=pat, repo_full_name=repo_full_name, user_id=user_id, scan_mode=scan_mode)
    except Exception as exc:
        logger.exception("Full scan failed for %s", repo_full_name)
        mark_scan_failed(scan_id, str(exc))


@shared_task
def run_local_scan(scan_id, dir_path, user_id=None, scan_mode=GitHubScan.Mode.FAST):
    from .local_client import get_local_dependency_files

    try:
        publish_scan_progress({"scan_id": scan_id, "step": "fetching", "message": "Reading local dependency files..."})
        _run_scan_pipeline(scan_id, get_local_dependency_files(dir_path), dir_path=dir_path, user_id=user_id, scan_mode=scan_mode)
    except Exception as exc:
        logger.exception("Local scan failed for %s", dir_path)
        mark_scan_failed(scan_id, str(exc))
