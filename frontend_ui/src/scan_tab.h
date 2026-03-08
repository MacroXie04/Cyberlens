#ifndef CYBERLENS_SCAN_TAB_H
#define CYBERLENS_SCAN_TAB_H

#include "../bobcat_ui/all.h"
#include "json_models.h"
#include <vector>

class ScanTab {
public:
    void build(bobcat::Group* parent);
    void refresh();

private:
    // Actions
    void onStartScan(bobcat::Widget*);
    void onHistorySelect(bobcat::Widget*);
    void switchSubTab(int tab);

    // Polling
    static void pollScanStatus(void* data);
    void startPolling();
    void stopPolling();
    void updateScanProgress(const GitHubScan& scan);

    // Result loading
    void loadScanResults(int scanId);
    void loadDependencies(const GitHubScan& scan);
    void loadVulnerabilities(const GitHubScan& scan);
    void loadCodeFindings(int scanId);
    void loadAiReport(int scanId);

    void loadHistory();

    bobcat::Group* parent_ = nullptr;

    // Top bar
    bobcat::TextBox* repoText_ = nullptr;
    bobcat::Dropdown* modeDropdown_ = nullptr;
    bobcat::Button* startBtn_ = nullptr;

    // Progress
    bobcat::TextBox* progressText_ = nullptr;

    // History panel (right side)
    bobcat::ListBox* historyList_ = nullptr;
    std::vector<GitHubScanHistoryItem> historyItems_;

    // Sub-tab buttons
    bobcat::Button* subTabBtns_[5] = {};
    bobcat::Group* subTabGroups_[5] = {};
    int activeSubTab_ = 0;

    // Overview
    bobcat::TextBox* scoreText_ = nullptr;
    bobcat::TextBox* depScoreText_ = nullptr;
    bobcat::TextBox* codeScoreText_ = nullptr;
    bobcat::TextBox* countText_ = nullptr;

    // Dependencies
    bobcat::ListBox* depList_ = nullptr;

    // Vulnerabilities
    bobcat::ListBox* vulnList_ = nullptr;

    // Code Findings
    bobcat::ListBox* findingList_ = nullptr;
    bobcat::Memo* findingDetail_ = nullptr;
    std::vector<CodeFinding> currentFindings_;

    // AI Report
    bobcat::Memo* reportMemo_ = nullptr;

    bool polling_ = false;
    int pollScanId_ = 0;
};

#endif
