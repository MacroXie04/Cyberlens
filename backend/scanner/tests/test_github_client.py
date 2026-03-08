from unittest.mock import patch

import pytest

from scanner.services.github_client import GitHubRepositoryFetchError, _get_repo_tree, get_source_files


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
        mock_fetch.assert_called_once_with("ghp_token", "owner", "repo", ["AppDelegate.swift"], max_workers=None)

    @patch("scanner.services.github_client.requests.get")
    def test_repo_tree_error_raises(self, mock_get):
        import requests

        mock_get.side_effect = requests.RequestException("boom")

        with pytest.raises(GitHubRepositoryFetchError, match="Failed to fetch repo tree"):
            _get_repo_tree("ghp_token", "owner/repo")
