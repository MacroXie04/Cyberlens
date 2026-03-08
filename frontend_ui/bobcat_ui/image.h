#ifndef BOBCAT_UI_IMAGE
#define BOBCAT_UI_IMAGE

#include "textbox.h"

// Base on the environment, include the corresponding header files
#if defined(_WIN32)
    #include <FL/Fl_PNG_Image.H>
#elif defined(__APPLE__)
    #include <FL/Fl_PNG_Image.H>
#else
    #include <FL/Fl_PNG_Image.H>
#endif
#include <string>
#include <iostream>

namespace bobcat {

class Image : public TextBox{
    Fl_PNG_Image *original;
    Fl_PNG_Image *img;
    std::string fname;


public:
    Image(int x, int y, int w, int h, std::string filename, std::string title = "" ) : TextBox(x, y, w, h, title.c_str()){
        align(FL_ALIGN_CENTER);
        fname = filename;
        original = new Fl_PNG_Image(filename.c_str());

        img = (Fl_PNG_Image*)original->copy();

        Fl_Image *temp;
        if (img->w() > img->h()) {
            temp = img->copy(Fl_Box::w(), Fl_Box::h() * img->h() / img->w());
        } else {
            temp = img->copy(Fl_Box::w() * img->w() / img->h(), Fl_Box::h());
        }
        delete img;
        img = (Fl_PNG_Image *)temp;

        image(img);

        Fl_Box::align(FL_ALIGN_IMAGE_MASK);
    }

    void increase(int amount = 10){
        hide();
        w(w() + amount);
        h(h() + amount);

        delete img;
        img = (Fl_PNG_Image*)original->copy();

        Fl_Image *temp;
        if (img->w() > img->h()) {
            temp = img->copy(Fl_Box::w(), Fl_Box::h() * img->h() / img->w());
        } else {
            temp = img->copy(Fl_Box::w() * img->w() / img->h(), Fl_Box::h());
        }
        delete img;
        img = (Fl_PNG_Image *)temp;
        image(img);
        show();
    }

    void decrease(int amount = 10){
        hide();
        w(w() - amount);
        h(h() - amount);

        delete img;
        img = new Fl_PNG_Image(fname.c_str());

        Fl_Image *temp;
        if (img->w() > img->h()) {
            temp = img->copy(Fl_Box::w(), Fl_Box::h() * img->h() / img->w());
        } else {
            temp = img->copy(Fl_Box::w() * img->w() / img->h(), Fl_Box::h());
        }
        delete img;
        img = (Fl_PNG_Image *)temp;
        image(img);
        show();
    }

    void moveLeft(int amount = 10){
        hide();
        x(x() - amount);
        show();
    }

    void moveRight(int amount = 10){
        hide();
        x(x() + amount);
        show();
    }

    void setImage(std::string filename){
        delete original;
        fname = filename;
        original = new Fl_PNG_Image(filename.c_str());
        img = (Fl_PNG_Image*)original->copy();

        Fl_Image *temp;
        if (img->w() > img->h()) {
            temp = img->copy(Fl_Box::w(), Fl_Box::h() * img->h() / img->w());
        } else {
            temp = img->copy(Fl_Box::w() * img->w() / img->h(), Fl_Box::h());
        }
        delete img;
        img = (Fl_PNG_Image *)temp;
        hide();
        image(img);
        redraw();
        show();
    }

    void align(Fl_Align alignment){
        Fl_Box::align(alignment);
        parent()->redraw();
    }

    Fl_Fontsize labelsize() {
        return Fl_Box::labelsize();
    }

    void labelsize(Fl_Fontsize pix) {
        Fl_Box::labelsize(pix);
        parent()->redraw();
    }

    Fl_Color labelcolor() {
        return Fl_Box::labelcolor();
    }

    void labelcolor(Fl_Color color) {
        Fl_Box::labelcolor(color);
        parent()->redraw();
    }

    Fl_Font labelfont() {
        return Fl_Box::labelfont();
    }

    void labelfont(Fl_Font f) {
        Fl_Box::labelfont(f);
        parent()->redraw();
    }

};

}

#endif