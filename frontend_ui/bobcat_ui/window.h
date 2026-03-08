#ifndef BOBCAT_UI_WINDOW
#define BOBCAT_UI_WINDOW

#include "bobcat_ui.h"

// Base on the environment, include the corresponding header files
#if defined(_WIN32)
    #include <FL/Enumerations.H>
    #include <FL/Fl_Double_Window.H>
    #include <FL/Fl_PNG_Image.H>
#elif defined(__APPLE__)
    #include <FL/Enumerations.H>
    #include <FL/Fl_Double_Window.H>
    #include <FL/Fl_PNG_Image.H>
#else
    #include <FL/Enumerations.H>
    #include <FL/Fl_Double_Window.H>
    #include <FL/Fl_PNG_Image.H>
#endif

#include <string>
#include <functional>

namespace bobcat {

class Window : public Fl_Double_Window {
    std::function<void(bobcat::Widget *)> onShowCb;
    std::function<void(bobcat::Widget *)> onHideCb;
    std::function<void(bobcat::Widget *)> onClickCb;
    std::function<void(bobcat::Widget *)> willHideCb;

    std::string caption;

    Fl_PNG_Image *icon_data;

    void init(){
        onShowCb = nullptr;
        onHideCb = nullptr;
        onClickCb = nullptr;
        willHideCb = nullptr;
        icon_data = new Fl_PNG_Image("/usr/share/icons/big_m.png");

        icon(icon_data);
    }

public:
    Window(int w, int h, std::string title = "") : Fl_Double_Window(w, h, title.c_str()) {
        init();
        caption = title;
        Fl_Double_Window::copy_label(title.c_str());
    }

    Window(int x, int y, int w, int h, std::string title = "") : Fl_Double_Window(x, y, w, h, title.c_str()) {
        init();
        caption = title;
        Fl_Double_Window::copy_label(title.c_str());
    }

    int handle(int event) {
        // printf("Event was %s - %d\n", fl_eventnames[event], event);
        int ret = Fl_Double_Window::handle(event);

        if (event == FL_SHOW){
            if (onShowCb) onShowCb(this);
        }
        if (event == FL_HIDE){
            if (onHideCb) onHideCb(this);
        }


        for (int i = 0; i < children(); i++){
            if (Fl::event_inside(child(i))){
                return 0;
            }
        }

        if (event == FL_PUSH){
            Fl::focus(this);
        }

        if (event == FL_RELEASE){
            if (Fl::focus() == this){
                if (onClickCb) onClickCb(this);
            }
        }

        return ret;
    }

    void onShow(std::function<void(bobcat::Widget *)> cb){
        onShowCb = cb;
    }

    void onHide(std::function<void(bobcat::Widget *)> cb){
        onHideCb = cb;
    }

    void willHide(std::function<void(bobcat::Widget *)> cb){
        willHideCb = cb;
        callback([](bobcat::Widget * sender, void *self){
            Window *win = (Window *)self;
            win->willHideCb(win);
        }, this);
    }

    void onClick(std::function<void(bobcat::Widget *)> cb){
        onClickCb = cb;
    }

    std::string label() const {
        return caption;
    }

    void label(std::string s){
        Fl_Double_Window::copy_label(s.c_str());
        caption = s;
    }

    void show(){
        Fl_Double_Window::show();
        wait_for_expose();          // Supposedly makes show() synchronous
        Fl::flush();                // Make sure to draw what needs to be drawn
    }

    ~Window(){
        delete icon_data;
    }


};

}

#endif