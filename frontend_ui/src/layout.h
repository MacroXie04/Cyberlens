#ifndef CYBERLENS_LAYOUT_H
#define CYBERLENS_LAYOUT_H

namespace layout {

// Main window
constexpr int WIN_W = 1280;
constexpr int WIN_H = 800;

// Login window
constexpr int LOGIN_W = 400;
constexpr int LOGIN_H = 380;

// Header bar
constexpr int HDR_Y = 0;
constexpr int HDR_H = 50;

// Content area (below header)
constexpr int CONTENT_Y = 55;
constexpr int CONTENT_H = WIN_H - CONTENT_Y;

// Margins and spacing
constexpr int MARGIN = 15;
constexpr int GAP = 10;
constexpr int SECTION_GAP = 20;

// Widget heights
constexpr int INPUT_H = 30;
constexpr int BUTTON_H = 32;
constexpr int LABEL_H = 20;
constexpr int DROPDOWN_H = 30;

// Tab buttons in header
constexpr int TAB_BTN_W = 120;
constexpr int TAB_BTN_H = 32;
constexpr int TAB_BTN_Y = 9;

// Settings tab sections
constexpr int SECTION_W = 600;

// Scan tab
constexpr int SCAN_HISTORY_W = 300;

// Monitor tab
constexpr int KPI_BOX_W = 180;
constexpr int KPI_BOX_H = 60;
constexpr int KPI_ROW_Y = CONTENT_Y + 50;

// Detail panel
constexpr int DETAIL_Y = 480;
constexpr int DETAIL_H = CONTENT_H - (DETAIL_Y - CONTENT_Y);

}

#endif
