#ifndef CYBERLENS_SETTINGS_TAB_H
#define CYBERLENS_SETTINGS_TAB_H

#include "../bobcat_ui/all.h"
#include "json_models.h"

class SettingsTab {
public:
    void build(bobcat::Group* parent);
    void load();

private:
    // Google ADK section
    void onSaveApiKey(bobcat::Widget*);
    void onTestApiKey(bobcat::Widget*);
    void onModelChange(bobcat::Widget*);

    // GitHub section
    void onConnectGitHub(bobcat::Widget*);
    void onDisconnectGitHub(bobcat::Widget*);

    // GCP section
    void onSaveGcpSettings(bobcat::Widget*);

    void loadSettings();
    void loadGitHubStatus();
    void loadGcpSettings();
    void loadRepos();

    bobcat::Group* parent_ = nullptr;

    // ADK
    bobcat::Input* apiKeyInput_ = nullptr;
    bobcat::Button* saveKeyBtn_ = nullptr;
    bobcat::Button* testKeyBtn_ = nullptr;
    bobcat::TextBox* keyStatus_ = nullptr;
    bobcat::Dropdown* modelDropdown_ = nullptr;

    // GitHub
    bobcat::Input* patInput_ = nullptr;
    bobcat::Button* connectBtn_ = nullptr;
    bobcat::TextBox* ghStatus_ = nullptr;
    bobcat::ListBox* repoList_ = nullptr;
    bobcat::TextBox* repoDetail_ = nullptr;

    // GCP
    bobcat::Input* gcpProjectInput_ = nullptr;
    bobcat::Input* gcpServiceInput_ = nullptr;
    bobcat::Input* gcpRegionInput_ = nullptr;
    bobcat::Input* gcpSaKeyInput_ = nullptr;
    bobcat::Button* gcpSaveBtn_ = nullptr;
    bobcat::TextBox* gcpStatus_ = nullptr;
};

#endif
