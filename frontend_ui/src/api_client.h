#ifndef CYBERLENS_API_CLIENT_H
#define CYBERLENS_API_CLIENT_H

#include "json_models.h"
#include "http_client.h"
#include <string>
#include <vector>

// All functions are synchronous — call from background threads only.
namespace api {

// Bootstrap CSRF cookie
HttpResponse bootstrapCsrf();

// Auth
struct LoginResult {
    bool success = false;
    AuthUser user;
    std::string error;
};
LoginResult login(const std::string& username, const std::string& password);
LoginResult registerUser(const std::string& username, const std::string& email,
                         const std::string& password);
HttpResponse logout();
AuthMeResponse getMe();

// Settings
SettingsResponse getSettings();
SettingsResponse updateSettings(const std::string& jsonBody);
TestKeyResult testApiKey();
std::vector<std::string> getModels();

// GCP Settings
GcpSettings getGcpSettings();
GcpSettings updateGcpSettings(const std::string& jsonBody);

// GitHub
struct GitHubStatus {
    bool connected = false;
    GitHubUser user;
};
GitHubStatus getGitHubStatus();
GitHubUser connectGitHub(const std::string& token);
HttpResponse disconnectGitHub();
std::vector<GitHubRepo> getRepos();

// Scanner
GitHubScan triggerScan(const std::string& repo, const std::string& scanMode = "fast");
std::vector<GitHubScanHistoryItem> getScanHistory(const std::string& repo);
GitHubScan getScanResults(int scanId);
AiReport getAiReport(int scanId);
std::vector<CodeFinding> getCodeFindings(int scanId);

// GCP Estate
GcpEstateSummary getGcpEstateSummary(int minutes = 0);
std::vector<GcpObservedService> getGcpEstateServices();
HttpResponse triggerGcpRefresh();

// GCP Security
struct GcpSecurityEventsResult {
    int count = 0;
    std::vector<GcpSecurityEvent> results;
};
GcpSecurityEventsResult getGcpSecurityEvents(int minutes = 60, int limit = 50);
std::vector<GcpSecurityIncident> getGcpSecurityIncidents(const std::string& status = "");
GcpSecurityIncident getGcpSecurityIncidentDetail(int id);
GcpSecurityIncident ackGcpSecurityIncident(int id, const std::string& status);

}

#endif
