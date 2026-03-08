#include "../bobcat_ui/all.h"
#include "login_view.h"
#include "main_window.h"
#include "api_client.h"
#include "async_task.h"
#include "app_state.h"

int main() {
    bobcat::theme(bobcat::DARK);
    bobcat::Application_ app;

    Fl::lock(); // Enable multithreading support for Fl::awake()

    LoginView loginView;
    MainWindow mainWindow;

    // Login success → hide login, show main
    loginView.onLoginSuccess([&]() {
        loginView.hide();
        mainWindow.show();
        mainWindow.loadInitialData();
    });

    // Logout → hide main, show login
    mainWindow.onLogout([&]() {
        mainWindow.hide();
        loginView.show();
    });

    // Check if already authenticated
    AsyncRunner::instance().run<AuthMeResponse>(
        []() { return api::getMe(); },
        [&](AuthMeResponse resp) {
            if (resp.authenticated) {
                AppState::instance().authenticated = true;
                AppState::instance().currentUser = resp.user;
                loginView.hide();
                mainWindow.show();
                mainWindow.loadInitialData();
            }
        }
    );

    // Show login by default
    loginView.show();

    return app.run();
}
