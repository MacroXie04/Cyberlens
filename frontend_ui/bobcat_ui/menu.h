#ifndef BOBCAT_UI_MENU
#define BOBCAT_UI_MENU

#include "bobcat_ui.h"

// Base on the environment, include the corresponding header files
#if defined(_WIN32)
    #include <FL/Enumerations.H>
    #include <FL/Fl_Menu_Bar.H>
    #include <FL/Fl_Widget.H>
#elif defined(__APPLE__)
    #include <FL/Enumerations.H>
    #include <FL/Fl_Menu_Bar.H>
    #include <FL/Fl_Widget.H>
#else
    #include <FL/Enumerations.H>
    #include <FL/Fl_Menu_Bar.H>
    #include <FL/Fl_Widget.H>
#endif

#include <map>
#include <vector>
#include <functional>
#include <iostream>

namespace bobcat{

class MenuItem : public Fl_Widget {
    std::string caption;
    std::function<void(bobcat::Widget *)> onClickCb;

public:
    MenuItem(std::string caption) : Fl_Widget(0,0,0,0, caption.c_str()){
        onClickCb = nullptr;
        Fl_Widget::copy_label(caption.c_str());
        this->caption = caption;
    }

    void onClick(std::function<void(bobcat::Widget *)> cb){
        onClickCb = cb;
    }

    std::string label() const {
        return caption;
    }

    void label(std::string s){
        Fl_Widget::copy_label(s.c_str());
        caption = s;
    }

    void draw() {}

    friend class Menu;
    friend struct ::AppTest;
};

class Menu : public Fl_Menu_Bar {
    std::map<int, MenuItem*> items;

    static void handler(Fl_Widget *sender, void *data){
        Fl_Menu_Bar *bar = (Fl_Menu_Bar *)sender;
        int index = bar->value();

        Menu *self = (Menu *)data;
        MenuItem *curr = self->items[index];
        if (curr->onClickCb) curr->onClickCb(curr);
    }
    std::vector<std::string> split(std::string s, char c = ' '){
        const char *str = s.c_str();
        std::vector<std::string> result;

        do
        {
            const char *begin = str;

            while(*str != c && *str)
                str++;

            result.push_back(std::string(begin, str));
        } while (0 != *str++);

        return result;
    }

    std::string addPadding(std::string s){
        std::vector<std::string> tokens = split(s, '/');
        std::string result = tokens[0] + "/";

        for (unsigned long i = 1; i < tokens.size(); i++){
            result += tokens[i] + "            ";
            if (i < tokens.size() - 1){
                result += "/";
            }
        }

        return result;
    }

public:
    Menu() : Fl_Menu_Bar(0, 0, 0, 0){
        int pw = ((Fl_Widget *)parent())->w() + 4;
        box(FL_THIN_UP_BOX);
        resize(-2, 0, pw, 25);
    }

    void addItem(MenuItem *item){
        int pos =  add(addPadding(item->label()).c_str(), 0, handler, this);
        items.insert(std::pair<int, MenuItem*>(pos, item));
    }

    void addItemSep(MenuItem *item){
        int pos =  add(addPadding(item->label()).c_str(), 0, handler, this, FL_MENU_DIVIDER);
        items.insert(std::pair<int, MenuItem*>(pos, item));
    }

};

}

#endif