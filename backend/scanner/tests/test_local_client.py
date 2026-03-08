import pytest
from pathlib import Path
from scanner.services.local_client import (
    validate_local_path,
    list_local_projects,
    get_local_dependency_files,
    get_source_files,
)


class TestValidateLocalPath:
    def test_valid_subdir(self, scan_root):
        subdir = scan_root / "myproject"
        subdir.mkdir()
        result = validate_local_path("myproject")
        assert result == subdir

    def test_traversal_raises(self, scan_root):
        with pytest.raises(ValueError, match="Path traversal"):
            validate_local_path("../../etc/passwd")

    def test_absolute_path_outside_root(self, scan_root):
        with pytest.raises(ValueError, match="Path traversal"):
            validate_local_path("/etc/passwd")

    def test_nonexistent_dir_raises(self, scan_root):
        with pytest.raises(FileNotFoundError, match="Directory not found"):
            validate_local_path("nonexistent")


class TestListLocalProjects:
    def test_empty_dir(self, scan_root):
        result = list_local_projects()
        assert result == []

    def test_subdirs_with_manifests(self, scan_root):
        proj = scan_root / "myproject"
        proj.mkdir()
        (proj / "package.json").write_text("{}")
        result = list_local_projects()
        assert len(result) == 1
        assert result[0]["name"] == "myproject"
        assert result[0]["has_manifest"] is True

    def test_subdirs_without_manifests(self, scan_root):
        proj = scan_root / "empty-project"
        proj.mkdir()
        result = list_local_projects()
        assert len(result) == 1
        assert result[0]["has_manifest"] is False

    def test_skips_git_and_node_modules(self, scan_root):
        (scan_root / ".git").mkdir()
        (scan_root / "node_modules").mkdir()
        (scan_root / "real-project").mkdir()
        result = list_local_projects()
        names = [p["name"] for p in result]
        assert ".git" not in names
        assert "node_modules" not in names
        assert "real-project" in names

    def test_root_level_manifest(self, scan_root):
        (scan_root / "package.json").write_text("{}")
        result = list_local_projects()
        assert any(p["name"] == "." for p in result)

    def test_traversal_returns_empty(self, scan_root):
        result = list_local_projects("../../etc")
        assert result == []


class TestGetLocalDependencyFiles:
    def test_reads_existing_manifests(self, scan_root):
        proj = scan_root / "myproject"
        proj.mkdir()
        (proj / "requirements.txt").write_text("django==5.0\n")
        (proj / "package.json").write_text('{"dependencies":{}}')
        result = get_local_dependency_files("myproject")
        assert "requirements.txt" in result
        assert "package.json" in result
        assert result["requirements.txt"] == "django==5.0\n"

    def test_skips_missing_manifests(self, scan_root):
        proj = scan_root / "myproject"
        proj.mkdir()
        (proj / "requirements.txt").write_text("django==5.0\n")
        result = get_local_dependency_files("myproject")
        assert "package.json" not in result
        assert "requirements.txt" in result

    def test_reads_nested_manifests_recursively(self, scan_root):
        proj = scan_root / "myproject"
        nested = proj / "pages"
        nested.mkdir(parents=True)
        (nested / "package.json").write_text('{"dependencies":{"react":"^18.0.0"}}')

        result = get_local_dependency_files("myproject")

        assert "pages/package.json" in result

    def test_traversal_raises(self, scan_root):
        with pytest.raises(ValueError, match="Path traversal"):
            get_local_dependency_files("../../etc")


class TestGetSourceFiles:
    def test_collects_source_extensions(self, scan_root):
        proj = scan_root / "myproject"
        proj.mkdir()
        (proj / "app.py").write_text("print('hello')")
        (proj / "index.js").write_text("console.log('hi')")
        (proj / "main.ts").write_text("const x = 1")
        result = get_source_files("myproject")
        assert "app.py" in result
        assert "index.js" in result
        assert "main.ts" in result

    def test_skips_large_files(self, scan_root):
        proj = scan_root / "myproject"
        proj.mkdir()
        (proj / "big.py").write_text("x" * (51 * 1024))
        result = get_source_files("myproject")
        assert "big.py" not in result

    def test_skips_empty_files(self, scan_root):
        proj = scan_root / "myproject"
        proj.mkdir()
        (proj / "empty.py").write_text("")
        result = get_source_files("myproject")
        assert "empty.py" not in result

    def test_skips_node_modules_and_pycache(self, scan_root):
        proj = scan_root / "myproject"
        proj.mkdir()
        nm = proj / "node_modules" / "pkg"
        nm.mkdir(parents=True)
        (nm / "index.js").write_text("module.exports = {}")
        pc = proj / "__pycache__"
        pc.mkdir()
        (pc / "mod.py").write_text("cached")
        (proj / "app.py").write_text("real code")
        result = get_source_files("myproject")
        assert "app.py" in result
        assert not any("node_modules" in k for k in result)
        assert not any("__pycache__" in k for k in result)

    def test_skips_non_source_extensions(self, scan_root):
        proj = scan_root / "myproject"
        proj.mkdir()
        (proj / "image.png").write_bytes(b"\x89PNG")
        (proj / "doc.pdf").write_bytes(b"%PDF")
        (proj / "app.py").write_text("code")
        result = get_source_files("myproject")
        assert "image.png" not in result
        assert "doc.pdf" not in result
        assert "app.py" in result
