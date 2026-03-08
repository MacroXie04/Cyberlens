#ifndef CYBERLENS_APP_STATE_H
#define CYBERLENS_APP_STATE_H

#include "json_models.h"
#include <string>
#include <vector>
#include <mutex>

struct AppState {
    static AppState& instance() {
        static AppState inst;
        return inst;
    }

    // Auth
    bool authenticated = false;
    AuthUser currentUser;

    // Settings
    SettingsResponse settings;
    GcpSettings gcpSettings;
    std::vector<std::string> availableModels;

    // GitHub
    bool githubConnected = false;
    GitHubUser githubUser;
    std::vector<GitHubRepo> repos;
    std::string selectedRepo; // full_name

    // Active scan
    int activeScanId = 0;
    GitHubScan activeScan;
    bool scanPolling = false;

    // Scan results cache
    AiReport currentAiReport;
    std::vector<CodeFinding> currentCodeFindings;

    // GCP data
    GcpEstateSummary gcpSummary;
    std::vector<GcpObservedService> gcpServices;
    std::vector<GcpSecurityEvent> gcpEvents;
    std::vector<GcpSecurityIncident> gcpIncidents;

    // Monitor polling
    bool monitorPolling = false;
    int monitorMinutes = 60; // time range

private:
    AppState() = default;
};

#endif
