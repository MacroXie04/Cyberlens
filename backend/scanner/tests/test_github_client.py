import pytest
import responses
from scanner.services.github_client import (
    validate_token,
    list_repos,
    get_file_content,
    get_dependency_files,
    get_source_files,
    GITHUB_API,
)


class TestValidateToken:
    @responses.activate
    def test_success(self):
        responses.get(
            f"{GITHUB_API}/user",
            json={"login": "testuser", "avatar_url": "https://img"},
            status=200,
        )
        result = validate_token("ghp_valid")
        assert result["login"] == "testuser"

    @responses.activate
    def test_invalid(self):
        responses.get(f"{GITHUB_API}/user", status=401)
        result = validate_token("ghp_bad")
        assert result is None

    @responses.activate
    def test_network_error(self):
        import requests as req_lib
        responses.get(f"{GITHUB_API}/user", body=req_lib.ConnectionError("timeout"))
        result = validate_token("ghp_any")
        assert result is None


class TestListRepos:
    @responses.activate
    def test_success(self):
        responses.get(
            f"{GITHUB_API}/user/repos",
            json=[{"full_name": "user/repo", "name": "repo", "private": False, "language": "Python", "updated_at": "2024-01-01"}],
            status=200,
        )
        result = list_repos("ghp_valid")
        assert len(result) == 1
        assert result[0]["full_name"] == "user/repo"

    @responses.activate
    def test_error(self):
        responses.get(f"{GITHUB_API}/user/repos", status=500)
        result = list_repos("ghp_valid")
        assert result == []


class TestGetFileContent:
    @responses.activate
    def test_success(self):
        responses.get(
            f"{GITHUB_API}/repos/owner/repo/contents/package.json",
            body='{"dependencies":{}}',
            status=200,
        )
        result = get_file_content("ghp_valid", "owner", "repo", "package.json")
        assert result == '{"dependencies":{}}'

    @responses.activate
    def test_not_found(self):
        responses.get(f"{GITHUB_API}/repos/owner/repo/contents/missing.txt", status=404)
        result = get_file_content("ghp_valid", "owner", "repo", "missing.txt")
        assert result is None


class TestGetSourceFiles:
    @responses.activate
    def test_filters_by_extension_and_size(self):
        responses.get(
            f"{GITHUB_API}/repos/owner/repo",
            json={"default_branch": "main"},
        )
        responses.get(
            f"{GITHUB_API}/repos/owner/repo/git/trees/main",
            json={
                "tree": [
                    {"type": "blob", "path": "app.py", "size": 100},
                    {"type": "blob", "path": "image.png", "size": 100},
                    {"type": "blob", "path": "big.js", "size": 60000},
                    {"type": "blob", "path": "empty.ts", "size": 0},
                    {"type": "blob", "path": "node_modules/pkg/index.js", "size": 50},
                ]
            },
        )
        # Only app.py should be fetched (correct extension, correct size, not in skip paths)
        responses.get(
            f"{GITHUB_API}/repos/owner/repo/contents/app.py",
            body="print('hello')",
            status=200,
        )
        result = get_source_files("ghp_valid", "owner/repo")
        assert "app.py" in result
        assert "image.png" not in result
        assert "big.js" not in result
        assert "empty.ts" not in result
