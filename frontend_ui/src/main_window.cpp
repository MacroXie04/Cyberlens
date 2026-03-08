#include "main_window.h"
#include "api_client.h"
#include "async_task.h"
#include "app_state.h"
#include "layout.h"

MainWindow::MainWindow() {
    window_ = new bobcat::Window(layout::WIN_W, layout::WIN_H, "CyberLens");

    // === Header bar ===
    auto* headerBg = new bobcat::TextBox(0, 0, layout::WIN_W, layout::HDR_H, "");
    headerBg->box(FL_FLAT_BOX);
    headerBg->color(fl_rgb_color(0x1A, 0x1A, 0x2E));

    titleText_ = new bobcat::TextBox(layout::MARGIN, 8, 140, 34, "CyberLens");
    titleText_->labelsize(20);
    titleText_->labelfont(FL_BOLD);
    titleText_->labelcolor(fl_rgb_color(0x00, 0xD4, 0xFF));

    // Tab buttons
    const char* tabLabels[] = {"Monitor", "Code Scan", "Settings"};
    int tabStartX = 170;
    for (int i = 0; i < 3; i++) {
        tabBtns_[i] = new bobcat::Button(tabStartX + i * (layout::TAB_BTN_W + 5),
                                          layout::TAB_BTN_Y,
                                          layout::TAB_BTN_W, layout::TAB_BTN_H, tabLabels[i]);
        tabBtns_[i]->labelsize(12);
        int idx = i;
        tabBtns_[i]->onClick([this, idx](bobcat::Widget*) { switchTab(idx); });
    }

    // Status area (right side of header)
    userText_ = new bobcat::TextBox(layout::WIN_W - 420, 5, 120, 20, "");
    userText_->labelsize(11);
    userText_->labelcolor(FL_WHITE);

    keyStatus_ = new bobcat::TextBox(layout::WIN_W - 290, 5, 100, 20, "");
    keyStatus_->labelsize(10);

    repoStatus_ = new bobcat::TextBox(layout::WIN_W - 290, 25, 200, 20, "");
    repoStatus_->labelsize(10);
    repoStatus_->labelcolor(fl_rgb_color(0xAA, 0xAA, 0xAA));

    logoutBtn_ = new bobcat::Button(layout::WIN_W - 80, layout::TAB_BTN_Y, 65, layout::TAB_BTN_H, "Logout");
    logoutBtn_->labelsize(11);
    ON_CLICK(logoutBtn_, MainWindow::handleLogout);

    // === Tab content groups ===
    for (int i = 0; i < 3; i++) {
        tabGroups_[i] = new bobcat::Group(0, layout::CONTENT_Y,
                                           layout::WIN_W, layout::CONTENT_H);
    }

    // Build Monitor tab (index 0)
    monitorTab_.build(tabGroups_[0]);
    tabGroups_[0]->end();

    // Build Scan tab (index 1)
    scanTab_.build(tabGroups_[1]);
    tabGroups_[1]->end();

    // Build Settings tab (index 2)
    settingsTab_.build(tabGroups_[2]);
    tabGroups_[2]->end();

    window_->end();

    // Default to Monitor tab
    switchTab(0);
}

void MainWindow::show() {
    window_->show();
    updateStatusBar();
}

void MainWindow::hide() {
    monitorTab_.stopPolling();
    window_->hide();
}

void MainWindow::loadInitialData() {
    settingsTab_.load();
    updateStatusBar();
}

void MainWindow::switchTab(int tab) {
    activeTab_ = tab;
    for (int i = 0; i < 3; i++) {
        if (i == tab) {
            tabGroups_[i]->show();
            tabBtns_[i]->color(fl_rgb_color(0x00, 0x88, 0xCC));
            tabBtns_[i]->labelcolor(FL_WHITE);
        } else {
            tabGroups_[i]->hide();
            tabBtns_[i]->color(fl_rgb_color(0x33, 0x33, 0x44));
            tabBtns_[i]->labelcolor(fl_rgb_color(0xAA, 0xAA, 0xAA));
        }
        tabBtns_[i]->redraw();
    }

    // Tab-specific actions
    if (tab == 0) {
        monitorTab_.startPolling();
    } else {
        monitorTab_.stopPolling();
    }
    if (tab == 1) {
        scanTab_.refresh();
    }

    updateStatusBar();
}

void MainWindow::updateStatusBar() {
    auto& state = AppState::instance();

    if (state.authenticated) {
        userText_->label(state.currentUser.username.c_str());
    }

    if (state.settings.google_api_key_set) {
        keyStatus_->label("API Key OK");
        keyStatus_->labelcolor(fl_rgb_color(0x00, 0xCC, 0x00));
    } else {
        keyStatus_->label("No Key");
        keyStatus_->labelcolor(fl_rgb_color(0xFF, 0x66, 0x66));
    }

    if (!state.selectedRepo.empty()) {
        repoStatus_->label(state.selectedRepo.c_str());
    } else {
        repoStatus_->label("No repo");
    }
}

void MainWindow::handleLogout(bobcat::Widget*) {
    AsyncRunner::instance().run<HttpResponse>(
        []() { return api::logout(); },
        [this](HttpResponse) {
            auto& state = AppState::instance();
            state.authenticated = false;
            state.currentUser = {};
            monitorTab_.stopPolling();
            if (onLogoutCb_) onLogoutCb_();
        }
    );
}
