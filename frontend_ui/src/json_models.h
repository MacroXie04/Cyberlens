#ifndef CYBERLENS_JSON_MODELS_H
#define CYBERLENS_JSON_MODELS_H

#include "json.hpp"
#include <string>
#include <vector>

using json = nlohmann::json;

// ---- Auth ----
struct AuthUser {
    int id = 0;
    std::string username;
    std::string email;
};
NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE_WITH_DEFAULT(AuthUser, id, username, email)

struct AuthMeResponse {
    bool authenticated = false;
    AuthUser user;
};
inline void from_json(const json& j, AuthMeResponse& r) {
    j.at("authenticated").get_to(r.authenticated);
    if (r.authenticated && j.contains("user")) {
        j.at("user").get_to(r.user);
    }
}

// ---- Settings ----
struct SettingsResponse {
    bool google_api_key_set = false;
    std::string google_api_key_preview;
    std::string gemini_model;
};
NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE_WITH_DEFAULT(SettingsResponse, google_api_key_set, google_api_key_preview, gemini_model)

struct GcpSettings {
    std::string gcp_project_id;
    std::string gcp_service_name;
    std::string gcp_region;
    bool gcp_service_account_key_set = false;
    std::vector<std::string> gcp_regions;
    std::vector<std::string> gcp_service_filters;
    std::vector<std::string> gcp_enabled_sources;
};
NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE_WITH_DEFAULT(GcpSettings, gcp_project_id, gcp_service_name, gcp_region, gcp_service_account_key_set, gcp_regions, gcp_service_filters, gcp_enabled_sources)

struct TestKeyResult {
    bool success = false;
    std::vector<std::string> models;
    std::string error;
};
inline void from_json(const json& j, TestKeyResult& r) {
    r.success = j.value("success", false);
    if (j.contains("models")) j.at("models").get_to(r.models);
    r.error = j.value("error", "");
}

// ---- GitHub ----
struct GitHubUser {
    std::string login;
    std::string avatar_url;
    std::string name;
};
NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE_WITH_DEFAULT(GitHubUser, login, avatar_url, name)

struct GitHubRepo {
    std::string full_name;
    std::string name;
    bool is_private = false;
    std::string language;
    std::string updated_at;
    std::string description;
    int stargazers_count = 0;
    int forks_count = 0;
    int open_issues_count = 0;
    std::string default_branch;
    std::string html_url;
};
inline void from_json(const json& j, GitHubRepo& r) {
    r.full_name = j.value("full_name", "");
    r.name = j.value("name", "");
    r.is_private = j.value("private", false);
    r.language = j.value("language", "");
    r.updated_at = j.value("updated_at", "");
    r.description = j.value("description", "");
    r.stargazers_count = j.value("stargazers_count", 0);
    r.forks_count = j.value("forks_count", 0);
    r.open_issues_count = j.value("open_issues_count", 0);
    r.default_branch = j.value("default_branch", "");
    r.html_url = j.value("html_url", "");
}

// ---- Scanner ----
struct Vulnerability {
    int id = 0;
    std::string cve_id;
    double cvss_score = 0.0;
    std::string severity;
    std::string summary;
    std::string fixed_version;
    std::string osv_id;
};
NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE_WITH_DEFAULT(Vulnerability, id, cve_id, cvss_score, severity, summary, fixed_version, osv_id)

struct Dependency {
    int id = 0;
    std::string name;
    std::string version;
    std::string ecosystem;
    bool is_vulnerable = false;
    std::vector<Vulnerability> vulnerabilities;
};
NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE_WITH_DEFAULT(Dependency, id, name, version, ecosystem, is_vulnerable, vulnerabilities)

struct CodeFinding {
    int id = 0;
    std::string file_path;
    int line_number = 0;
    std::string severity;
    std::string category;
    std::string title;
    std::string description;
    std::string code_snippet;
    std::string recommendation;
    std::string explanation;
};
NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE_WITH_DEFAULT(CodeFinding, id, file_path, line_number, severity, category, title, description, code_snippet, recommendation, explanation)

struct GitHubScan {
    int id = 0;
    std::string repo_name;
    std::string repo_url;
    std::string scan_source;
    std::string scan_mode;
    std::string scan_status;
    int total_deps = 0;
    int vulnerable_deps = 0;
    double security_score = 0.0;
    double dependency_score = 0.0;
    double code_security_score = 0.0;
    std::string scanned_at;
    std::string started_at;
    std::string completed_at;
    int duration_ms = 0;
    int code_findings_count = 0;
    int code_scan_input_tokens = 0;
    int code_scan_output_tokens = 0;
    int code_scan_total_tokens = 0;
    int code_scan_files_scanned = 0;
    int code_scan_files_total = 0;
    std::string code_scan_phase;
    std::string error_message;
    std::vector<Dependency> dependencies;
    std::vector<CodeFinding> code_findings;
};
inline void from_json(const json& j, GitHubScan& s) {
    s.id = j.value("id", 0);
    s.repo_name = j.value("repo_name", "");
    s.repo_url = j.value("repo_url", "");
    s.scan_source = j.value("scan_source", "");
    s.scan_mode = j.value("scan_mode", "fast");
    s.scan_status = j.value("scan_status", "pending");
    s.total_deps = j.value("total_deps", 0);
    s.vulnerable_deps = j.value("vulnerable_deps", 0);
    s.security_score = j.value("security_score", 0.0);
    s.dependency_score = j.value("dependency_score", 0.0);
    s.code_security_score = j.value("code_security_score", 0.0);
    s.scanned_at = j.value("scanned_at", "");
    s.started_at = j.value("started_at", "");
    s.completed_at = j.value("completed_at", "");
    s.duration_ms = j.value("duration_ms", 0);
    s.code_findings_count = j.value("code_findings_count", 0);
    s.code_scan_input_tokens = j.value("code_scan_input_tokens", 0);
    s.code_scan_output_tokens = j.value("code_scan_output_tokens", 0);
    s.code_scan_total_tokens = j.value("code_scan_total_tokens", 0);
    s.code_scan_files_scanned = j.value("code_scan_files_scanned", 0);
    s.code_scan_files_total = j.value("code_scan_files_total", 0);
    s.code_scan_phase = j.value("code_scan_phase", "");
    s.error_message = j.value("error_message", "");
    if (j.contains("dependencies") && j["dependencies"].is_array()) {
        j.at("dependencies").get_to(s.dependencies);
    }
    if (j.contains("code_findings") && j["code_findings"].is_array()) {
        j.at("code_findings").get_to(s.code_findings);
    }
}

struct GitHubScanHistoryItem {
    int id = 0;
    std::string repo_name;
    std::string scan_status;
    std::string scan_mode;
    double security_score = 0.0;
    int total_deps = 0;
    int vulnerable_deps = 0;
    int code_findings_count = 0;
    std::string code_scan_phase;
    std::string scanned_at;
    std::string error_message;
};
inline void from_json(const json& j, GitHubScanHistoryItem& s) {
    s.id = j.value("id", 0);
    s.repo_name = j.value("repo_name", "");
    s.scan_status = j.value("scan_status", "");
    s.scan_mode = j.value("scan_mode", "fast");
    s.security_score = j.value("security_score", 0.0);
    s.total_deps = j.value("total_deps", 0);
    s.vulnerable_deps = j.value("vulnerable_deps", 0);
    s.code_findings_count = j.value("code_findings_count", 0);
    s.code_scan_phase = j.value("code_scan_phase", "");
    s.scanned_at = j.value("scanned_at", "");
    s.error_message = j.value("error_message", "");
}

struct AiReport {
    int id = 0;
    std::string executive_summary;
    json priority_ranking;
    json remediation_json;
    std::string generated_at;
};
inline void from_json(const json& j, AiReport& r) {
    r.id = j.value("id", 0);
    r.executive_summary = j.value("executive_summary", "");
    if (j.contains("priority_ranking")) r.priority_ranking = j["priority_ranking"];
    if (j.contains("remediation_json")) r.remediation_json = j["remediation_json"];
    r.generated_at = j.value("generated_at", "");
}

// ---- GCP Estate & Security ----
struct GcpEstateSummary {
    std::string project_id;
    int active_incidents = 0;
    int services_under_attack = 0;
    int armor_blocks_recent = 0;
    int auth_failures_recent = 0;
    int error_events_recent = 0;
    int total_events_recent = 0;
    int total_services = 0;
    int unhealthy_revisions = 0;
};
inline void from_json(const json& j, GcpEstateSummary& s) {
    s.project_id = j.value("project_id", "");
    s.active_incidents = j.value("active_incidents", 0);
    s.services_under_attack = j.value("services_under_attack", 0);
    s.armor_blocks_recent = j.value("armor_blocks_recent", 0);
    s.auth_failures_recent = j.value("auth_failures_recent", 0);
    s.error_events_recent = j.value("error_events_recent", 0);
    s.total_events_recent = j.value("total_events_recent", 0);
    s.total_services = j.value("total_services", 0);
    s.unhealthy_revisions = j.value("unhealthy_revisions", 0);
}

struct GcpObservedService {
    int id = 0;
    std::string service_name;
    std::string region;
    double request_rate = 0.0;
    double error_rate = 0.0;
    int instance_count = 0;
    std::string url;
};
inline void from_json(const json& j, GcpObservedService& s) {
    s.id = j.value("id", 0);
    s.service_name = j.value("service_name", "");
    s.region = j.value("region", "");
    s.request_rate = j.value("request_rate", 0.0);
    s.error_rate = j.value("error_rate", 0.0);
    s.instance_count = j.value("instance_count", 0);
    s.url = j.value("url", "");
}

struct GcpSecurityEvent {
    int id = 0;
    std::string source;
    std::string timestamp;
    std::string severity;
    std::string category;
    std::string source_ip;
    std::string service;
    std::string region;
    std::string path;
    std::string method;
    int status_code = 0;
    std::string country;
    std::string raw_payload_preview;
};
inline void from_json(const json& j, GcpSecurityEvent& e) {
    e.id = j.value("id", 0);
    e.source = j.value("source", "");
    e.timestamp = j.value("timestamp", "");
    e.severity = j.value("severity", "");
    e.category = j.value("category", "");
    e.source_ip = j.value("source_ip", "");
    e.service = j.value("service", "");
    e.region = j.value("region", "");
    e.path = j.value("path", "");
    e.method = j.value("method", "");
    e.status_code = j.value("status_code", 0);
    e.country = j.value("country", "");
    e.raw_payload_preview = j.value("raw_payload_preview", "");
}

struct GcpSecurityIncident {
    int id = 0;
    std::string incident_type;
    std::string priority;
    std::string status;
    double confidence = 0.0;
    int evidence_count = 0;
    std::vector<std::string> services_affected;
    std::vector<std::string> regions_affected;
    std::string title;
    std::string narrative;
    std::string likely_cause;
    std::vector<std::string> next_steps;
    std::string first_seen;
    std::string last_seen;
    std::string acknowledged_by;
    std::string acknowledged_at;
};
inline void from_json(const json& j, GcpSecurityIncident& i) {
    i.id = j.value("id", 0);
    i.incident_type = j.value("incident_type", "");
    i.priority = j.value("priority", "");
    i.status = j.value("status", "");
    i.confidence = j.value("confidence", 0.0);
    i.evidence_count = j.value("evidence_count", 0);
    if (j.contains("services_affected") && j["services_affected"].is_array())
        j.at("services_affected").get_to(i.services_affected);
    if (j.contains("regions_affected") && j["regions_affected"].is_array())
        j.at("regions_affected").get_to(i.regions_affected);
    i.title = j.value("title", "");
    i.narrative = j.value("narrative", "");
    i.likely_cause = j.value("likely_cause", "");
    if (j.contains("next_steps") && j["next_steps"].is_array())
        j.at("next_steps").get_to(i.next_steps);
    i.first_seen = j.value("first_seen", "");
    i.last_seen = j.value("last_seen", "");
    i.acknowledged_by = j.value("acknowledged_by", "");
    i.acknowledged_at = j.value("acknowledged_at", "");
}

#endif
