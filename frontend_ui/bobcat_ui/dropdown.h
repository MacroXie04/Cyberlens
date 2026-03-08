#ifndef BOBCAT_UI_DROPDOWN
#define BOBCAT_UI_DROPDOWN

#include "bobcat_ui.h"

// Base on the environment, include the corresponding header files
#if defined(_WIN32)
  #include <FL/Enumerations.H>
  #include <FL/Fl_Choice.H>
  #include <FL/Fl_Widget.H>
#elif defined(__APPLE__)
  #include <FL/Enumerations.H>
  #include <FL/Fl_Choice.H>
  #include <FL/Fl_Widget.H>
#else
  #include <FL/Enumerations.H>
  #include <FL/Fl_Choice.H>
  #include <FL/Fl_Widget.H>
#endif

#include <string>
#include <functional>

// #include <FL/names.h>

namespace bobcat {

class Dropdown: public Fl_Choice{
    std::string caption;

    std::function<void(bobcat::Widget *)> onEnterCb;
    std::function<void(bobcat::Widget *)> onLeaveCb;
    std::function<void(bobcat::Widget *)> onChangeCb;

    void init(){
        onEnterCb = nullptr;
        onLeaveCb = nullptr;
        onChangeCb = nullptr;
    }

    int handle(int event) {
        // if (event == 8 || event == 9)
        // printf("Event was %s (%d) - %s\n", fl_eventnames[event], event, value());
        int ret = Fl_Choice::handle(event);
        if (event == FL_ENTER){
            if (onEnterCb) onEnterCb(this);
        }

        if (event == FL_LEAVE){
            if (onLeaveCb) onLeaveCb(this);
        }

        return ret;
    }

public:
    Dropdown(int x, int y, int w, int h, std::string caption = ""): Fl_Choice(x, y, w, h, caption.c_str()) {
        init();
        align(FL_ALIGN_TOP_LEFT);
        this->caption = caption;
        Fl_Choice::copy_label(caption.c_str());
    }

    std::string label() const {
        return caption;
    }

    void label(std::string s){
        Fl_Choice::copy_label(s.c_str());
        caption = s;
    }

    std::string text() const {
        std::string temp = Fl_Choice::text();
        return temp;
    }

    int add(std::string item){
        int index = Fl_Choice::add(item.c_str());
        if (index == 0) Fl_Choice::value(0);
        return index;
    }

    void value(int index){
        Fl_Choice::value(index);
        if (onChangeCb) onChangeCb(this);
    }

    void text(std::string s){
        int i = Fl_Choice::find_index(s.c_str());
        Fl_Choice::value(i);
        if (onChangeCb) onChangeCb(this);
    }

    int value(){
        return Fl_Choice::value();
    }

    void remove(int i) {
        Fl_Choice::remove(i);
    }

    void remove(std::string s) {
        int i = Fl_Choice::find_index(s.c_str());
        if (i != -1) {
            Fl_Choice::remove(i);
        }
    }

    void onEnter(std::function<void(bobcat::Widget *)> cb){
        onEnterCb = cb;
    }

    void onLeave(std::function<void(bobcat::Widget *)> cb){
        onLeaveCb = cb;
    }

    void onChange(std::function<void(bobcat::Widget *)> cb){
        onChangeCb = cb;
        when(FL_WHEN_CHANGED);
        callback([](bobcat::Widget* sender, void* self){
            Dropdown *dd = (Dropdown*) self;
            dd->onChangeCb(dd);
        }, this);
    }

    void align(Fl_Align alignment){
        Fl_Choice::align(alignment);
        parent()->redraw();
    }

    Fl_Fontsize labelsize() {
        return Fl_Choice::labelsize();
    }

    void labelsize(Fl_Fontsize pix) {
        Fl_Choice::labelsize(pix);
        parent()->redraw();
    }

    Fl_Color labelcolor() {
        return Fl_Choice::labelcolor();
    }

    void labelcolor(Fl_Color color) {
        Fl_Choice::labelcolor(color);
        parent()->redraw();
    }

    Fl_Font labelfont() {
        return Fl_Choice::labelfont();
    }

    void labelfont(Fl_Font f) {
        Fl_Choice::labelfont(f);
        parent()->redraw();
    }

    void take_focus() {
        Fl_Choice::take_focus();
    }

};

}

#endif