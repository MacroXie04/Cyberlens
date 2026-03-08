#ifndef CYBERLENS_LOGIN_VIEW_H
#define CYBERLENS_LOGIN_VIEW_H

#include "../bobcat_ui/all.h"
#include "layout.h"
#include <functional>

class LoginView {
public:
    LoginView();

    void show();
    void hide();

    // Called when login succeeds
    void onLoginSuccess(std::function<void()> cb) { onLoginSuccessCb_ = cb; }

private:
    void doLogin(bobcat::Widget*);
    void doRegister(bobcat::Widget*);
    void toggleRegisterMode(bobcat::Widget*);

    bobcat::Window* window_;
    bobcat::Input* usernameInput_;
    bobcat::Input* passwordInput_;
    bobcat::Input* emailInput_;
    bobcat::Input* confirmPasswordInput_;
    bobcat::TextBox* errorText_;
    bobcat::Button* loginBtn_;
    bobcat::Button* toggleBtn_;
    bobcat::TextBox* titleText_;

    bool registerMode_ = false;
    std::function<void()> onLoginSuccessCb_;
};

#endif
