"""Deterministic security score calculators."""

SEVERITY_PENALTIES = {
    "critical": 25,
    "high": 15,
    "medium": 8,
    "low": 3,
    "info": 1,
}


def calculate_code_security_score(findings: list[dict]) -> int:
    """Penalty-based score from code findings. Returns 0-100."""
    total_penalty = sum(
        SEVERITY_PENALTIES.get(f.get("severity", "").lower(), 0) for f in findings
    )
    return max(0, 100 - total_penalty)


def calculate_composite_score(dep_score: int, code_score: int) -> int:
    """Weighted-minimum composite: worst dimension dominates."""
    weighted = min(dep_score, code_score) * 0.7 + (dep_score + code_score) / 2 * 0.3
    return max(0, min(100, round(weighted)))
