#ifndef CYBERLENS_ASYNC_TASK_H
#define CYBERLENS_ASYNC_TASK_H

#include <FL/Fl.H>
#include <functional>
#include <mutex>
#include <queue>
#include <thread>

class AsyncRunner {
public:
    static AsyncRunner& instance();

    // Run work_fn on a background thread, then invoke on_complete on the main thread
    template<typename Result>
    void run(std::function<Result()> work_fn,
             std::function<void(Result)> on_complete) {
        std::thread([this, work_fn, on_complete]() {
            Result result = work_fn();
            {
                std::lock_guard<std::mutex> lock(mutex_);
                pendingCallbacks_.push([on_complete, result]() {
                    on_complete(result);
                });
            }
            Fl::awake(awakeHandler, this);
        }).detach();
    }

    // Specialization for void return
    void runVoid(std::function<void()> work_fn,
                 std::function<void()> on_complete);

    void drainCallbacks();

private:
    AsyncRunner() = default;
    static void awakeHandler(void* data);

    std::mutex mutex_;
    std::queue<std::function<void()>> pendingCallbacks_;
};

#endif
