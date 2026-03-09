from datetime import timedelta

_CLUSTER_WINDOW = timedelta(minutes=10)
_MERGE_WINDOW = timedelta(minutes=5)

THRESHOLDS = {
    "armor_block_spike": 5,
    "auth_failure_burst": 10,
    "error_surge": 10,
    "sqli_xss_traversal": 2,
    "bot_probing": 5,
    "iam_drift": 1,
    "latency_surge": 1,
    "revision_regression": 1,
    "cold_start_surge": 1,
}

_CATEGORY_TO_INCIDENT = {
    "sql_injection": "attack_sqli_xss_traversal",
    "xss": "attack_sqli_xss_traversal",
    "path_traversal": "attack_sqli_xss_traversal",
    "bot_probing": "bot_probing_campaign",
    "credential_abuse": "credential_abuse_burst",
    "armor_block": "armor_block_spike",
    "iap_auth_failure": "auth_failure_burst",
    "iam_drift": "iam_permission_drift",
    "error_surge": "error_surge",
    "latency_surge": "latency_surge",
    "revision_regression": "revision_regression",
    "cold_start_surge": "cold_start_surge",
    "rate_limit": "rate_limit_spike",
}

_INCIDENT_PRIORITY = {
    "attack_sqli_xss_traversal": "p1",
    "credential_abuse_burst": "p1",
    "armor_block_spike": "p2",
    "auth_failure_burst": "p2",
    "iam_permission_drift": "p2",
    "error_surge": "p2",
    "bot_probing_campaign": "p3",
    "latency_surge": "p3",
    "revision_regression": "p3",
    "cold_start_surge": "p4",
    "rate_limit_spike": "p3",
}

_INCIDENT_TITLES = {
    "attack_sqli_xss_traversal": "Web Attack Detected (SQLi/XSS/Traversal)",
    "credential_abuse_burst": "Credential Abuse Burst",
    "armor_block_spike": "Cloud Armor Block Spike",
    "auth_failure_burst": "Authentication Failure Burst",
    "iam_permission_drift": "IAM Permission Change Detected",
    "error_surge": "5xx Error Surge",
    "bot_probing_campaign": "Bot/Scanner Probing Campaign",
    "latency_surge": "Latency Surge Detected",
    "revision_regression": "Revision Regression Detected",
    "cold_start_surge": "Cold Start Surge",
    "rate_limit_spike": "Rate Limiting Spike",
}
