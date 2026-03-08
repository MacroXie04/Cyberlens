//
// Created by Hongzhe Xie
//

// slider.h
#ifndef BOBCAT_UI_SLIDER
#define BOBCAT_UI_SLIDER

#include "bobcat_ui.h"

// Base on the environment, include the corresponding header files
#if defined(_WIN32)
    #include <FL/Fl_Slider.H>
#elif defined(__APPLE__)
    #include <FL/Fl_Slider.H>
#else
    #include <FL/Fl_Slider.H>
#endif
#include <functional>
#include <string>

namespace bobcat {
    class Slider : public Fl_Slider {
        std::string caption;
        std::function<void(bobcat::Widget *)> onChangeCb;
        std::function<void(bobcat::Widget *)> onEnterCb;
        std::function<void(bobcat::Widget *)> onLeaveCb;

        int handle(int e) override {
            int r = Fl_Slider::handle(e);
            if (e == FL_ENTER && onEnterCb) onEnterCb(this);
            if (e == FL_LEAVE && onLeaveCb) onLeaveCb(this);
            if (e == FL_RELEASE && onChangeCb) onChangeCb(this);
            return r;
        }

    public:
        Slider(int x, int y, int w, int h, std::string c = ""): Fl_Slider(x, y, w, h, c.c_str()), caption(c) {
            type(FL_HORIZONTAL);
        }

        void onChange(std::function<void(bobcat::Widget *)> cb) { onChangeCb = cb; }
        void onEnter(std::function<void(bobcat::Widget *)> cb) { onEnterCb = cb; }
        void onLeave(std::function<void(bobcat::Widget *)> cb) { onLeaveCb = cb; }

        void label(std::string s) {
            caption = s;
            Fl_Slider::copy_label(s.c_str());
        }

        std::string label() const { return caption; }
    };
}

#endif
