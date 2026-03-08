#ifndef BOBCAT_UI_HEXAGON_BUTTON
#define BOBCAT_UI_HEXAGON_BUTTON

#include "bobcat_ui.h"

// Base on the environment, include the corresponding header files
#if defined(_WIN32)
    #include <FL/Enumerations.H>
    #include <FL/Fl_Group.H>
    #include <FL/Fl_Light_Button.H>
    #include <FL/fl_draw.H>
    #include <FL/Fl_Button.H>
#elif defined(__APPLE__)
    #include <FL/Enumerations.H>
    #include <FL/Fl_Group.H>
    #include <FL/Fl_Light_Button.H>
    #include <FL/fl_draw.H>
    #include <FL/Fl_Button.H>
#else
    #include <FL/Enumerations.H>
    #include <FL/Fl_Group.H>
    #include <FL/Fl_Light_Button.H>
    #include <FL/fl_draw.H>
    #include <FL/Fl_Button.H>
#endif

#include <string>
#include <functional>
#include <cmath>

namespace bobcat {

class HexagonButton: public Fl_Button{
    std::string caption;

    std::function<void(bobcat::Widget *)> onClickCb;
    std::function<void(bobcat::Widget *)> onEnterCb;
    std::function<void(bobcat::Widget *)> onLeaveCb;

    void init(){
        onClickCb = nullptr;
        onEnterCb = nullptr;
        onLeaveCb = nullptr;
    }

    int handle(int event) override {
        int ret = Fl_Button::handle(event);

        if (event == FL_ENTER){
            if (onEnterCb) onEnterCb(this);
        }
        if (event == FL_LEAVE){
            if (onLeaveCb) onLeaveCb(this);
        }
        return ret;
    }

void draw_hexagon(int x, int y, int w, int h) {
        fl_color(Fl_Button::color());
        fl_begin_polygon();
        for (int i = 0; i < 6; ++i) {
            double angle = M_PI / 3 * i;
            int px = x + w / 2 + (w / 2) * cos(angle);
            int py = y + h / 2 + (h / 2) * sin(angle);
            fl_vertex(px, py);
        }
        fl_end_polygon();

        // Draw the border
        fl_color(Fl_Button::labelcolor());
        fl_begin_line();
        for (int i = 0; i <= 6; ++i) {
            double angle = M_PI / 3 * i;
            int px = x + w / 2 + (w / 2) * cos(angle);
            int py = y + h / 2 + (h / 2) * sin(angle);
            fl_vertex(px, py);
        }
        fl_end_line();
}

public:
    HexagonButton(int x, int y, int w, int h, std::string caption = ""): Fl_Button(x, y, w, h, caption.c_str()) {
        init();
        this->caption = caption;
        Fl_Button::copy_label(caption.c_str());
    }

    void draw() override {
        draw_hexagon(x(), y(), w(), h());

        // Draw the label
        fl_font(Fl_Button::labelfont(), 28);
        align(Fl_Button::align());
        fl_draw(label().c_str(), x() + (w() / 2) - 9, y() + (h() / 2) + 9);
    }

    std::string label() const {
        return caption;
    }

    void label(std::string s){
        Fl_Button::copy_label(s.c_str());
        caption = s;
    }

    void onClick(std::function<void(bobcat::Widget *)> cb){
        onClickCb = cb;
        callback([](bobcat::Widget* sender, void* self){
            HexagonButton* butt = (HexagonButton*) self;
            butt->onClickCb(butt);
        }, this);
    }

    void onEnter(std::function<void(bobcat::Widget *)> cb){
        onEnterCb = cb;
    }

    void onLeave(std::function<void(bobcat::Widget *)> cb){
        onLeaveCb = cb;
    }

    void align(Fl_Align alignment){
        Fl_Button::align(alignment);
        parent()->redraw();
    }

    Fl_Fontsize labelsize() {
        return Fl_Button::labelsize();
    }

    void labelsize(Fl_Fontsize pix) {
        Fl_Button::labelsize(pix);
        parent()->redraw();
    }

    Fl_Color labelcolor() {
        return Fl_Button::labelcolor();
    }

    void labelcolor(Fl_Color color) {
        Fl_Button::labelcolor(color);
        parent()->redraw();
    }

    Fl_Font labelfont() {
        return Fl_Button::labelfont();
    }

    void labelfont(Fl_Font f) {
        Fl_Button::labelfont(f);
        parent()->redraw();
    }

    void take_focus() {
        Fl_Button::take_focus();
    }

};

}

#endif