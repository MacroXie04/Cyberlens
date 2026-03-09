import logging
from dataclasses import dataclass, replace

from django.db import connections

from scanner.models import GitHubScan

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ScanProfile:
    mode: str
    model_name_override: str | None
    chunk_line_window: int
    chunk_line_overlap: int
    summary_batch_size: int
    risk_passes: tuple[str, ...]
    max_candidates_per_pass: int
    max_total_candidates: int
    max_verification_candidates: int | None
    github_fetch_workers: int
    source_file_cap: int | None
    source_line_cap: int | None
    chunk_workers: int
    verification_workers: int


FAST_SCAN_PROFILE = ScanProfile(
    mode="fast",
    model_name_override="gemini-2.5-flash",
    chunk_line_window=220,
    chunk_line_overlap=10,
    summary_batch_size=25,
    risk_passes=("injection", "authz", "secrets", "file_io", "network_ssrf"),
    max_candidates_per_pass=8,
    max_total_candidates=30,
    max_verification_candidates=12,
    github_fetch_workers=8,
    source_file_cap=120,
    source_line_cap=25000,
    chunk_workers=1,
    verification_workers=1,
)


FULL_SCAN_PROFILE = ScanProfile(
    mode="full",
    model_name_override=None,
    chunk_line_window=120,
    chunk_line_overlap=20,
    summary_batch_size=25,
    risk_passes=("injection", "authz", "secrets", "file_io", "network_ssrf", "deserialization", "crypto"),
    max_candidates_per_pass=15,
    max_total_candidates=100,
    max_verification_candidates=None,
    github_fetch_workers=12,
    source_file_cap=None,
    source_line_cap=None,
    chunk_workers=4,
    verification_workers=4,
)


FAST_PATH_KEYWORDS = (
    "auth",
    "login",
    "session",
    "token",
    "secret",
    "key",
    "api",
    "route",
    "controller",
    "middleware",
    "admin",
    "upload",
    "db",
    "sql",
    "query",
    "serialize",
    "crypto",
)


FAST_EXCLUDED_PATH_KEYWORDS = (
    "test",
    "tests",
    "__tests__",
    "spec",
    "docs",
    "example",
    "examples",
    "fixtures",
    "generated",
    "vendor",
)


def get_scan_profile(scan_mode: str | None) -> ScanProfile:
    return FULL_SCAN_PROFILE if scan_mode == GitHubScan.Mode.FULL else FAST_SCAN_PROFILE


def get_runtime_scan_profile(profile: ScanProfile, *, database_vendor: str | None = None) -> ScanProfile:
    vendor = database_vendor or connections["default"].vendor
    if vendor != "sqlite" or (profile.chunk_workers <= 1 and profile.verification_workers <= 1):
        return profile
    logger.info("SQLite backend detected; forcing serial code scan execution for %s mode", profile.mode)
    return replace(profile, chunk_workers=1, verification_workers=1)
