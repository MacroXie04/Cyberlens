#ifndef CYBERLENS_MAIN_WINDOW_H
#define CYBERLENS_MAIN_WINDOW_H

#include "../bobcat_ui/all.h"
#include "settings_tab.h"
#include "scan_tab.h"
#include "monitor_tab.h"

class MainWindow {
public:
    MainWindow();
    void show();
    void hide();

private:
    void switchTab(int tab);
    void handleLogout(bobcat::Widget*);
    void updateStatusBar();

    bobcat::Window* window_;

    // Header
    bobcat::TextBox* titleText_;
    bobcat::Button* tabBtns_[3];
    bobcat::TextBox* userText_;
    bobcat::TextBox* repoStatus_;
    bobcat::TextBox* keyStatus_;
    bobcat::Button* logoutBtn_;

    // Tab groups
    bobcat::Group* tabGroups_[3];
    int activeTab_ = 0;

    // Tab controllers
    SettingsTab settingsTab_;
    ScanTab scanTab_;
    MonitorTab monitorTab_;

    std::function<void()> onLogoutCb_;

public:
    void onLogout(std::function<void()> cb) { onLogoutCb_ = cb; }
    void loadInitialData();
};

#endif
