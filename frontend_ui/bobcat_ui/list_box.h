#ifndef BOBCAT_UI_LIST_BOX
#define BOBCAT_UI_LIST_BOX

#include "bobcat_ui.h"

// Base on the environment, include the corresponding header files
#if defined(_WIN32)
    #include <FL/Enumerations.H>
    #include <FL/Fl_Hold_Browser.H>
    #include <FL/Fl_Widget.H>
#elif defined(__APPLE__)
    #include <FL/Enumerations.H>
    #include <FL/Fl_Hold_Browser.H>
    #include <FL/Fl_Widget.H>
#else
    #include <FL/Enumerations.H>
    #include <FL/Fl_Hold_Browser.H>
    #include <FL/Fl_Widget.H>
#endif

#include <functional>
#include <string>
#include <iostream>

namespace bobcat {
    class ListBox : public Fl_Hold_Browser {
        std::string caption;
        std::function<void(bobcat::Widget *)> onChangeCb;
        std::function<void(bobcat::Widget *)> onClickCb;
        std::function<void(bobcat::Widget *)> onEnterCb;
        std::function<void(bobcat::Widget *)> onLeaveCb;

        void init() {
            onClickCb = nullptr;
            onEnterCb = nullptr;
            onLeaveCb = nullptr;
            onChangeCb = nullptr;
        }

        int handle(int event) {
            int ret = Fl_Hold_Browser::handle(event);
            if (event == FL_ENTER) {
                if (onEnterCb) onEnterCb(this);
            }

            if (event == FL_LEAVE) {
                if (onLeaveCb) onLeaveCb(this);
            }

            return ret;
        }

    public:
        ListBox(int x, int y, int w, int h, std::string title = "") : Fl_Hold_Browser(x, y, w, h, title.c_str()) {
            init();
            align(FL_ALIGN_TOP_LEFT);
            Fl_Hold_Browser::copy_label(title.c_str());
        }

        std::string label() const {
            return caption;
        }

        void label(std::string s) {
            Fl_Hold_Browser::copy_label(s.c_str());
            caption = s;
        }

        std::string getSelected() const {
            std::string result = "";

            void *item = selection();

            if (item != nullptr) {
                result = item_text(item);
            }

            return result;
        }

        std::string get(int index) {
            return item_text(item_at(index + 1));
        }

        void removeSelected() {
            void *item = selection();
            if (item != nullptr) {
                for (int i = 1; i <= size(); i++) {
                    if (item_at(i) == item) {
                        Fl_Hold_Browser::remove(i);
                        break;
                    }
                }
                if (onChangeCb) onChangeCb(this);
            }
        }

        void add(std::string text) {
            Fl_Hold_Browser::add(text.c_str());
            if (onChangeCb) onChangeCb(this);
        }

        void onChange(std::function<void(bobcat::Widget *)> cb) {
            onChangeCb = cb;
        }

        void onEnter(std::function<void(bobcat::Widget *)> cb) {
            onEnterCb = cb;
        }

        void onLeave(std::function<void(bobcat::Widget *)> cb) {
            onLeaveCb = cb;
        }

        void onClick(std::function<void(bobcat::Widget *)> cb) {
            onClickCb = cb;
            callback([](bobcat::Widget *sender, void *self) {
                ListBox *butt = (ListBox *) self;
                butt->onClickCb(butt);
            }, this);
        }

        void align(Fl_Align alignment) {
            Fl_Hold_Browser::align(alignment);
            parent()->redraw();
        }

        Fl_Fontsize labelsize() {
            return Fl_Hold_Browser::labelsize();
        }

        void labelsize(Fl_Fontsize pix) {
            Fl_Hold_Browser::labelsize(pix);
            parent()->redraw();
        }

        Fl_Color labelcolor() {
            return Fl_Hold_Browser::labelcolor();
        }

        void labelcolor(Fl_Color color) {
            Fl_Hold_Browser::labelcolor(color);
            parent()->redraw();
        }

        Fl_Font labelfont() {
            return Fl_Hold_Browser::labelfont();
        }

        void labelfont(Fl_Font f) {
            Fl_Hold_Browser::labelfont(f);
            parent()->redraw();
        }

        void take_focus() {
            Fl_Hold_Browser::take_focus();
        }

    };
}

#endif
