#ifndef BOBCAT_UI_CANVAS
#define BOBCAT_UI_CANVAS

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

class Canvas_ : public Fl_Gl_Window {
    std::function<void(bobcat::Widget *)> onShowCb;
    std::function<void(bobcat::Widget *)> onHideCb;
    std::function<void(bobcat::Widget *)> willHideCb;
    std::function<void(bobcat::Widget *, float, float)> onMouseDownCb;
    std::function<void(bobcat::Widget *, float, float)> onDragCb;
    std::function<void(bobcat::Widget *, float, float)> onMouseUpCb;

    std::string caption;

    void init(){
        onShowCb = nullptr;
        onHideCb = nullptr;
        willHideCb = nullptr;
        onDragCb = nullptr;
        onMouseDownCb = nullptr;
        onDragCb = nullptr;
        onMouseUpCb = nullptr;
    }

public:
    Canvas_(int w, int h, std::string title = "") : Fl_Gl_Window(w, h, title.c_str()) {
        init(); 
        caption = title; 
        Fl_Gl_Window::copy_label(title.c_str());
    }

    Canvas_(int x, int y, int w, int h, std::string title = "") : Fl_Gl_Window(x, y, w, h, title.c_str()) {
        init(); 
        caption = title;
        Fl_Gl_Window::copy_label(title.c_str());
    }

    virtual void render() = 0;

    int handle(int event) override {
        // printf("Event was %s - %d\n", fl_eventnames[event], event);
        int ret = Fl_Gl_Window::handle(event);

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

        // if (event == FL_PUSH){
        //     Fl::focus(this);
        // }

        float x = (2.0f * (Fl::event_x() / float(w()))) - 1.0f;
        float y = 1.0f - (2.0f * (Fl::event_y() / float(h())));

        if (x >= -1.0 && x <= 1.0 && y >= -1.0 && y <= 1.0) {
            if (event == FL_RELEASE){
                if (onMouseUpCb) onMouseUpCb(this, x, y);
            }
            if (event == FL_PUSH){
                if (onMouseDownCb) onMouseDownCb(this, x, y);
                return 1;
            }
            if (event == FL_DRAG) {
                if (onDragCb) onDragCb(this, x, y);
            }
        }

        return ret;
    }

    void draw() override {
        glClearColor(1.0f, 1.0f, 1.0f, 1.0f);
        glClear(GL_COLOR_BUFFER_BIT|GL_DEPTH_BUFFER_BIT);

        glEnable(GL_BLEND);
        glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);

        glEnable(GL_POINT_SMOOTH);
        glPointSize(7.0f);
        glColor3f(0.0f, 0.0f, 0.0f);

        render();

        swap_buffers();
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
            Canvas_ *win = (Canvas_ *)self;
            win->willHideCb(win);
        }, this);   
    }

    void onDrag(std::function<void(bobcat::Widget *, float, float)> cb){
        onDragCb = cb;
    }

    void onMouseDown(std::function<void(bobcat::Widget *, float, float)> cb){
        onMouseDownCb = cb;
    }

    void onMouseUp(std::function<void(bobcat::Widget *, float, float)> cb){
        onMouseUpCb = cb;
    }

    std::string label() const {
        return caption;
    }

    void label(std::string s){
        Fl_Gl_Window::copy_label(s.c_str());
        caption = s;
    }

    void show() override {
        Fl_Gl_Window::show();
        wait_for_expose();          // Supposedly makes show() synchronous
        Fl::flush();                // Make sure to draw what needs to be drawn
    }

};



}

#endif