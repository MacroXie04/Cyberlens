#ifndef CYBERLENS_HTTP_CLIENT_H
#define CYBERLENS_HTTP_CLIENT_H

#include <string>
#include <mutex>
#include <curl/curl.h>

struct HttpResponse {
    long status_code = 0;
    std::string body;
    std::string error;
    bool ok() const { return status_code >= 200 && status_code < 300; }
};

class HttpClient {
public:
    static HttpClient& instance();

    void setBaseUrl(const std::string& url);
    std::string baseUrl() const;

    HttpResponse get(const std::string& path);
    HttpResponse post(const std::string& path, const std::string& jsonBody = "");
    HttpResponse put(const std::string& path, const std::string& jsonBody = "");
    HttpResponse del(const std::string& path);

    // Public for CURLSH lock/unlock callbacks
    static std::mutex cookieMutex_;
    static std::mutex connectMutex_;
    static std::mutex dnsMutex_;

private:
    HttpClient();
    ~HttpClient();
    HttpClient(const HttpClient&) = delete;
    HttpClient& operator=(const HttpClient&) = delete;

    HttpResponse request(const std::string& method, const std::string& path,
                         const std::string& body = "");

    std::string extractCsrfToken(CURL* curl);

    static size_t writeCallback(char* ptr, size_t size, size_t nmemb, void* userdata);

    std::string baseUrl_;
    CURLSH* shareHandle_;
    std::mutex shareMutex_;
};

#endif
