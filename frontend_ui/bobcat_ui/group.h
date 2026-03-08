#ifndef BOBCAT_UI_GROUP
#define BOBCAT_UI_GROUP

#include "bobcat_ui.h"

// Base on the environment, include the corresponding header files
#if defined(_WIN32)
    #include <FL/Enumerations.H>
    #include <FL/Fl_Gl_Window.H>
    #include <FL/Fl_PNG_Image.H>
    #include <windows.h>
    #include <GL/gl.h>
#elif defined(__APPLE__)
    #include <FL/Enumerations.H>
    #include <FL/Fl_Gl_Window.H>
    #include <FL/Fl_PNG_Image.H>
    #include <OpenGL/gl.h>
#else
    #include <FL/Enumerations.H>
    #include <FL/Fl_Gl_Window.H>
    #include <FL/Fl_PNG_Image.H>
    #include <GL/gl.h>
#endif

#include <string>
#include <functional>

namespace bobcat {

class Group : public Fl_Group {
private:
    std::string caption;

    void init(){
        onChangeCb = nullptr;
        onEnterCb = nullptr;
        onLeaveCb = nullptr;
    }
protected:
    std::function<void(bobcat::Widget *)> onChangeCb;
    std::function<void(bobcat::Widget *)> onEnterCb;
    std::function<void(bobcat::Widget *)> onLeaveCb;

public:
    Group(int x, int y, int w, int h, std::string title = "") : Fl_Group(x, y, w, h, title.c_str()) { 
        init();
        caption = title;
        Fl_Widget::copy_label(caption.c_str());
    }

    void onChange(std::function<void(bobcat::Widget *)> cb) {
        onChangeCb = cb;
    }

    void onEnter(std::function<void(bobcat::Widget *)> cb){
        onEnterCb = cb;
    }

    void onLeave(std::function<void(bobcat::Widget *)> cb){
        onLeaveCb = cb;
    }

    std::string label() const {
        return caption;
    }

    void label(std::string s){
        Fl_Widget::copy_label(s.c_str());
        caption = s;
    }

};



}

#endif