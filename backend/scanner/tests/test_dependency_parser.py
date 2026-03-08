import json
import pytest
from scanner.services.dependency_parser import (
    parse_dependencies,
    _parse_package_json,
    _parse_package_lock,
    _parse_requirements_txt,
    _parse_pyproject_toml,
    _parse_go_mod,
    _parse_gemfile,
)


class TestParsePackageJson:
    def test_basic_deps(self):
        content = json.dumps({
            "dependencies": {"react": "^18.2.0", "axios": "~1.6.0"},
            "devDependencies": {"jest": ">=29.0.0"},
        })
        result = _parse_package_json(content)
        assert len(result) == 3
        assert result[0] == {"name": "react", "version": "18.2.0", "ecosystem": "npm"}
        assert result[1] == {"name": "axios", "version": "1.6.0", "ecosystem": "npm"}
        assert result[2] == {"name": "jest", "version": "29.0.0", "ecosystem": "npm"}

    def test_semver_prefix_stripping(self):
        content = json.dumps({"dependencies": {"a": "^1.0.0", "b": "~2.0.0", "c": ">=3.0.0"}})
        result = _parse_package_json(content)
        assert result[0]["version"] == "1.0.0"
        assert result[1]["version"] == "2.0.0"
        assert result[2]["version"] == "3.0.0"

    def test_empty_sections(self):
        content = json.dumps({"name": "test-pkg"})
        result = _parse_package_json(content)
        assert result == []

    def test_missing_sections(self):
        content = json.dumps({"dependencies": {}})
        result = _parse_package_json(content)
        assert result == []


class TestParsePackageLock:
    def test_v2_format(self):
        content = json.dumps({
            "packages": {
                "": {"name": "root-pkg", "version": "1.0.0"},
                "node_modules/lodash": {"version": "4.17.21"},
                "node_modules/express": {"version": "4.18.2"},
            }
        })
        result = _parse_package_lock(content)
        assert len(result) == 2
        assert result[0] == {"name": "lodash", "version": "4.17.21", "ecosystem": "npm"}
        assert result[1] == {"name": "express", "version": "4.18.2", "ecosystem": "npm"}

    def test_v1_fallback(self):
        content = json.dumps({
            "dependencies": {
                "lodash": {"version": "4.17.21"},
            }
        })
        result = _parse_package_lock(content)
        assert len(result) == 1
        assert result[0]["name"] == "lodash"

    def test_skips_root_entry(self):
        content = json.dumps({
            "packages": {
                "": {"name": "root", "version": "1.0.0"},
                "node_modules/foo": {"version": "2.0.0"},
            }
        })
        result = _parse_package_lock(content)
        assert len(result) == 1
        assert result[0]["name"] == "foo"


class TestParseRequirementsTxt:
    def test_pinned_versions(self):
        content = "django==5.1.0\nrequests==2.31.0\n"
        result = _parse_requirements_txt(content)
        assert len(result) == 2
        assert result[0] == {"name": "django", "version": "5.1.0", "ecosystem": "PyPI"}

    def test_unpinned(self):
        content = "django\nrequests\n"
        result = _parse_requirements_txt(content)
        assert len(result) == 2
        assert result[0]["version"] == ""

    def test_comments_and_flags_skipped(self):
        content = "# This is a comment\n-r base.txt\n--index-url https://pypi.org\ndjango==5.0\n"
        result = _parse_requirements_txt(content)
        assert len(result) == 1
        assert result[0]["name"] == "django"

    def test_tilde_equals_operator(self):
        content = "django~=5.0\n"
        result = _parse_requirements_txt(content)
        assert len(result) == 1
        assert result[0]["name"] == "django"
        assert result[0]["version"] == "5.0"


class TestParsePyprojectToml:
    def test_basic_dependencies(self):
        content = """
[project]
name = "myapp"
dependencies = [
    "django>=5.0",
    "requests~=2.31",
]
"""
        result = _parse_pyproject_toml(content)
        assert len(result) == 2
        assert result[0]["name"] == "django"
        assert result[0]["ecosystem"] == "PyPI"
        assert result[1]["name"] == "requests"

    def test_no_deps_section(self):
        content = """
[project]
name = "myapp"
version = "1.0"
"""
        result = _parse_pyproject_toml(content)
        assert result == []


class TestParseGoMod:
    def test_require_block(self):
        content = """module example.com/myapp

go 1.21

require (
\tgithub.com/gin-gonic/gin v1.9.1
\tgithub.com/lib/pq v1.10.9
)
"""
        result = _parse_go_mod(content)
        assert len(result) == 2
        assert result[0] == {"name": "github.com/gin-gonic/gin", "version": "1.9.1", "ecosystem": "Go"}
        assert result[1]["version"] == "1.10.9"

    def test_strips_v_prefix(self):
        content = "require (\n\texample.com/foo v2.0.0\n)\n"
        result = _parse_go_mod(content)
        assert result[0]["version"] == "2.0.0"


class TestParseGemfile:
    def test_gem_with_version(self):
        content = "gem 'rails', '~> 7.0'\n"
        result = _parse_gemfile(content)
        assert len(result) == 1
        assert result[0]["name"] == "rails"
        assert result[0]["version"] == "7.0"
        assert result[0]["ecosystem"] == "RubyGems"

    def test_gem_without_version(self):
        content = "gem 'puma'\n"
        result = _parse_gemfile(content)
        assert len(result) == 1
        assert result[0]["name"] == "puma"
        assert result[0]["version"] == ""


class TestParseDispatch:
    def test_dispatches_to_correct_parser(self):
        content = json.dumps({"dependencies": {"react": "^18.0.0"}})
        result = parse_dependencies("package.json", content)
        assert len(result) == 1
        assert result[0]["ecosystem"] == "npm"

    def test_dispatches_nested_manifest_paths(self):
        content = json.dumps({"dependencies": {"react": "^18.0.0"}})
        result = parse_dependencies("pages/package.json", content)
        assert len(result) == 1
        assert result[0]["name"] == "react"

    def test_unknown_file_returns_empty(self):
        result = parse_dependencies("Cargo.toml", "some content")
        assert result == []

    def test_malformed_content_returns_empty(self):
        result = parse_dependencies("package.json", "not valid json{{{")
        assert result == []
