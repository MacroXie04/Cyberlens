#include "settings_tab.h"
#include "api_client.h"
#include "async_task.h"
#include "app_state.h"
#include "layout.h"

void SettingsTab::build(bobcat::Group* parent) {
    parent_ = parent;
    int x = layout::MARGIN;
    int y = 5;
    int w = layout::SECTION_W;
    int colW = w / 2 - layout::GAP;

    // === Google ADK Section ===
    auto* adkLabel = new bobcat::TextBox(x, y, w, layout::LABEL_H, "Google ADK / Gemini API Key");
    adkLabel->labelfont(FL_BOLD);
    y += layout::LABEL_H + 5;

    apiKeyInput_ = new bobcat::Input(x, y, colW, layout::INPUT_H, "API Key");
    static_cast<Fl_Input_*>(apiKeyInput_)->input_type(FL_SECRET_INPUT);

    saveKeyBtn_ = new bobcat::Button(x + colW + layout::GAP, y + 15, 80, layout::BUTTON_H, "Save");
    ON_CLICK(saveKeyBtn_, SettingsTab::onSaveApiKey);

    testKeyBtn_ = new bobcat::Button(x + colW + layout::GAP + 90, y + 15, 80, layout::BUTTON_H, "Test");
    ON_CLICK(testKeyBtn_, SettingsTab::onTestApiKey);
    y += layout::INPUT_H + 25;

    keyStatus_ = new bobcat::TextBox(x, y, w, layout::LABEL_H, "");
    keyStatus_->labelsize(12);
    y += layout::LABEL_H + 5;

    modelDropdown_ = new bobcat::Dropdown(x, y, colW, layout::DROPDOWN_H, "Gemini Model");
    ON_CHANGE(modelDropdown_, SettingsTab::onModelChange);
    y += layout::DROPDOWN_H + layout::SECTION_GAP + 10;

    // === GitHub Section ===
    auto* ghLabel = new bobcat::TextBox(x, y, w, layout::LABEL_H, "GitHub Connection");
    ghLabel->labelfont(FL_BOLD);
    y += layout::LABEL_H + 5;

    patInput_ = new bobcat::Input(x, y, colW, layout::INPUT_H, "Personal Access Token");
    static_cast<Fl_Input_*>(patInput_)->input_type(FL_SECRET_INPUT);

    connectBtn_ = new bobcat::Button(x + colW + layout::GAP, y + 15, 120, layout::BUTTON_H, "Connect");
    ON_CLICK(connectBtn_, SettingsTab::onConnectGitHub);
    y += layout::INPUT_H + 25;

    ghStatus_ = new bobcat::TextBox(x, y, w, layout::LABEL_H, "");
    ghStatus_->labelsize(12);
    y += layout::LABEL_H + layout::GAP;

    // Repos list
    auto* repoLabel = new bobcat::TextBox(x, y, w, layout::LABEL_H, "Repositories");
    repoLabel->labelfont(FL_BOLD);
    y += layout::LABEL_H + 5;

    repoList_ = new bobcat::ListBox(x, y, w, 150);
    repoList_->onClick([this](bobcat::Widget*) {
        std::string sel = repoList_->getSelected();
        if (!sel.empty()) {
            AppState::instance().selectedRepo = sel;
            repoDetail_->label(("Selected: " + sel).c_str());
        }
    });
    y += 155;

    repoDetail_ = new bobcat::TextBox(x, y, w, layout::LABEL_H, "No repository selected");
    repoDetail_->labelsize(12);
    y += layout::LABEL_H + layout::SECTION_GAP;

    // === GCP Section ===
    int gcpX = x;
    auto* gcpLabel = new bobcat::TextBox(gcpX, y, w, layout::LABEL_H, "GCP Configuration");
    gcpLabel->labelfont(FL_BOLD);
    y += layout::LABEL_H + 5;

    gcpProjectInput_ = new bobcat::Input(gcpX, y, colW, layout::INPUT_H, "Project ID");
    y += layout::INPUT_H + 25;

    gcpServiceInput_ = new bobcat::Input(gcpX, y, colW, layout::INPUT_H, "Service Name");
    gcpRegionInput_ = new bobcat::Input(gcpX + colW + layout::GAP, y, colW, layout::INPUT_H, "Region");
    y += layout::INPUT_H + 25;

    gcpSaKeyInput_ = new bobcat::Input(gcpX, y, colW, layout::INPUT_H, "Service Account Key (JSON)");
    gcpSaveBtn_ = new bobcat::Button(gcpX + colW + layout::GAP, y + 15, 120, layout::BUTTON_H, "Save GCP");
    ON_CLICK(gcpSaveBtn_, SettingsTab::onSaveGcpSettings);
    y += layout::INPUT_H + 25;

    gcpStatus_ = new bobcat::TextBox(gcpX, y, w, layout::LABEL_H, "");
    gcpStatus_->labelsize(12);
}

void SettingsTab::load() {
    loadSettings();
    loadGitHubStatus();
    loadGcpSettings();
}

void SettingsTab::loadSettings() {
    AsyncRunner::instance().run<SettingsResponse>(
        []() { return api::getSettings(); },
        [this](SettingsResponse s) {
            auto& state = AppState::instance();
            state.settings = s;
            if (s.google_api_key_set) {
                keyStatus_->label(("Key set: " + s.google_api_key_preview).c_str());
                keyStatus_->labelcolor(fl_rgb_color(0x00, 0xAA, 0x00));
            } else {
                keyStatus_->label("No API key configured");
                keyStatus_->labelcolor(FL_RED);
            }
            // Load models
            AsyncRunner::instance().run<std::vector<std::string>>(
                []() { return api::getModels(); },
                [this, s](std::vector<std::string> models) {
                    auto& state = AppState::instance();
                    state.availableModels = models;
                    modelDropdown_->clear();
                    for (auto& m : models) {
                        modelDropdown_->add(m);
                    }
                    if (!s.gemini_model.empty()) {
                        for (int i = 0; i < (int)models.size(); i++) {
                            if (models[i] == s.gemini_model) {
                                modelDropdown_->value(i);
                                break;
                            }
                        }
                    }
                }
            );
        }
    );
}

void SettingsTab::loadGitHubStatus() {
    AsyncRunner::instance().run<api::GitHubStatus>(
        []() { return api::getGitHubStatus(); },
        [this](api::GitHubStatus status) {
            auto& state = AppState::instance();
            state.githubConnected = status.connected;
            state.githubUser = status.user;
            if (status.connected) {
                ghStatus_->label(("Connected as: " + status.user.login).c_str());
                ghStatus_->labelcolor(fl_rgb_color(0x00, 0xAA, 0x00));
                connectBtn_->label("Disconnect");
                connectBtn_->onClick([this](bobcat::Widget* w) { onDisconnectGitHub(w); });
                loadRepos();
            } else {
                ghStatus_->label("Not connected");
                ghStatus_->labelcolor(FL_RED);
                connectBtn_->label("Connect");
                ON_CLICK(connectBtn_, SettingsTab::onConnectGitHub);
            }
        }
    );
}

void SettingsTab::loadRepos() {
    AsyncRunner::instance().run<std::vector<GitHubRepo>>(
        []() { return api::getRepos(); },
        [this](std::vector<GitHubRepo> repos) {
            auto& state = AppState::instance();
            state.repos = repos;
            repoList_->clear();
            for (auto& r : repos) {
                std::string entry = r.full_name;
                if (!r.language.empty()) entry += " (" + r.language + ")";
                repoList_->add(entry);
            }
        }
    );
}

void SettingsTab::loadGcpSettings() {
    AsyncRunner::instance().run<GcpSettings>(
        []() { return api::getGcpSettings(); },
        [this](GcpSettings s) {
            auto& state = AppState::instance();
            state.gcpSettings = s;
            gcpProjectInput_->value(s.gcp_project_id);
            gcpServiceInput_->value(s.gcp_service_name);
            gcpRegionInput_->value(s.gcp_region);
            if (s.gcp_service_account_key_set) {
                gcpStatus_->label("Service account key is configured");
                gcpStatus_->labelcolor(fl_rgb_color(0x00, 0xAA, 0x00));
            } else {
                gcpStatus_->label("No service account key set");
            }
        }
    );
}

void SettingsTab::onSaveApiKey(bobcat::Widget*) {
    std::string key = apiKeyInput_->value();
    if (key.empty()) return;
    json body;
    body["google_api_key"] = key;
    std::string bodyStr = body.dump();

    saveKeyBtn_->label("Saving...");
    saveKeyBtn_->deactivate();

    AsyncRunner::instance().run<SettingsResponse>(
        [bodyStr]() { return api::updateSettings(bodyStr); },
        [this](SettingsResponse s) {
            saveKeyBtn_->label("Save");
            saveKeyBtn_->activate();
            AppState::instance().settings = s;
            if (s.google_api_key_set) {
                keyStatus_->label(("Key saved: " + s.google_api_key_preview).c_str());
                keyStatus_->labelcolor(fl_rgb_color(0x00, 0xAA, 0x00));
            }
            apiKeyInput_->value("");
        }
    );
}

void SettingsTab::onTestApiKey(bobcat::Widget*) {
    testKeyBtn_->label("Testing...");
    testKeyBtn_->deactivate();

    AsyncRunner::instance().run<TestKeyResult>(
        []() { return api::testApiKey(); },
        [this](TestKeyResult r) {
            testKeyBtn_->label("Test");
            testKeyBtn_->activate();
            if (r.success) {
                keyStatus_->label("API key is valid!");
                keyStatus_->labelcolor(fl_rgb_color(0x00, 0xAA, 0x00));
            } else {
                keyStatus_->label(("Test failed: " + r.error).c_str());
                keyStatus_->labelcolor(FL_RED);
            }
        }
    );
}

void SettingsTab::onModelChange(bobcat::Widget*) {
    std::string model = modelDropdown_->text();
    if (model.empty()) return;
    json body;
    body["gemini_model"] = model;
    std::string bodyStr = body.dump();

    AsyncRunner::instance().run<SettingsResponse>(
        [bodyStr]() { return api::updateSettings(bodyStr); },
        [this](SettingsResponse s) {
            AppState::instance().settings = s;
            keyStatus_->label(("Model: " + s.gemini_model).c_str());
        }
    );
}

void SettingsTab::onConnectGitHub(bobcat::Widget*) {
    std::string token = patInput_->value();
    if (token.empty()) {
        ghStatus_->label("Enter a PAT first");
        ghStatus_->labelcolor(FL_RED);
        return;
    }

    connectBtn_->label("Connecting...");
    connectBtn_->deactivate();

    AsyncRunner::instance().run<GitHubUser>(
        [token]() { return api::connectGitHub(token); },
        [this](GitHubUser user) {
            connectBtn_->activate();
            if (!user.login.empty()) {
                auto& state = AppState::instance();
                state.githubConnected = true;
                state.githubUser = user;
                ghStatus_->label(("Connected as: " + user.login).c_str());
                ghStatus_->labelcolor(fl_rgb_color(0x00, 0xAA, 0x00));
                connectBtn_->label("Disconnect");
                connectBtn_->onClick([this](bobcat::Widget* w) { onDisconnectGitHub(w); });
                patInput_->value("");
                loadRepos();
            } else {
                connectBtn_->label("Connect");
                ghStatus_->label("Connection failed");
                ghStatus_->labelcolor(FL_RED);
            }
        }
    );
}

void SettingsTab::onDisconnectGitHub(bobcat::Widget*) {
    connectBtn_->label("Disconnecting...");
    connectBtn_->deactivate();

    AsyncRunner::instance().run<HttpResponse>(
        []() { return api::disconnectGitHub(); },
        [this](HttpResponse) {
            connectBtn_->activate();
            auto& state = AppState::instance();
            state.githubConnected = false;
            state.githubUser = {};
            state.repos.clear();
            state.selectedRepo.clear();
            ghStatus_->label("Disconnected");
            ghStatus_->labelcolor(FL_RED);
            connectBtn_->label("Connect");
            ON_CLICK(connectBtn_, SettingsTab::onConnectGitHub);
            repoList_->clear();
            repoDetail_->label("No repository selected");
        }
    );
}

void SettingsTab::onSaveGcpSettings(bobcat::Widget*) {
    json body;
    std::string proj = gcpProjectInput_->value();
    std::string svc = gcpServiceInput_->value();
    std::string reg = gcpRegionInput_->value();
    std::string saKey = gcpSaKeyInput_->value();

    if (!proj.empty()) body["gcp_project_id"] = proj;
    if (!svc.empty()) body["gcp_service_name"] = svc;
    if (!reg.empty()) body["gcp_region"] = reg;
    if (!saKey.empty()) body["gcp_service_account_key"] = saKey;

    std::string bodyStr = body.dump();
    gcpSaveBtn_->label("Saving...");
    gcpSaveBtn_->deactivate();

    AsyncRunner::instance().run<GcpSettings>(
        [bodyStr]() { return api::updateGcpSettings(bodyStr); },
        [this](GcpSettings s) {
            gcpSaveBtn_->label("Save GCP");
            gcpSaveBtn_->activate();
            AppState::instance().gcpSettings = s;
            gcpStatus_->label("GCP settings saved");
            gcpStatus_->labelcolor(fl_rgb_color(0x00, 0xAA, 0x00));
            gcpSaKeyInput_->value("");
        }
    );
}
