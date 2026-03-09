from django.urls import reverse_lazy

UNFOLD = {
    "SITE_TITLE": "CyberLens",
    "SITE_HEADER": "CyberLens",
    "SITE_SUBHEADER": "Security Dashboard",
    "SITE_SYMBOL": "security",
    "SHOW_HISTORY": True,
    "SHOW_VIEW_ON_SITE": False,
    "SIDEBAR": {
        "show_search": True,
        "navigation": [
            {
                "title": "Monitoring",
                "separator": True,
                "collapsible": False,
                "items": [
                    {
                        "title": "HTTP Requests",
                        "icon": "http",
                        "link": reverse_lazy("admin:monitor_httprequest_changelist"),
                    },
                    {
                        "title": "Analysis Results",
                        "icon": "query_stats",
                        "link": reverse_lazy("admin:monitor_analysisresult_changelist"),
                    },
                    {
                        "title": "Alerts",
                        "icon": "notifications_active",
                        "link": reverse_lazy("admin:monitor_alert_changelist"),
                    },
                ],
            },
            {
                "title": "Scanner",
                "separator": True,
                "collapsible": False,
                "items": [
                    {
                        "title": "Scans",
                        "icon": "radar",
                        "link": reverse_lazy("admin:scanner_githubscan_changelist"),
                    },
                    {
                        "title": "Dependencies",
                        "icon": "package_2",
                        "link": reverse_lazy("admin:scanner_dependency_changelist"),
                    },
                    {
                        "title": "Vulnerabilities",
                        "icon": "bug_report",
                        "link": reverse_lazy("admin:scanner_vulnerability_changelist"),
                    },
                    {
                        "title": "AI Reports",
                        "icon": "smart_toy",
                        "link": reverse_lazy("admin:scanner_aireport_changelist"),
                    },
                    {
                        "title": "Code Findings",
                        "icon": "code",
                        "link": reverse_lazy("admin:scanner_codefinding_changelist"),
                    },
                ],
            },
            {
                "title": "Accounts",
                "separator": True,
                "collapsible": True,
                "items": [
                    {
                        "title": "Users",
                        "icon": "person",
                        "link": reverse_lazy("admin:auth_user_changelist"),
                    },
                    {
                        "title": "Groups",
                        "icon": "group",
                        "link": reverse_lazy("admin:auth_group_changelist"),
                    },
                    {
                        "title": "User Settings",
                        "icon": "settings",
                        "link": reverse_lazy("admin:accounts_usersettings_changelist"),
                    },
                    {
                        "title": "Gemini Logs",
                        "icon": "token",
                        "link": reverse_lazy("admin:accounts_geminilog_changelist"),
                    },
                ],
            },
        ],
    },
}
