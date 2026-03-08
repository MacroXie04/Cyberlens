#ifndef BOBCAT_UI_TEXTBOX
#define BOBCAT_UI_TEXTBOX

#include "bobcat_ui.h"

// Base on the environment, include the corresponding header files
#if defined(_WIN32)
    #include <FL/Enumerations.H>
    #include <FL/Fl.H>
    #include <FL/Fl_Box.H>
    #include <FL/Fl_Widget.H>
#elif defined(__APPLE__)
    #include <FL/Enumerations.H>
    #include <FL/Fl.H>
    #include <FL/Fl_Box.H>
    #include <FL/Fl_Widget.H>
#else
    #include <FL/Enumerations.H>
    #include <FL/Fl.H>
    #include <FL/Fl_Box.H>
    #include <FL/Fl_Widget.H>
#endif

#include <string>
#include <functional>

namespace bobcat {

class TextBox: public Fl_Box{
    std::string caption;

    std::function<void(bobcat::Widget *)> onClickCb;
    std::function<void(bobcat::Widget *)> onEnterCb;
    std::function<void(bobcat::Widget *)> onLeaveCb;

    void init(){
        onClickCb = nullptr;
        onEnterCb = nullptr;
        onLeaveCb = nullptr;
    }

    int handle(int event) {
        if (event == FL_ENTER){
            if (onEnterCb) onEnterCb(this);
        }
        if (event == FL_LEAVE){
            if (onLeaveCb) onLeaveCb(this);
        }

        if (event == FL_PUSH){
            Fl::focus(this);
            return 1;
        }

        if (event == FL_RELEASE){
            if (Fl::event_inside(this)){
                if (Fl::focus() == this){
                    if (onClickCb) onClickCb(this);
                }
            }
        }

        return Fl_Box::handle(event);
    }

public:
    TextBox(int x, int y, int w, int h, std::string caption = ""): Fl_Box(x, y, w, h, caption.c_str()) {
        init();
        Fl_Box::align(FL_ALIGN_INSIDE | FL_ALIGN_LEFT);
        this->caption = caption;
        Fl_Box::copy_label(caption.c_str());
    }

    std::string label() const {
        return caption;
    }

    void label(std::string s){
        Fl_Box::copy_label(s.c_str());
        caption = s;
    }

    void onClick(std::function<void(bobcat::Widget *)> cb){
        onClickCb = cb;
    }

    void onEnter(std::function<void(bobcat::Widget *)> cb){
        onEnterCb = cb;
    }

    void onLeave(std::function<void(bobcat::Widget *)> cb){
        onLeaveCb = cb;
    }
    
    void align(Fl_Align alignment){
        Fl_Box::align(FL_ALIGN_INSIDE | alignment);
        redraw_label();
    }
    
    Fl_Fontsize labelsize() {
        return Fl_Box::labelsize();
    }

    void labelsize(Fl_Fontsize pix) {
        Fl_Box::labelsize(pix);
        redraw_label();
    }

    Fl_Color labelcolor() {
        return Fl_Box::labelcolor();
    }

    void labelcolor(Fl_Color color) {
        Fl_Box::labelcolor(color);
        redraw_label();
    }

    Fl_Font labelfont() {
        return Fl_Box::labelfont();
    }

    void labelfont(Fl_Font f) {
        Fl_Box::labelfont(f);
        redraw_label();
    }

    void take_focus() {
        Fl_Box::take_focus();
    }

};

}

#endif