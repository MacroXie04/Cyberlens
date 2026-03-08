#include "scan_tab.h"
#include "api_client.h"
#include "async_task.h"
#include "app_state.h"
#include "layout.h"
#include <sstream>
#include <iomanip>

void ScanTab::build(bobcat::Group* parent) {
    parent_ = parent;

    int contentW = parent->w() - layout::SCAN_HISTORY_W - layout::MARGIN * 3;
    int x = layout::MARGIN;
    int y = 5;

    // === Top bar ===
    repoText_ = new bobcat::TextBox(x, y, contentW - 260, layout::BUTTON_H, "No repo selected");
    repoText_->box(FL_DOWN_BOX);

    modeDropdown_ = new bobcat::Dropdown(x + contentW - 250, y, 120, layout::DROPDOWN_H, "");
    modeDropdown_->add("Fast");
    modeDropdown_->add("Full");
    modeDropdown_->value(0);

    startBtn_ = new bobcat::Button(x + contentW - 120, y, 120, layout::BUTTON_H, "Start Scan");
    ON_CLICK(startBtn_, ScanTab::onStartScan);
    y += layout::BUTTON_H + layout::GAP;

    // Progress text
    progressText_ = new bobcat::TextBox(x, y, contentW, 24, "");
    progressText_->labelsize(12);
    y += 24 + layout::GAP;

    // === Sub-tab buttons ===
    const char* tabNames[] = {"Overview", "Dependencies", "Vulnerabilities", "Code Findings", "AI Report"};
    int tabBtnW = contentW / 5;
    for (int i = 0; i < 5; i++) {
        subTabBtns_[i] = new bobcat::Button(x + i * tabBtnW, y, tabBtnW, 28, tabNames[i]);
        subTabBtns_[i]->labelsize(11);
        int idx = i;
        subTabBtns_[i]->onClick([this, idx](bobcat::Widget*) { switchSubTab(idx); });
    }
    y += 32;

    int subH = parent->h() - y - 5;

    // === Sub-tab groups ===
    for (int i = 0; i < 5; i++) {
        subTabGroups_[i] = new bobcat::Group(x, y, contentW, subH);
    }

    // --- Overview ---
    {
        auto* g = subTabGroups_[0];
        int gy = 10, gx = 10;

        auto* lbl = new bobcat::TextBox(gx, gy, 200, 24, "Security Score");
        lbl->labelfont(FL_BOLD);
        scoreText_ = new bobcat::TextBox(gx + 200, gy, 120, 24, "--");
        gy += 30;

        auto* lbl2 = new bobcat::TextBox(gx, gy, 200, 24, "Dependency Score");
        lbl2->labelfont(FL_BOLD);
        depScoreText_ = new bobcat::TextBox(gx + 200, gy, 120, 24, "--");
        gy += 30;

        auto* lbl3 = new bobcat::TextBox(gx, gy, 200, 24, "Code Security Score");
        lbl3->labelfont(FL_BOLD);
        codeScoreText_ = new bobcat::TextBox(gx + 200, gy, 120, 24, "--");
        gy += 30;

        countText_ = new bobcat::TextBox(gx, gy, contentW - 20, 80, "");
        countText_->labelsize(12);
        g->end();
    }

    // --- Dependencies ---
    {
        auto* g = subTabGroups_[1];
        depList_ = new bobcat::ListBox(5, 5, contentW - 10, subH - 10);
        g->end();
    }

    // --- Vulnerabilities ---
    {
        auto* g = subTabGroups_[2];
        vulnList_ = new bobcat::ListBox(5, 5, contentW - 10, subH - 10);
        g->end();
    }

    // --- Code Findings ---
    {
        auto* g = subTabGroups_[3];
        int listH = (subH - 15) / 2;
        findingList_ = new bobcat::ListBox(5, 5, contentW - 10, listH);
        findingList_->onClick([this](bobcat::Widget*) {
            std::string sel = findingList_->getSelected();
            if (sel.empty()) return;
            // Find the index by iterating
            for (int i = 0; i < (int)currentFindings_.size(); i++) {
                auto& f = currentFindings_[i];
                if (sel.find(f.title) != std::string::npos) {
                    std::string detail;
                    detail += "Title: " + f.title + "\n";
                    detail += "Severity: " + f.severity + "\n";
                    detail += "Category: " + f.category + "\n";
                    detail += "File: " + f.file_path + ":" + std::to_string(f.line_number) + "\n\n";
                    detail += "Description:\n" + f.description + "\n\n";
                    detail += "Code:\n" + f.code_snippet + "\n\n";
                    detail += "Recommendation:\n" + f.recommendation;
                    findingDetail_->value(detail);
                    break;
                }
            }
        });
        findingDetail_ = new bobcat::Memo(5, 5 + listH + 5, contentW - 10, listH);
        findingDetail_->readonly(1);
        g->end();
    }

    // --- AI Report ---
    {
        auto* g = subTabGroups_[4];
        reportMemo_ = new bobcat::Memo(5, 5, contentW - 10, subH - 10);
        reportMemo_->readonly(1);
        g->end();
    }

    // === History list (right panel) ===
    int histX = x + contentW + layout::MARGIN;
    auto* histLabel = new bobcat::TextBox(histX, 5, layout::SCAN_HISTORY_W, layout::LABEL_H, "Scan History");
    histLabel->labelfont(FL_BOLD);
    historyList_ = new bobcat::ListBox(histX, 5 + layout::LABEL_H + 5,
                                        layout::SCAN_HISTORY_W - layout::MARGIN,
                                        parent->h() - 40);
    ON_CLICK(historyList_, ScanTab::onHistorySelect);

    // Show first sub-tab
    switchSubTab(0);
}

void ScanTab::refresh() {
    auto& state = AppState::instance();
    if (!state.selectedRepo.empty()) {
        // Strip language suffix if present from the repo list display
        std::string repo = state.selectedRepo;
        auto paren = repo.find(" (");
        if (paren != std::string::npos) repo = repo.substr(0, paren);
        repoText_->label(repo.c_str());
        state.selectedRepo = repo;
        loadHistory();
    } else {
        repoText_->label("No repo selected - select in Settings tab");
    }
}

void ScanTab::switchSubTab(int tab) {
    activeSubTab_ = tab;
    for (int i = 0; i < 5; i++) {
        if (i == tab) {
            subTabGroups_[i]->show();
            subTabBtns_[i]->color(FL_SELECTION_COLOR);
        } else {
            subTabGroups_[i]->hide();
            subTabBtns_[i]->color(FL_BACKGROUND_COLOR);
        }
        subTabBtns_[i]->redraw();
    }
}

void ScanTab::onStartScan(bobcat::Widget*) {
    auto& state = AppState::instance();
    if (state.selectedRepo.empty()) {
        progressText_->label("Select a repository first (Settings tab)");
        progressText_->labelcolor(FL_RED);
        return;
    }

    std::string mode = modeDropdown_->value() == 0 ? "fast" : "full";
    std::string repo = state.selectedRepo;

    startBtn_->label("Starting...");
    startBtn_->deactivate();
    progressText_->label("Initiating scan...");
    progressText_->labelcolor(FL_FOREGROUND_COLOR);

    AsyncRunner::instance().run<GitHubScan>(
        [repo, mode]() { return api::triggerScan(repo, mode); },
        [this](GitHubScan scan) {
            startBtn_->label("Start Scan");
            startBtn_->activate();
            if (scan.id > 0) {
                pollScanId_ = scan.id;
                AppState::instance().activeScanId = scan.id;
                AppState::instance().activeScan = scan;
                updateScanProgress(scan);
                startPolling();
            } else {
                progressText_->label("Failed to start scan");
                progressText_->labelcolor(FL_RED);
            }
        }
    );
}

void ScanTab::startPolling() {
    if (polling_) return;
    polling_ = true;
    Fl::add_timeout(3.0, pollScanStatus, this);
}

void ScanTab::stopPolling() {
    polling_ = false;
    Fl::remove_timeout(pollScanStatus, this);
}

void ScanTab::pollScanStatus(void* data) {
    auto* self = static_cast<ScanTab*>(data);
    if (!self->polling_) return;

    int scanId = self->pollScanId_;
    AsyncRunner::instance().run<GitHubScan>(
        [scanId]() { return api::getScanResults(scanId); },
        [self](GitHubScan scan) {
            self->updateScanProgress(scan);
            if (scan.scan_status == "completed" || scan.scan_status == "failed") {
                self->stopPolling();
                if (scan.scan_status == "completed") {
                    self->loadScanResults(scan.id);
                }
                self->loadHistory();
            } else if (self->polling_) {
                Fl::repeat_timeout(3.0, pollScanStatus, self);
            }
        }
    );
}

void ScanTab::updateScanProgress(const GitHubScan& scan) {
    std::string status = scan.scan_status;
    std::string phase = scan.code_scan_phase;
    std::string msg;

    if (status == "pending") {
        msg = "Pending...";
    } else if (status == "scanning") {
        msg = "Scanning";
        if (!phase.empty()) msg += " [" + phase + "]";
        if (scan.code_scan_files_total > 0) {
            msg += " " + std::to_string(scan.code_scan_files_scanned)
                 + "/" + std::to_string(scan.code_scan_files_total) + " files";
        }
        // ASCII progress bar
        if (scan.code_scan_files_total > 0) {
            int pct = (scan.code_scan_files_scanned * 100) / scan.code_scan_files_total;
            int bars = pct / 5;
            msg += " [";
            for (int i = 0; i < 20; i++) msg += (i < bars ? "#" : "-");
            msg += "] " + std::to_string(pct) + "%";
        }
    } else if (status == "completed") {
        msg = "Scan complete!";
        progressText_->labelcolor(fl_rgb_color(0x00, 0xAA, 0x00));
    } else if (status == "failed") {
        msg = "Scan failed";
        if (!scan.error_message.empty()) msg += ": " + scan.error_message;
        progressText_->labelcolor(FL_RED);
    }

    progressText_->label(msg.c_str());
}

void ScanTab::loadScanResults(int scanId) {
    AsyncRunner::instance().run<GitHubScan>(
        [scanId]() { return api::getScanResults(scanId); },
        [this, scanId](GitHubScan scan) {
            AppState::instance().activeScan = scan;

            // Overview
            std::ostringstream ss;
            ss << std::fixed << std::setprecision(1);
            scoreText_->label((std::to_string((int)scan.security_score) + "/100").c_str());
            depScoreText_->label((std::to_string((int)scan.dependency_score) + "/100").c_str());
            codeScoreText_->label((std::to_string((int)scan.code_security_score) + "/100").c_str());

            ss.str("");
            ss << "Total Dependencies: " << scan.total_deps
               << "  |  Vulnerable: " << scan.vulnerable_deps
               << "  |  Code Findings: " << scan.code_findings_count
               << "\nFiles Scanned: " << scan.code_scan_files_scanned
               << "/" << scan.code_scan_files_total
               << "  |  Tokens: " << scan.code_scan_total_tokens;
            if (scan.duration_ms > 0) {
                ss << "  |  Duration: " << (scan.duration_ms / 1000) << "s";
            }
            countText_->label(ss.str().c_str());

            loadDependencies(scan);
            loadVulnerabilities(scan);
            loadCodeFindings(scanId);
            loadAiReport(scanId);
        }
    );
}

void ScanTab::loadDependencies(const GitHubScan& scan) {
    depList_->clear();
    for (auto& d : scan.dependencies) {
        std::string entry = d.name + "@" + d.version + " | " + d.ecosystem;
        if (d.is_vulnerable) entry += " | VULNERABLE";
        depList_->add(entry);
    }
}

void ScanTab::loadVulnerabilities(const GitHubScan& scan) {
    vulnList_->clear();
    for (auto& d : scan.dependencies) {
        for (auto& v : d.vulnerabilities) {
            std::ostringstream ss;
            ss << std::fixed << std::setprecision(1);
            ss << v.cve_id << " | " << v.cvss_score << " | "
               << v.severity << " | " << d.name << " | " << v.summary;
            // Color code by severity
            std::string prefix;
            if (v.severity == "critical" || v.severity == "CRITICAL")
                prefix = "@C1"; // red
            else if (v.severity == "high" || v.severity == "HIGH")
                prefix = "@C208"; // orange
            else if (v.severity == "medium" || v.severity == "MEDIUM")
                prefix = "@C3"; // yellow
            else
                prefix = "@C62"; // green-ish

            vulnList_->add(prefix + ss.str());
        }
    }
}

void ScanTab::loadCodeFindings(int scanId) {
    AsyncRunner::instance().run<std::vector<CodeFinding>>(
        [scanId]() { return api::getCodeFindings(scanId); },
        [this](std::vector<CodeFinding> findings) {
            currentFindings_ = findings;
            AppState::instance().currentCodeFindings = findings;
            findingList_->clear();
            for (auto& f : findings) {
                std::string prefix;
                if (f.severity == "critical" || f.severity == "CRITICAL")
                    prefix = "@C1";
                else if (f.severity == "high" || f.severity == "HIGH")
                    prefix = "@C208";
                else if (f.severity == "medium" || f.severity == "MEDIUM")
                    prefix = "@C3";
                else
                    prefix = "@C62";

                std::string entry = prefix + "[" + f.severity + "] " + f.title
                                  + " (" + f.file_path + ":" + std::to_string(f.line_number) + ")";
                findingList_->add(entry);
            }
            if (findings.empty()) {
                findingDetail_->value("No code findings detected.");
            }
        }
    );
}

void ScanTab::loadAiReport(int scanId) {
    AsyncRunner::instance().run<AiReport>(
        [scanId]() { return api::getAiReport(scanId); },
        [this](AiReport report) {
            AppState::instance().currentAiReport = report;
            if (report.id == 0) {
                reportMemo_->value("No AI report available for this scan.");
                return;
            }
            std::string text = "=== Executive Summary ===\n\n";
            text += report.executive_summary + "\n\n";

            // Priority ranking
            if (report.priority_ranking.is_array() && !report.priority_ranking.empty()) {
                text += "=== Priority Ranking ===\n\n";
                for (auto& item : report.priority_ranking) {
                    text += "- " + item.value("package", "") + " (" + item.value("cve", "")
                          + ") [" + item.value("severity", "") + "]: "
                          + item.value("action", "") + "\n";
                }
                text += "\n";
            }

            // Remediation
            if (report.remediation_json.is_object()) {
                text += "=== Remediation Plan ===\n\n";
                if (report.remediation_json.contains("immediate")) {
                    text += "Immediate:\n";
                    for (auto& s : report.remediation_json["immediate"]) {
                        text += "  - " + s.get<std::string>() + "\n";
                    }
                }
                if (report.remediation_json.contains("short_term")) {
                    text += "\nShort Term:\n";
                    for (auto& s : report.remediation_json["short_term"]) {
                        text += "  - " + s.get<std::string>() + "\n";
                    }
                }
                if (report.remediation_json.contains("long_term")) {
                    text += "\nLong Term:\n";
                    for (auto& s : report.remediation_json["long_term"]) {
                        text += "  - " + s.get<std::string>() + "\n";
                    }
                }
            }

            reportMemo_->value(text);
        }
    );
}

void ScanTab::loadHistory() {
    auto& state = AppState::instance();
    if (state.selectedRepo.empty()) return;

    std::string repo = state.selectedRepo;
    AsyncRunner::instance().run<std::vector<GitHubScanHistoryItem>>(
        [repo]() { return api::getScanHistory(repo); },
        [this](std::vector<GitHubScanHistoryItem> items) {
            historyItems_ = items;
            historyList_->clear();
            for (auto& s : items) {
                std::string entry = "#" + std::to_string(s.id) + " "
                    + s.scan_status + " [" + s.scan_mode + "] "
                    + std::to_string((int)s.security_score) + "/100 "
                    + s.scanned_at.substr(0, 10);
                historyList_->add(entry);
            }
        }
    );
}

void ScanTab::onHistorySelect(bobcat::Widget*) {
    std::string sel = historyList_->getSelected();
    if (sel.empty()) return;

    // Parse scan ID from "#123 ..."
    auto hashPos = sel.find('#');
    auto spacePos = sel.find(' ', hashPos);
    if (hashPos == std::string::npos || spacePos == std::string::npos) return;
    int scanId = std::stoi(sel.substr(hashPos + 1, spacePos - hashPos - 1));

    progressText_->label("Loading scan results...");
    loadScanResults(scanId);
}
