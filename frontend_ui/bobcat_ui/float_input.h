#ifndef BOBCAT_UI_FLOAT_INPUT
#define BOBCAT_UI_FLOAT_INPUT

#include "bobcat_ui.h"

// Base on the environment, include the corresponding header files
#if defined(_WIN32)
    #include <FL/Enumerations.H>
    #include <FL/Fl_Input.H>
    #include <FL/Fl_Input_.H>
    #include <FL/Fl_Widget.H>
#elif defined(__APPLE__)
    #include <FL/Enumerations.H>
    #include <FL/Fl_Input.H>
    #include <FL/Fl_Input_.H>
    #include <FL/Fl_Widget.H>
#else
    #include <FL/Enumerations.H>
    #include <FL/Fl_Input.H>
    #include <FL/Fl_Input_.H>
    #include <FL/Fl_Widget.H>
#endif

#include <string>
#include <functional>

// #include <FL/names.h>

namespace bobcat {
    class FloatInput : public Fl_Input {
        std::string caption;

        std::function<void(bobcat::Widget *)> onClickCb;
        std::function<void(bobcat::Widget *)> onEnterCb;
        std::function<void(bobcat::Widget *)> onLeaveCb;
        std::function<void(bobcat::Widget *)> onChangeCb;

        void init() {
            onClickCb = nullptr;
            onEnterCb = nullptr;
            onLeaveCb = nullptr;
            onChangeCb = nullptr;
        }

        int handle(int event) {
            // if (event == 8 || event == 9)
            // printf("Event was %s (%d) - %s\n", fl_eventnames[event], event, value());
            int ret = Fl_Input::handle(event);
            if (event == FL_ENTER) {
                if (onEnterCb) onEnterCb(this);
            }

            if (event == FL_LEAVE) {
                if (onLeaveCb) onLeaveCb(this);
            }

            if (event == FL_RELEASE) {
                if (Fl::event_inside(this)) {
                    if (Fl::focus() == this) {
                        if (onClickCb) onClickCb(this);
                    }
                }
            }

            return ret;
        }

    public:
        FloatInput(int x, int y, int w, int h, std::string caption = ""): Fl_Input(x, y, w, h, caption.c_str()) {
            init();
            align(FL_ALIGN_TOP_LEFT);
            this->caption = caption;
            Fl_Input::copy_label(caption.c_str());
            input_type(FL_FLOAT_INPUT);
        }

        std::string label() const {
            return caption;
        }

        void label(std::string s) {
            Fl_Input::copy_label(s.c_str());
            caption = s;
        }

        float value() const {
            float temp = std::stof(Fl_Input::value());
            return temp;
        }

        bool empty() {
            std::string value = Fl_Input::value();
            if (value.empty()) return true;
            return false;
        }

        void clear() {
            Fl_Input::value("");
            if (onChangeCb) onChangeCb(this);
        }

        void value(float v) {
            Fl_Input::value(std::to_string(v).c_str());
            if (onChangeCb) onChangeCb(this);
        }

        void onClick(std::function<void(bobcat::Widget *)> cb) {
            onClickCb = cb;
        }

        void onEnter(std::function<void(bobcat::Widget *)> cb) {
            onEnterCb = cb;
        }

        void onLeave(std::function<void(bobcat::Widget *)> cb) {
            onLeaveCb = cb;
        }

        void onChange(std::function<void(bobcat::Widget *)> cb) {
            onChangeCb = cb;
            when(FL_WHEN_CHANGED);
            callback([](bobcat::Widget *sender, void *self) {
                FloatInput *in = (FloatInput *) self;
                in->onChangeCb(in);
            }, this);
        }

        void align(Fl_Align alignment) {
            Fl_Input::align(alignment);
            parent()->redraw();
        }

        Fl_Fontsize labelsize() {
            return Fl_Input::labelsize();
        }

        void labelsize(Fl_Fontsize pix) {
            Fl_Input::labelsize(pix);
            parent()->redraw();
        }

        Fl_Color labelcolor() {
            return Fl_Input::labelcolor();
        }

        void labelcolor(Fl_Color color) {
            Fl_Input::labelcolor(color);
            parent()->redraw();
        }

        Fl_Font labelfont() {
            return Fl_Input::labelfont();
        }

        void labelfont(Fl_Font f) {
            Fl_Input::labelfont(f);
            parent()->redraw();
        }

        void take_focus() {
            Fl_Input::take_focus();
        }

    };
}

#endif
