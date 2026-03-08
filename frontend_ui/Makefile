# ========================================================================================= #
#  Bobcat UI Application Makefile       														#
#  Hongzhe Xie                      														#
#  University of California, Merced    												   		#
# ========================================================================================= #

# ===================================== PROJECT CONFIG ==================================== #
SRC_DIR      := src
TEST_DIR     := test
OBJ_DIR      := objects
LOCAL_BIN    := bin
APP          := app
MAIN         := main
TEST         := test
HEADERS      := $(wildcard $(SRC_DIR)/*.h)
SRC          := $(wildcard $(SRC_DIR)/*.cpp)
OBJ          := $(SRC:$(SRC_DIR)/%.cpp=$(OBJ_DIR)/%.o)
TEST_SRC     := $(wildcard $(TEST_DIR)/*.cpp)
TEST_OBJ     := $(TEST_SRC:$(TEST_DIR)/%.cpp=$(OBJ_DIR)/%.o)
LOCAL_BIN_DIR:= $(LOCAL_BIN)
BIN_DIR      := $(LOCAL_BIN)
OUT          := $(BIN_DIR)/$(APP)
TEST_OUT     := $(BIN_DIR)/$(TEST)

MAKEFLAGS   += --no-print-directory

# ================================ PLATFORM DETECTION ====================================== #
UNAME_S := $(shell uname -s)
ifeq ($(UNAME_S),Darwin)
  # macOS
  CXX        := clang++
  CXXFLAGS   := -Wall `fltk-config --cxxflags` -std=c++17 -DGL_SILENCE_DEPRECATION
  GLFLAGS    := -framework OpenGL
else
  # assume Linux
  CXX        := g++
  CXXFLAGS   := -Wall `fltk-config --cxxflags` -std=c++17
  GLFLAGS    := -lGL -lGLU
endif

LDFLAGS := `fltk-config --ldflags` -lfltk_gl -lfltk_images $(GLFLAGS) -lcurl

# ==================================== RULES ================================================ #

all: $(OUT)

$(OUT): $(OBJ) | $(OBJ_DIR) $(LOCAL_BIN_DIR)
	$(CXX) $(OBJ) -o $(OUT) $(LDFLAGS)

$(OBJ_DIR)/%.o: $(SRC_DIR)/%.cpp | $(OBJ_DIR)
	$(CXX) $(CXXFLAGS) -c $< -o $@

$(OBJ_DIR):
	mkdir -p $(OBJ_DIR)

$(LOCAL_BIN_DIR):
	mkdir -p $(LOCAL_BIN_DIR)

run: all
	@if [ -n "$$TERM" ]; then clear; fi
	@$(LOCAL_BIN_DIR)/$(APP)

test: $(OBJ) $(TEST_OBJ) | $(BIN_DIR) $(LOCAL_BIN_DIR)
	$(CXX) $(filter-out $(OBJ_DIR)/$(MAIN).o,$(OBJ)) $(TEST_OBJ) -o $(TEST_OUT) $(LDFLAGS)
	rm -f $(LOCAL_BIN_DIR)/$(TEST)
	ln -s $(TEST_OUT) $(LOCAL_BIN_DIR)/$(TEST)
	clear
	$(LOCAL_BIN_DIR)/$(TEST) --output=color || true

autograde: clean test
	xvfb-run $(LOCAL_BIN_DIR)/$(TEST) || true

$(OBJ_DIR)/$(TEST).o: $(TEST_DIR)/$(TEST).cpp | $(OBJ_DIR)
	$(CXX) $(CXXFLAGS) -c $< -o $@

clean:
	rm -f $(LOCAL_BIN_DIR)/$(APP) $(OBJ) $(LOCAL_BIN_DIR)/$(TEST) $(TEST_OBJ)
	rmdir $(LOCAL_BIN_DIR) $(OBJ_DIR) 2> /dev/null || true

.PHONY: all run test autograde clean