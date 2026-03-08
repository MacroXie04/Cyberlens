import logging
import requests
from scanner.models import GitHubScan, Dependency, Vulnerability
from .github_client import get_dependency_files
from .local_client import get_local_dependency_files
from .dependency_parser import parse_dependencies
from .ai_reporter import generate_report
from .code_scanner import scan_code_security, scan_code_security_github
from monitor.services.redis_publisher import publish_scan_progress, publish_scan_complete
from celery import shared_task

logger = logging.getLogger(__name__)

OSV_API = "https://api.osv.dev/v1/querybatch"


def _classify_severity(cvss: float) -> str:
    if cvss >= 9.0:
        return "critical"
    elif cvss >= 7.0:
        return "high"
    elif cvss >= 4.0:
        return "medium"
    elif cvss > 0:
        return "low"
    return ""


def query_osv(deps: list[dict]) -> list[dict]:
    """Query OSV API for vulnerabilities in the given dependencies."""
    queries = []
    for dep in deps:
        q = {"package": {"name": dep["name"], "ecosystem": dep["ecosystem"]}}
        if dep.get("version"):
            q["version"] = dep["version"]
        queries.append(q)

    try:
        resp = requests.post(OSV_API, json={"queries": queries}, timeout=30)
        resp.raise_for_status()
        return resp.json().get("results", [])
    except requests.RequestException:
        logger.exception("OSV API query failed")
        return []


def _run_scan_pipeline(scan_id: int, dep_files: dict[str, str], dir_path: str = "", pat: str = "", repo_full_name: str = ""):
    """Shared scan pipeline: parse → OSV → AI report → code scan."""
    scan = GitHubScan.objects.get(id=scan_id)

    if not dep_files:
        scan.scan_status = "completed"
        scan.save()
        publish_scan_complete({"scan_id": scan_id, "status": "completed", "message": "No dependency files found"})
        return

    # Step 2: Parse dependencies
    publish_scan_progress({"scan_id": scan_id, "step": "parsing", "message": "Parsing dependencies..."})
    all_deps = []
    for filename, content in dep_files.items():
        parsed = parse_dependencies(filename, content)
        all_deps.extend(parsed)

    # Deduplicate by name+ecosystem
    seen = set()
    unique_deps = []
    for dep in all_deps:
        key = (dep["name"], dep["ecosystem"])
        if key not in seen:
            seen.add(key)
            unique_deps.append(dep)

    # Create Dependency records
    dep_records = []
    for dep in unique_deps:
        record = Dependency.objects.create(
            scan=scan,
            name=dep["name"],
            version=dep.get("version", ""),
            ecosystem=dep["ecosystem"],
        )
        dep_records.append(record)

    scan.total_deps = len(dep_records)
    scan.save()

    # Step 3: Query OSV
    publish_scan_progress({"scan_id": scan_id, "step": "scanning", "message": "Querying vulnerability database..."})
    osv_results = query_osv(unique_deps)

    vulnerable_count = 0
    for dep_record, dep_data, osv_result in zip(dep_records, unique_deps, osv_results):
        vulns = osv_result.get("vulns", [])
        if vulns:
            dep_record.is_vulnerable = True
            dep_record.save()
            vulnerable_count += 1

            for vuln in vulns:
                cvss = 0.0
                severity_items = vuln.get("database_specific", {}).get("severity", [])
                if severity_items:
                    cvss = float(severity_items[0].get("score", 0))

                # Try to find fixed version
                fixed_version = ""
                for affected in vuln.get("affected", []):
                    for r in affected.get("ranges", []):
                        for event in r.get("events", []):
                            if "fixed" in event:
                                fixed_version = event["fixed"]

                Vulnerability.objects.create(
                    dependency=dep_record,
                    cve_id=next((a for a in vuln.get("aliases", []) if a.startswith("CVE-")), ""),
                    cvss_score=cvss,
                    severity=_classify_severity(cvss),
                    summary=vuln.get("summary", ""),
                    fixed_version=fixed_version,
                    osv_id=vuln.get("id", ""),
                )

    scan.vulnerable_deps = vulnerable_count
    scan.save()

    # Step 4: AI report
    publish_scan_progress({"scan_id": scan_id, "step": "analyzing", "message": "Generating AI risk assessment..."})
    generate_report(scan)

    # Step 5: Code security scan
    if dir_path:
        publish_scan_progress({"scan_id": scan_id, "step": "code_scan", "message": "Scanning source code for security issues..."})
        scan_code_security(scan_id, dir_path)
    elif pat and repo_full_name:
        publish_scan_progress({"scan_id": scan_id, "step": "code_scan", "message": "Scanning source code for security issues..."})
        scan_code_security_github(scan_id, pat, repo_full_name)

    scan.scan_status = "completed"
    scan.save()

    publish_scan_complete({"scan_id": scan_id, "status": "completed", "message": "Scan complete"})


@shared_task
def run_full_scan(scan_id: int, pat: str, repo_full_name: str):
    """GitHub scan entry point."""
    try:
        publish_scan_progress({"scan_id": scan_id, "step": "fetching", "message": "Fetching dependency files from GitHub..."})
        dep_files = get_dependency_files(pat, repo_full_name)
        _run_scan_pipeline(scan_id, dep_files, pat=pat, repo_full_name=repo_full_name)

    except Exception:
        logger.exception("Full scan failed for %s", repo_full_name)
        try:
            scan = GitHubScan.objects.get(id=scan_id)
            scan.scan_status = "failed"
            scan.save()
        except GitHubScan.DoesNotExist:
            pass
        publish_scan_complete({"scan_id": scan_id, "status": "failed", "message": "Scan failed"})


@shared_task
def run_local_scan(scan_id: int, dir_path: str):
    """Local directory scan entry point."""
    try:
        publish_scan_progress({"scan_id": scan_id, "step": "fetching", "message": "Reading local dependency files..."})
        dep_files = get_local_dependency_files(dir_path)
        _run_scan_pipeline(scan_id, dep_files, dir_path=dir_path)

    except Exception:
        logger.exception("Local scan failed for %s", dir_path)
        try:
            scan = GitHubScan.objects.get(id=scan_id)
            scan.scan_status = "failed"
            scan.save()
        except GitHubScan.DoesNotExist:
            pass
        publish_scan_complete({"scan_id": scan_id, "status": "failed", "message": "Local scan failed"})
