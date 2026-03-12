import json

from scanner.models import GitHubScan


def collect_vulnerability_data(scan: GitHubScan) -> list[dict]:
    vuln_data: list[dict] = []
    for dependency in scan.dependencies.filter(is_vulnerable=True):
        for vulnerability in dependency.vulnerabilities.all():
            vuln_data.append(
                {
                    "package": dependency.name,
                    "version": dependency.version,
                    "ecosystem": dependency.ecosystem,
                    "cve_id": vulnerability.cve_id,
                    "osv_id": vulnerability.osv_id,
                    "cvss_score": vulnerability.cvss_score,
                    "severity": vulnerability.severity,
                    "summary": vulnerability.summary,
                    "fixed_version": vulnerability.fixed_version,
                }
            )
    return vuln_data


def build_report_input(scan: GitHubScan, vuln_data: list[dict]) -> str:
    return json.dumps(
        {
            "repository": scan.repo_name,
            "total_dependencies": scan.total_deps,
            "vulnerable_dependencies": scan.vulnerable_deps,
            "vulnerabilities": vuln_data,
        }
    )
