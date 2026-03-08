#include "http_client.h"
#include <iostream>

std::mutex HttpClient::cookieMutex_;
std::mutex HttpClient::connectMutex_;
std::mutex HttpClient::dnsMutex_;

static void lockFunction(CURL* handle, curl_lock_data data, curl_lock_access access, void* userptr) {
    (void)handle; (void)access; (void)userptr;
    // We use static mutexes keyed by data type
    switch (data) {
        case CURL_LOCK_DATA_COOKIE:
            HttpClient::cookieMutex_.lock();
            break;
        case CURL_LOCK_DATA_CONNECT:
            HttpClient::connectMutex_.lock();
            break;
        case CURL_LOCK_DATA_DNS:
            HttpClient::dnsMutex_.lock();
            break;
        default:
            break;
    }
}

static void unlockFunction(CURL* handle, curl_lock_data data, void* userptr) {
    (void)handle; (void)userptr;
    switch (data) {
        case CURL_LOCK_DATA_COOKIE:
            HttpClient::cookieMutex_.unlock();
            break;
        case CURL_LOCK_DATA_CONNECT:
            HttpClient::connectMutex_.unlock();
            break;
        case CURL_LOCK_DATA_DNS:
            HttpClient::dnsMutex_.unlock();
            break;
        default:
            break;
    }
}

HttpClient& HttpClient::instance() {
    static HttpClient inst;
    return inst;
}

HttpClient::HttpClient() : baseUrl_("http://localhost:8000") {
    curl_global_init(CURL_GLOBAL_ALL);
    shareHandle_ = curl_share_init();
    curl_share_setopt(shareHandle_, CURLSHOPT_SHARE, CURL_LOCK_DATA_COOKIE);
    curl_share_setopt(shareHandle_, CURLSHOPT_SHARE, CURL_LOCK_DATA_DNS);
    curl_share_setopt(shareHandle_, CURLSHOPT_SHARE, CURL_LOCK_DATA_CONNECT);
    curl_share_setopt(shareHandle_, CURLSHOPT_LOCKFUNC, lockFunction);
    curl_share_setopt(shareHandle_, CURLSHOPT_UNLOCKFUNC, unlockFunction);
    curl_share_setopt(shareHandle_, CURLSHOPT_USERDATA, this);
}

HttpClient::~HttpClient() {
    if (shareHandle_) curl_share_cleanup(shareHandle_);
    curl_global_cleanup();
}

void HttpClient::setBaseUrl(const std::string& url) {
    baseUrl_ = url;
}

std::string HttpClient::baseUrl() const {
    return baseUrl_;
}

size_t HttpClient::writeCallback(char* ptr, size_t size, size_t nmemb, void* userdata) {
    auto* response = static_cast<std::string*>(userdata);
    response->append(ptr, size * nmemb);
    return size * nmemb;
}

std::string HttpClient::extractCsrfToken(CURL* curl) {
    struct curl_slist* cookies = nullptr;
    curl_easy_getinfo(curl, CURLINFO_COOKIELIST, &cookies);
    std::string token;
    for (auto* item = cookies; item; item = item->next) {
        std::string line = item->data;
        // Cookie lines are tab-separated: domain\tpath\tsecure\texpiry\tname\tvalue
        auto pos = line.find("csrftoken");
        if (pos != std::string::npos) {
            auto lastTab = line.rfind('\t');
            if (lastTab != std::string::npos) {
                token = line.substr(lastTab + 1);
            }
        }
    }
    curl_slist_free_all(cookies);
    return token;
}

HttpResponse HttpClient::request(const std::string& method, const std::string& path,
                                  const std::string& body) {
    HttpResponse resp;
    CURL* curl = curl_easy_init();
    if (!curl) {
        resp.error = "Failed to init CURL";
        return resp;
    }

    std::string url = baseUrl_ + path;
    std::string responseBody;

    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
    curl_easy_setopt(curl, CURLOPT_SHARE, shareHandle_);
    curl_easy_setopt(curl, CURLOPT_COOKIEFILE, ""); // Enable cookie engine
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, writeCallback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &responseBody);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 30L);

    struct curl_slist* headers = nullptr;
    headers = curl_slist_append(headers, "Content-Type: application/json");

    bool isMutation = (method == "POST" || method == "PUT" || method == "DELETE");
    if (isMutation) {
        std::string csrfToken = extractCsrfToken(curl);
        if (!csrfToken.empty()) {
            std::string hdr = "X-CSRFToken: " + csrfToken;
            headers = curl_slist_append(headers, hdr.c_str());
        }
    }

    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);

    if (method == "POST") {
        curl_easy_setopt(curl, CURLOPT_POST, 1L);
        curl_easy_setopt(curl, CURLOPT_POSTFIELDS, body.c_str());
        curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, (long)body.size());
    } else if (method == "PUT") {
        curl_easy_setopt(curl, CURLOPT_CUSTOMREQUEST, "PUT");
        curl_easy_setopt(curl, CURLOPT_POSTFIELDS, body.c_str());
        curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, (long)body.size());
    } else if (method == "DELETE") {
        curl_easy_setopt(curl, CURLOPT_CUSTOMREQUEST, "DELETE");
    }

    CURLcode res = curl_easy_perform(curl);
    if (res != CURLE_OK) {
        resp.error = curl_easy_strerror(res);
    } else {
        curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &resp.status_code);
        resp.body = responseBody;

        // On 403, retry with fresh CSRF token
        if (isMutation && resp.status_code == 403) {
            responseBody.clear();
            std::string csrfToken = extractCsrfToken(curl);
            if (!csrfToken.empty()) {
                curl_slist_free_all(headers);
                headers = nullptr;
                headers = curl_slist_append(headers, "Content-Type: application/json");
                std::string hdr = "X-CSRFToken: " + csrfToken;
                headers = curl_slist_append(headers, hdr.c_str());
                curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
                res = curl_easy_perform(curl);
                if (res == CURLE_OK) {
                    curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &resp.status_code);
                    resp.body = responseBody;
                    resp.error.clear();
                }
            }
        }
    }

    curl_slist_free_all(headers);
    curl_easy_cleanup(curl);
    return resp;
}

HttpResponse HttpClient::get(const std::string& path) {
    return request("GET", path);
}

HttpResponse HttpClient::post(const std::string& path, const std::string& jsonBody) {
    return request("POST", path, jsonBody);
}

HttpResponse HttpClient::put(const std::string& path, const std::string& jsonBody) {
    return request("PUT", path, jsonBody);
}

HttpResponse HttpClient::del(const std::string& path) {
    return request("DELETE", path);
}
