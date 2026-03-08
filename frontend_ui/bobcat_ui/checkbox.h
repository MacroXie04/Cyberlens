#ifndef BOBCAT_UI_CHECKBOX
#define BOBCAT_UI_CHECKBOX

#include "bobcat_ui.h"

// Base on the environment, include the corresponding header files
#if defined(_WIN32)
    #include <FL/Fl_Check_Button.H>
#elif defined(__APPLE__)
    #include <FL/Fl_Check_Button.H>
#else
    #include <FL/Fl_Check_Button.H>
#endif

#include <string>
#include <functional>

namespace bobcat {

class Checkbox: public Fl_Check_Button{
    std::string caption;

    std::function<void(bobcat::Widget *)> onClickCb;
    std::function<void(bobcat::Widget *)> onEnterCb;
    std::function<void(bobcat::Widget *)> onLeaveCb;
    std::function<void(bobcat::Widget *)> onChangeCb;

    void init(){
        onClickCb = nullptr;
        onEnterCb = nullptr;
        onLeaveCb = nullptr;
        onChangeCb = nullptr;
    }

    int handle(int event) {
        int ret = Fl_Check_Button::handle(event);

        if (event == FL_ENTER){
            if (onEnterCb) onEnterCb(this);
        }
        if (event == FL_LEAVE){
            if (onLeaveCb) onLeaveCb(this);
        }
        return ret;
    }

public:
    Checkbox(int x, int y, int w, int h, std::string caption = ""): Fl_Check_Button(x, y, w, h, caption.c_str()) {
        init();
        this->caption = caption;
        Fl_Check_Button::copy_label(caption.c_str());
    }

    std::string label() const {
        return caption;
    }

    void label(std::string s){
        Fl_Check_Button::copy_label(s.c_str());
        caption = s;
    }

    void onClick(std::function<void(bobcat::Widget *)> cb){
        onClickCb = cb;
        callback([](bobcat::Widget* sender, void* self){
            Checkbox* butt = (Checkbox*) self;
            butt->onClickCb(butt);
        }, this);
    }

    void onEnter(std::function<void(bobcat::Widget *)> cb){
        onEnterCb = cb;
    }

    void onLeave(std::function<void(bobcat::Widget *)> cb){
        onLeaveCb = cb;
    }

    bool checked() const {
        return value() == 1;
    }

    void check() {
        set();
        if (onChangeCb) onChangeCb(this);
    }
    
    void uncheck(){
        clear();
        if (onChangeCb) onChangeCb(this);
    }

    void onChange(std::function<void(bobcat::Widget *)> cb){
        onChangeCb = cb;
        when(FL_WHEN_CHANGED);
        callback([](bobcat::Widget* sender, void* self){
            Checkbox *in = (Checkbox*) self;
            in->onChangeCb(in);
        }, this);
    }

    void align(Fl_Align alignment){
        Fl_Check_Button::align(alignment);
        parent()->redraw();
    }

    Fl_Fontsize labelsize() {
        return Fl_Check_Button::labelsize();
    }

    void labelsize(Fl_Fontsize pix) {
        Fl_Check_Button::labelsize(pix);
        parent()->redraw();
    }

    Fl_Color labelcolor() {
        return Fl_Check_Button::labelcolor();
    }

    void labelcolor(Fl_Color color) {
        Fl_Check_Button::labelcolor(color);
        parent()->redraw();
    }

    Fl_Font labelfont() {
        return Fl_Check_Button::labelfont();
    }

    void labelfont(Fl_Font f) {
        Fl_Check_Button::labelfont(f);
        parent()->redraw();
    }

    void take_focus() {
        Fl_Check_Button::take_focus();
    }

};

}

#endif