#include "api_client.h"
#include <iostream>

namespace api {

static HttpClient& http() { return HttpClient::instance(); }

HttpResponse bootstrapCsrf() {
    return http().get("/api/auth/me/");
}

// ---- Auth ----
LoginResult login(const std::string& username, const std::string& password) {
    LoginResult result;
    json body;
    body["username"] = username;
    body["password"] = password;
    auto resp = http().post("/api/auth/login/", body.dump());
    if (resp.ok()) {
        try {
            auto j = json::parse(resp.body);
            result.success = true;
            result.user = j.at("user").get<AuthUser>();
        } catch (const std::exception& e) {
            result.error = e.what();
        }
    } else {
        try {
            auto j = json::parse(resp.body);
            result.error = j.value("error", "Login failed (HTTP " + std::to_string(resp.status_code) + ")");
        } catch (...) {
            result.error = resp.error.empty() ? "Login failed" : resp.error;
        }
    }
    return result;
}

LoginResult registerUser(const std::string& username, const std::string& email,
                          const std::string& password) {
    LoginResult result;
    json body;
    body["username"] = username;
    body["email"] = email;
    body["password"] = password;
    auto resp = http().post("/api/auth/register/", body.dump());
    if (resp.ok()) {
        try {
            auto j = json::parse(resp.body);
            result.success = true;
            result.user = j.at("user").get<AuthUser>();
        } catch (const std::exception& e) {
            result.error = e.what();
        }
    } else {
        try {
            auto j = json::parse(resp.body);
            result.error = j.value("error", "Registration failed");
        } catch (...) {
            result.error = resp.error.empty() ? "Registration failed" : resp.error;
        }
    }
    return result;
}

HttpResponse logout() {
    return http().post("/api/auth/logout/");
}

AuthMeResponse getMe() {
    auto resp = http().get("/api/auth/me/");
    if (resp.ok()) {
        try {
            return json::parse(resp.body).get<AuthMeResponse>();
        } catch (...) {}
    }
    return {};
}

// ---- Settings ----
SettingsResponse getSettings() {
    auto resp = http().get("/api/settings/");
    if (resp.ok()) {
        try { return json::parse(resp.body).get<SettingsResponse>(); } catch (...) {}
    }
    return {};
}

SettingsResponse updateSettings(const std::string& jsonBody) {
    auto resp = http().put("/api/settings/", jsonBody);
    if (resp.ok()) {
        try { return json::parse(resp.body).get<SettingsResponse>(); } catch (...) {}
    }
    return {};
}

TestKeyResult testApiKey() {
    auto resp = http().post("/api/settings/test-key/");
    if (resp.ok()) {
        try { return json::parse(resp.body).get<TestKeyResult>(); } catch (...) {}
    }
    return {};
}

std::vector<std::string> getModels() {
    auto resp = http().get("/api/settings/models/");
    if (resp.ok()) {
        try {
            auto j = json::parse(resp.body);
            return j.at("models").get<std::vector<std::string>>();
        } catch (...) {}
    }
    return {};
}

// ---- GCP Settings ----
GcpSettings getGcpSettings() {
    auto resp = http().get("/api/settings/gcp/");
    if (resp.ok()) {
        try { return json::parse(resp.body).get<GcpSettings>(); } catch (...) {}
    }
    return {};
}

GcpSettings updateGcpSettings(const std::string& jsonBody) {
    auto resp = http().put("/api/settings/gcp/", jsonBody);
    if (resp.ok()) {
        try { return json::parse(resp.body).get<GcpSettings>(); } catch (...) {}
    }
    return {};
}

// ---- GitHub ----
GitHubStatus getGitHubStatus() {
    auto resp = http().get("/api/github/status/");
    GitHubStatus result;
    if (resp.ok()) {
        try {
            auto j = json::parse(resp.body);
            result.connected = j.value("connected", false);
            if (result.connected && j.contains("user")) {
                result.user = j.at("user").get<GitHubUser>();
            }
        } catch (...) {}
    }
    return result;
}

GitHubUser connectGitHub(const std::string& token) {
    json body;
    body["token"] = token;
    auto resp = http().post("/api/github/connect/", body.dump());
    if (resp.ok()) {
        try { return json::parse(resp.body).get<GitHubUser>(); } catch (...) {}
    }
    return {};
}

HttpResponse disconnectGitHub() {
    return http().del("/api/github/disconnect/");
}

std::vector<GitHubRepo> getRepos() {
    auto resp = http().get("/api/github/repos/");
    if (resp.ok()) {
        try { return json::parse(resp.body).get<std::vector<GitHubRepo>>(); } catch (...) {}
    }
    return {};
}

// ---- Scanner ----
GitHubScan triggerScan(const std::string& repo, const std::string& scanMode) {
    json body;
    body["repo"] = repo;
    body["scan_mode"] = scanMode;
    auto resp = http().post("/api/github/scan/", body.dump());
    if (resp.ok()) {
        try { return json::parse(resp.body).get<GitHubScan>(); } catch (...) {}
    }
    return {};
}

std::vector<GitHubScanHistoryItem> getScanHistory(const std::string& repo) {
    std::string path = "/api/github/scans/?repo=" + repo;
    auto resp = http().get(path);
    if (resp.ok()) {
        try { return json::parse(resp.body).get<std::vector<GitHubScanHistoryItem>>(); } catch (...) {}
    }
    return {};
}

GitHubScan getScanResults(int scanId) {
    auto resp = http().get("/api/github/scan/" + std::to_string(scanId) + "/");
    if (resp.ok()) {
        try { return json::parse(resp.body).get<GitHubScan>(); } catch (...) {}
    }
    return {};
}

AiReport getAiReport(int scanId) {
    auto resp = http().get("/api/github/scan/" + std::to_string(scanId) + "/ai-report/");
    if (resp.ok()) {
        try { return json::parse(resp.body).get<AiReport>(); } catch (...) {}
    }
    return {};
}

std::vector<CodeFinding> getCodeFindings(int scanId) {
    auto resp = http().get("/api/github/scan/" + std::to_string(scanId) + "/code-findings/");
    if (resp.ok()) {
        try { return json::parse(resp.body).get<std::vector<CodeFinding>>(); } catch (...) {}
    }
    return {};
}

// ---- GCP Estate ----
GcpEstateSummary getGcpEstateSummary(int minutes) {
    std::string path = "/api/gcp-estate/summary/";
    if (minutes > 0) path += "?minutes=" + std::to_string(minutes);
    auto resp = http().get(path);
    if (resp.ok()) {
        try { return json::parse(resp.body).get<GcpEstateSummary>(); } catch (...) {}
    }
    return {};
}

std::vector<GcpObservedService> getGcpEstateServices() {
    auto resp = http().get("/api/gcp-estate/services/");
    if (resp.ok()) {
        try { return json::parse(resp.body).get<std::vector<GcpObservedService>>(); } catch (...) {}
    }
    return {};
}

HttpResponse triggerGcpRefresh() {
    return http().post("/api/gcp-estate/refresh/");
}

// ---- GCP Security ----
GcpSecurityEventsResult getGcpSecurityEvents(int minutes, int limit) {
    std::string path = "/api/gcp-security/events/?minutes=" + std::to_string(minutes)
                       + "&limit=" + std::to_string(limit);
    auto resp = http().get(path);
    GcpSecurityEventsResult result;
    if (resp.ok()) {
        try {
            auto j = json::parse(resp.body);
            result.count = j.value("count", 0);
            if (j.contains("results")) j.at("results").get_to(result.results);
        } catch (...) {}
    }
    return result;
}

std::vector<GcpSecurityIncident> getGcpSecurityIncidents(const std::string& status) {
    std::string path = "/api/gcp-security/incidents/";
    if (!status.empty()) path += "?status=" + status;
    auto resp = http().get(path);
    if (resp.ok()) {
        try { return json::parse(resp.body).get<std::vector<GcpSecurityIncident>>(); } catch (...) {}
    }
    return {};
}

GcpSecurityIncident getGcpSecurityIncidentDetail(int id) {
    auto resp = http().get("/api/gcp-security/incidents/" + std::to_string(id) + "/");
    if (resp.ok()) {
        try { return json::parse(resp.body).get<GcpSecurityIncident>(); } catch (...) {}
    }
    return {};
}

GcpSecurityIncident ackGcpSecurityIncident(int id, const std::string& status) {
    json body;
    body["status"] = status;
    auto resp = http().post("/api/gcp-security/incidents/" + std::to_string(id) + "/ack/", body.dump());
    if (resp.ok()) {
        try { return json::parse(resp.body).get<GcpSecurityIncident>(); } catch (...) {}
    }
    return {};
}

}
