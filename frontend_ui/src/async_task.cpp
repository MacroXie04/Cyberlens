#include "async_task.h"

AsyncRunner& AsyncRunner::instance() {
    static AsyncRunner inst;
    return inst;
}

void AsyncRunner::runVoid(std::function<void()> work_fn,
                           std::function<void()> on_complete) {
    std::thread([this, work_fn, on_complete]() {
        work_fn();
        {
            std::lock_guard<std::mutex> lock(mutex_);
            pendingCallbacks_.push(on_complete);
        }
        Fl::awake(awakeHandler, this);
    }).detach();
}

void AsyncRunner::awakeHandler(void* data) {
    auto* self = static_cast<AsyncRunner*>(data);
    self->drainCallbacks();
}

void AsyncRunner::drainCallbacks() {
    std::queue<std::function<void()>> toRun;
    {
        std::lock_guard<std::mutex> lock(mutex_);
        std::swap(toRun, pendingCallbacks_);
    }
    while (!toRun.empty()) {
        toRun.front()();
        toRun.pop();
    }
}
