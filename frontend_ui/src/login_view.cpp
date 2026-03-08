#include "login_view.h"
#include "api_client.h"
#include "async_task.h"
#include "app_state.h"
#include <FL/Fl_Input_.H>

LoginView::LoginView() {
    window_ = new bobcat::Window(layout::LOGIN_W, layout::LOGIN_H, "CyberLens - Login");

    int x = 50, w = 300, y = 20;

    titleText_ = new bobcat::TextBox(x, y, w, 36, "CyberLens");
    titleText_->labelsize(24);
    titleText_->labelfont(FL_BOLD);
    titleText_->align(FL_ALIGN_CENTER);
    y += 50;

    usernameInput_ = new bobcat::Input(x, y, w, layout::INPUT_H, "Username");
    y += layout::INPUT_H + 25;

    passwordInput_ = new bobcat::Input(x, y, w, layout::INPUT_H, "Password");
    static_cast<Fl_Input_*>(passwordInput_)->input_type(FL_SECRET_INPUT);
    y += layout::INPUT_H + 25;

    // Register-only fields (initially hidden)
    emailInput_ = new bobcat::Input(x, y, w, layout::INPUT_H, "Email");
    emailInput_->hide();

    confirmPasswordInput_ = new bobcat::Input(x, y + layout::INPUT_H + 25, w, layout::INPUT_H, "Confirm Password");
    static_cast<Fl_Input_*>(confirmPasswordInput_)->input_type(FL_SECRET_INPUT);
    confirmPasswordInput_->hide();

    errorText_ = new bobcat::TextBox(x, y, w, 20, "");
    errorText_->labelsize(12);
    errorText_->labelcolor(FL_RED);
    y += 30;

    loginBtn_ = new bobcat::Button(x, y, w, layout::BUTTON_H, "Sign In");
    ON_CLICK(loginBtn_, LoginView::doLogin);
    y += layout::BUTTON_H + 10;

    toggleBtn_ = new bobcat::Button(x, y, w, 25, "Create an account");
    toggleBtn_->box(FL_NO_BOX);
    toggleBtn_->labelsize(12);
    toggleBtn_->labelcolor(fl_rgb_color(0x44, 0x88, 0xFF));
    ON_CLICK(toggleBtn_, LoginView::toggleRegisterMode);

    window_->end();
}

void LoginView::show() {
    // Bootstrap CSRF
    AsyncRunner::instance().run<HttpResponse>(
        []() { return api::bootstrapCsrf(); },
        [](HttpResponse) {}
    );
    window_->show();
}

void LoginView::hide() {
    window_->hide();
}

void LoginView::toggleRegisterMode(bobcat::Widget*) {
    registerMode_ = !registerMode_;
    if (registerMode_) {
        // Resize window and show extra fields
        window_->size(layout::LOGIN_W, layout::LOGIN_H + 100);
        emailInput_->show();
        confirmPasswordInput_->show();
        loginBtn_->label("Register");
        toggleBtn_->label("Back to Sign In");

        // Reposition using Fl_Widget::position to avoid Fl_Input_ deprecation
        int y = 20 + 50; // after title
        static_cast<Fl_Widget*>(usernameInput_)->position(50, y); y += layout::INPUT_H + 25;
        static_cast<Fl_Widget*>(passwordInput_)->position(50, y); y += layout::INPUT_H + 25;
        static_cast<Fl_Widget*>(emailInput_)->position(50, y); y += layout::INPUT_H + 25;
        static_cast<Fl_Widget*>(confirmPasswordInput_)->position(50, y); y += layout::INPUT_H + 25;
        errorText_->Fl_Widget::position(50, y); y += 30;
        loginBtn_->Fl_Widget::position(50, y); y += layout::BUTTON_H + 10;
        toggleBtn_->Fl_Widget::position(50, y);
    } else {
        window_->size(layout::LOGIN_W, layout::LOGIN_H);
        emailInput_->hide();
        confirmPasswordInput_->hide();
        loginBtn_->label("Sign In");
        toggleBtn_->label("Create an account");

        int y = 20 + 50;
        static_cast<Fl_Widget*>(usernameInput_)->position(50, y); y += layout::INPUT_H + 25;
        static_cast<Fl_Widget*>(passwordInput_)->position(50, y); y += layout::INPUT_H + 25;
        errorText_->Fl_Widget::position(50, y); y += 30;
        loginBtn_->Fl_Widget::position(50, y); y += layout::BUTTON_H + 10;
        toggleBtn_->Fl_Widget::position(50, y);
    }
    errorText_->label("");
    window_->redraw();
}

void LoginView::doLogin(bobcat::Widget*) {
    std::string user = usernameInput_->value();
    std::string pass = passwordInput_->value();
    if (user.empty() || pass.empty()) {
        errorText_->label("Please enter username and password");
        return;
    }

    loginBtn_->label("Signing in...");
    loginBtn_->deactivate();
    errorText_->label("");

    AsyncRunner::instance().run<api::LoginResult>(
        [user, pass]() { return api::login(user, pass); },
        [this](api::LoginResult result) {
            loginBtn_->activate();
            if (result.success) {
                auto& state = AppState::instance();
                state.authenticated = true;
                state.currentUser = result.user;
                loginBtn_->label("Sign In");
                if (onLoginSuccessCb_) onLoginSuccessCb_();
            } else {
                loginBtn_->label(registerMode_ ? "Register" : "Sign In");
                errorText_->label(result.error.c_str());
            }
        }
    );
}

void LoginView::doRegister(bobcat::Widget*) {
    std::string user = usernameInput_->value();
    std::string pass = passwordInput_->value();
    std::string email = emailInput_->value();
    std::string confirm = confirmPasswordInput_->value();

    if (user.empty() || pass.empty() || email.empty()) {
        errorText_->label("All fields are required");
        return;
    }
    if (pass != confirm) {
        errorText_->label("Passwords do not match");
        return;
    }

    loginBtn_->label("Registering...");
    loginBtn_->deactivate();

    AsyncRunner::instance().run<api::LoginResult>(
        [user, email, pass]() { return api::registerUser(user, email, pass); },
        [this](api::LoginResult result) {
            loginBtn_->activate();
            if (result.success) {
                auto& state = AppState::instance();
                state.authenticated = true;
                state.currentUser = result.user;
                if (onLoginSuccessCb_) onLoginSuccessCb_();
            } else {
                loginBtn_->label("Register");
                errorText_->label(result.error.c_str());
            }
        }
    );
}
