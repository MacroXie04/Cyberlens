#ifndef CYBERLENS_MONITOR_TAB_H
#define CYBERLENS_MONITOR_TAB_H

#include "../bobcat_ui/all.h"
#include "json_models.h"
#include <vector>

class MonitorTab {
public:
    void build(bobcat::Group* parent);
    void startPolling();
    void stopPolling();

private:
    void refreshAll();
    void loadSummary();
    void loadServices();
    void loadEvents();
    void loadIncidents();

    void onRefresh(bobcat::Widget*);
    void onTimeRangeChange(bobcat::Widget*);
    void onServiceSelect(bobcat::Widget*);
    void onEventSelect(bobcat::Widget*);
    void onIncidentSelect(bobcat::Widget*);
    void onAckIncident(bobcat::Widget*);

    static void pollCallback(void* data);

    bobcat::Group* parent_ = nullptr;

    // Top bar
    bobcat::Button* refreshBtn_ = nullptr;
    bobcat::Dropdown* timeDropdown_ = nullptr;
    bobcat::TextBox* lastUpdated_ = nullptr;

    // KPI row
    bobcat::TextBox* kpiBoxes_[6] = {};

    // Three column lists
    bobcat::ListBox* servicesList_ = nullptr;
    bobcat::ListBox* eventsList_ = nullptr;
    bobcat::ListBox* incidentsList_ = nullptr;

    // Detail panel
    bobcat::Memo* detailMemo_ = nullptr;
    bobcat::Button* ackBtn_ = nullptr;

    std::vector<GcpObservedService> services_;
    std::vector<GcpSecurityEvent> events_;
    std::vector<GcpSecurityIncident> incidents_;
    int selectedIncidentId_ = 0;

    bool polling_ = false;
};

#endif
