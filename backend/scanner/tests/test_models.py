import pytest
from scanner.models import GitHubScan, Dependency, Vulnerability, AiReport, CodeFinding


@pytest.mark.django_db
class TestGitHubScan:
    def test_str(self, scan_factory):
        scan = scan_factory(repo_name="owner/repo", scan_status="completed")
        assert str(scan) == "owner/repo (completed)"

    def test_default_values(self, scan_factory):
        scan = scan_factory()
        assert scan.total_deps == 0
        assert scan.vulnerable_deps == 0
        assert scan.security_score == 100
        assert scan.scan_source == "github"

    def test_ordering(self, scan_factory):
        s1 = scan_factory(repo_name="first")
        s2 = scan_factory(repo_name="second")
        scans = list(GitHubScan.objects.all())
        assert scans[0].id == s2.id  # newest first


@pytest.mark.django_db
class TestDependency:
    def test_str(self, scan_factory, dependency_factory):
        scan = scan_factory()
        dep = dependency_factory(scan, name="lodash", version="4.17.21")
        assert str(dep) == "lodash@4.17.21"


@pytest.mark.django_db
class TestVulnerability:
    def test_str_with_cve(self, scan_factory, dependency_factory, vulnerability_factory):
        scan = scan_factory()
        dep = dependency_factory(scan)
        vuln = vulnerability_factory(dep, cve_id="CVE-2021-99999", severity="critical")
        assert str(vuln) == "CVE-2021-99999 (critical)"

    def test_str_with_osv_id(self, scan_factory, dependency_factory, vulnerability_factory):
        scan = scan_factory()
        dep = dependency_factory(scan)
        vuln = vulnerability_factory(dep, cve_id="", osv_id="GHSA-abc", severity="high")
        assert str(vuln) == "GHSA-abc (high)"


@pytest.mark.django_db
class TestAiReport:
    def test_str(self, scan_factory, ai_report_factory):
        scan = scan_factory(repo_name="owner/my-repo")
        report = ai_report_factory(scan)
        assert str(report) == "Report for owner/my-repo"


@pytest.mark.django_db
class TestCodeFinding:
    def test_str(self, scan_factory, code_finding_factory):
        scan = scan_factory()
        finding = code_finding_factory(scan, severity="high", title="SQL Injection", file_path="app.py", line_number=42)
        assert str(finding) == "high: SQL Injection (app.py:42)"


@pytest.mark.django_db
class TestCascadeDeletes:
    def test_scan_deletes_deps_and_vulns(self, scan_factory, dependency_factory, vulnerability_factory):
        scan = scan_factory()
        dep = dependency_factory(scan)
        vulnerability_factory(dep)
        scan.delete()
        assert Dependency.objects.count() == 0
        assert Vulnerability.objects.count() == 0

    def test_scan_deletes_report(self, scan_factory, ai_report_factory):
        scan = scan_factory()
        ai_report_factory(scan)
        scan.delete()
        assert AiReport.objects.count() == 0

    def test_scan_deletes_findings(self, scan_factory, code_finding_factory):
        scan = scan_factory()
        code_finding_factory(scan)
        scan.delete()
        assert CodeFinding.objects.count() == 0
