#include "monitor_tab.h"
#include "api_client.h"
#include "async_task.h"
#include "app_state.h"
#include "layout.h"
#include <ctime>
#include <sstream>
#include <iomanip>

void MonitorTab::build(bobcat::Group* parent) {
    parent_ = parent;
    int x = layout::MARGIN;
    int y = 5;
    int w = parent->w() - layout::MARGIN * 2;

    // === Top bar ===
    refreshBtn_ = new bobcat::Button(x, y, 90, layout::BUTTON_H, "Refresh");
    ON_CLICK(refreshBtn_, MonitorTab::onRefresh);

    timeDropdown_ = new bobcat::Dropdown(x + 100, y, 120, layout::DROPDOWN_H, "");
    timeDropdown_->add("15 min");
    timeDropdown_->add("1 hour");
    timeDropdown_->add("6 hours");
    timeDropdown_->add("24 hours");
    timeDropdown_->value(1); // default 1 hour
    ON_CHANGE(timeDropdown_, MonitorTab::onTimeRangeChange);

    lastUpdated_ = new bobcat::TextBox(x + 230, y + 5, 300, 20, "Not loaded yet");
    lastUpdated_->labelsize(11);
    y += layout::BUTTON_H + layout::GAP;

    // === KPI row ===
    const char* kpiLabels[] = {
        "Active Incidents", "Under Attack", "Armor Blocks",
        "Auth Failures", "Error Events", "Total Events"
    };
    int kpiW = (w - layout::GAP * 5) / 6;
    for (int i = 0; i < 6; i++) {
        kpiBoxes_[i] = new bobcat::TextBox(x + i * (kpiW + layout::GAP), y, kpiW, layout::KPI_BOX_H, kpiLabels[i]);
        kpiBoxes_[i]->box(FL_DOWN_BOX);
        kpiBoxes_[i]->labelsize(11);
        kpiBoxes_[i]->align(FL_ALIGN_CENTER);
    }
    y += layout::KPI_BOX_H + layout::GAP;

    // === Three-column layout ===
    int colH = 250;
    int col3W = (w - layout::GAP * 2) / 3;

    servicesList_ = new bobcat::ListBox(x, y, col3W, colH, "Services");
    ON_CLICK(servicesList_, MonitorTab::onServiceSelect);

    eventsList_ = new bobcat::ListBox(x + col3W + layout::GAP, y, col3W, colH, "Security Events");
    ON_CLICK(eventsList_, MonitorTab::onEventSelect);

    incidentsList_ = new bobcat::ListBox(x + (col3W + layout::GAP) * 2, y, col3W, colH, "Incidents");
    ON_CLICK(incidentsList_, MonitorTab::onIncidentSelect);
    y += colH + layout::LABEL_H + layout::GAP;

    // === Detail panel ===
    int detailH = parent->h() - y - layout::BUTTON_H - layout::GAP * 2 - 5;
    detailMemo_ = new bobcat::Memo(x, y, w - 130, detailH);
    detailMemo_->readonly(1);

    ackBtn_ = new bobcat::Button(x + w - 120, y, 120, layout::BUTTON_H, "Acknowledge");
    ON_CLICK(ackBtn_, MonitorTab::onAckIncident);
    ackBtn_->deactivate();
}

void MonitorTab::startPolling() {
    if (polling_) return;
    polling_ = true;
    refreshAll();
    Fl::add_timeout(10.0, pollCallback, this);
}

void MonitorTab::stopPolling() {
    polling_ = false;
    Fl::remove_timeout(pollCallback, this);
}

void MonitorTab::pollCallback(void* data) {
    auto* self = static_cast<MonitorTab*>(data);
    if (!self->polling_) return;
    self->refreshAll();
    Fl::repeat_timeout(10.0, pollCallback, self);
}

int getMinutesFromDropdown(int value) {
    switch (value) {
        case 0: return 15;
        case 1: return 60;
        case 2: return 360;
        case 3: return 1440;
        default: return 60;
    }
}

void MonitorTab::refreshAll() {
    loadSummary();
    loadServices();
    loadEvents();
    loadIncidents();

    // Update timestamp
    std::time_t now = std::time(nullptr);
    char buf[64];
    std::strftime(buf, sizeof(buf), "Updated: %H:%M:%S", std::localtime(&now));
    lastUpdated_->label(buf);
}

void MonitorTab::loadSummary() {
    int minutes = getMinutesFromDropdown(timeDropdown_->value());

    AsyncRunner::instance().run<GcpEstateSummary>(
        [minutes]() { return api::getGcpEstateSummary(minutes); },
        [this](GcpEstateSummary s) {
            AppState::instance().gcpSummary = s;

            int values[] = {
                s.active_incidents, s.services_under_attack, s.armor_blocks_recent,
                s.auth_failures_recent, s.error_events_recent, s.total_events_recent
            };
            const char* kpiLabels[] = {
                "Active Incidents", "Under Attack", "Armor Blocks",
                "Auth Failures", "Error Events", "Total Events"
            };
            for (int i = 0; i < 6; i++) {
                std::string text = std::string(kpiLabels[i]) + "\n" + std::to_string(values[i]);
                kpiBoxes_[i]->label(text.c_str());
                // Highlight if nonzero for critical metrics
                if (i < 2 && values[i] > 0) {
                    kpiBoxes_[i]->labelcolor(FL_RED);
                } else {
                    kpiBoxes_[i]->labelcolor(FL_FOREGROUND_COLOR);
                }
            }
        }
    );
}

void MonitorTab::loadServices() {
    AsyncRunner::instance().run<std::vector<GcpObservedService>>(
        []() { return api::getGcpEstateServices(); },
        [this](std::vector<GcpObservedService> svcs) {
            services_ = svcs;
            AppState::instance().gcpServices = svcs;
            servicesList_->clear();
            for (auto& s : svcs) {
                std::ostringstream ss;
                ss << std::fixed << std::setprecision(1);
                ss << s.service_name << " | " << s.region
                   << " | err:" << s.error_rate << " | req:" << s.request_rate;
                servicesList_->add(ss.str());
            }
        }
    );
}

void MonitorTab::loadEvents() {
    int minutes = getMinutesFromDropdown(timeDropdown_->value());

    AsyncRunner::instance().run<api::GcpSecurityEventsResult>(
        [minutes]() { return api::getGcpSecurityEvents(minutes, 100); },
        [this](api::GcpSecurityEventsResult result) {
            events_ = result.results;
            AppState::instance().gcpEvents = result.results;
            eventsList_->clear();
            for (auto& e : result.results) {
                std::string prefix;
                if (e.severity == "critical") prefix = "@C1";
                else if (e.severity == "high") prefix = "@C208";
                else if (e.severity == "medium") prefix = "@C3";
                else prefix = "@C62";

                std::string ts = e.timestamp.size() > 16 ? e.timestamp.substr(11, 5) : e.timestamp;
                std::string entry = prefix + ts + " | " + e.severity + " | "
                    + e.category + " | " + e.source_ip;
                eventsList_->add(entry);
            }
        }
    );
}

void MonitorTab::loadIncidents() {
    AsyncRunner::instance().run<std::vector<GcpSecurityIncident>>(
        []() { return api::getGcpSecurityIncidents(); },
        [this](std::vector<GcpSecurityIncident> incs) {
            incidents_ = incs;
            AppState::instance().gcpIncidents = incs;
            incidentsList_->clear();
            for (auto& i : incs) {
                std::string prefix;
                if (i.priority == "p1") prefix = "@C1";
                else if (i.priority == "p2") prefix = "@C208";
                else prefix = "@C3";

                std::string entry = prefix + "[" + i.priority + "] " + i.status
                    + " | " + i.title;
                incidentsList_->add(entry);
            }
        }
    );
}

void MonitorTab::onRefresh(bobcat::Widget*) {
    refreshBtn_->label("Loading...");
    refreshBtn_->deactivate();
    refreshAll();
    // Re-enable after a short delay
    Fl::add_timeout(1.0, [](void* data) {
        auto* btn = static_cast<bobcat::Button*>(data);
        btn->label("Refresh");
        btn->activate();
    }, refreshBtn_);
}

void MonitorTab::onTimeRangeChange(bobcat::Widget*) {
    refreshAll();
}

void MonitorTab::onServiceSelect(bobcat::Widget*) {
    std::string sel = servicesList_->getSelected();
    if (sel.empty()) return;

    for (auto& s : services_) {
        if (sel.find(s.service_name) != std::string::npos) {
            std::ostringstream ss;
            ss << std::fixed << std::setprecision(2);
            ss << "Service: " << s.service_name << "\n"
               << "Region: " << s.region << "\n"
               << "Instances: " << s.instance_count << "\n"
               << "Request Rate: " << s.request_rate << "/s\n"
               << "Error Rate: " << s.error_rate << "%\n"
               << "URL: " << s.url;
            detailMemo_->value(ss.str());
            ackBtn_->deactivate();
            selectedIncidentId_ = 0;
            break;
        }
    }
}

void MonitorTab::onEventSelect(bobcat::Widget*) {
    std::string sel = eventsList_->getSelected();
    if (sel.empty()) return;

    // Find the event by matching fields in the selection string
    for (auto& e : events_) {
        if (sel.find(e.category) != std::string::npos && sel.find(e.source_ip) != std::string::npos) {
            std::string text;
            text += "Timestamp: " + e.timestamp + "\n";
            text += "Severity: " + e.severity + "\n";
            text += "Category: " + e.category + "\n";
            text += "Source: " + e.source + "\n";
            text += "Source IP: " + e.source_ip + "\n";
            text += "Service: " + e.service + " (" + e.region + ")\n";
            text += "Path: " + e.method + " " + e.path + "\n";
            if (e.status_code > 0) text += "Status: " + std::to_string(e.status_code) + "\n";
            text += "Country: " + e.country + "\n";
            if (!e.raw_payload_preview.empty()) {
                text += "\nPayload Preview:\n" + e.raw_payload_preview;
            }
            detailMemo_->value(text);
            ackBtn_->deactivate();
            selectedIncidentId_ = 0;
            break;
        }
    }
}

void MonitorTab::onIncidentSelect(bobcat::Widget*) {
    std::string sel = incidentsList_->getSelected();
    if (sel.empty()) return;

    for (auto& i : incidents_) {
        if (sel.find(i.title) != std::string::npos) {
            std::string text;
            text += "Incident #" + std::to_string(i.id) + "\n";
            text += "Priority: " + i.priority + "  Status: " + i.status + "\n";
            text += "Type: " + i.incident_type + "\n";
            text += "Confidence: " + std::to_string((int)(i.confidence * 100)) + "%\n";
            text += "Evidence: " + std::to_string(i.evidence_count) + " events\n";
            text += "First seen: " + i.first_seen + "\n";
            text += "Last seen: " + i.last_seen + "\n\n";

            text += "Title: " + i.title + "\n\n";
            text += "Narrative:\n" + i.narrative + "\n\n";
            text += "Likely Cause:\n" + i.likely_cause + "\n\n";

            if (!i.next_steps.empty()) {
                text += "Next Steps:\n";
                for (auto& step : i.next_steps) {
                    text += "  - " + step + "\n";
                }
            }

            if (!i.services_affected.empty()) {
                text += "\nServices Affected: ";
                for (size_t si = 0; si < i.services_affected.size(); si++) {
                    if (si > 0) text += ", ";
                    text += i.services_affected[si];
                }
                text += "\n";
            }

            if (!i.acknowledged_by.empty()) {
                text += "\nAcknowledged by: " + i.acknowledged_by;
                if (!i.acknowledged_at.empty()) text += " at " + i.acknowledged_at;
                text += "\n";
            }

            detailMemo_->value(text);

            selectedIncidentId_ = i.id;
            if (i.status == "open") {
                ackBtn_->activate();
            } else {
                ackBtn_->deactivate();
            }
            break;
        }
    }
}

void MonitorTab::onAckIncident(bobcat::Widget*) {
    if (selectedIncidentId_ == 0) return;

    int id = selectedIncidentId_;
    ackBtn_->label("Updating...");
    ackBtn_->deactivate();

    AsyncRunner::instance().run<GcpSecurityIncident>(
        [id]() { return api::ackGcpSecurityIncident(id, "investigating"); },
        [this](GcpSecurityIncident updated) {
            ackBtn_->label("Acknowledge");
            if (updated.id > 0) {
                detailMemo_->value(("Incident updated to: " + updated.status).c_str());
                loadIncidents();
                loadSummary();
            }
        }
    );
}
