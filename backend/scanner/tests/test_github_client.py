from unittest.mock import patch

from scanner.services.github_client import get_source_files


class TestGitHubSourceFiles:
    @patch(
        "scanner.services.github_client._fetch_repo_files",
        return_value={"AppDelegate.swift": "import SwiftUI"},
    )
    @patch(
        "scanner.services.github_client._get_repo_tree",
        return_value=[
            {"type": "blob", "path": "AppDelegate.swift", "size": 1200},
            {"type": "blob", "path": "README.md", "size": 100},
        ],
    )
    def test_includes_swift_sources(self, mock_tree, mock_fetch):
        files = get_source_files("ghp_token", "owner/repo")

        assert files == {"AppDelegate.swift": "import SwiftUI"}
        mock_fetch.assert_called_once_with("ghp_token", "owner", "repo", ["AppDelegate.swift"])
