package utils

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"sync"
)

// Config 配置结构体
type Config struct {
	DBPath        string `json:"db_path"`
	AdminUser     string `json:"admin_user"`
	AdminPass     string `json:"admin_pass"`
	ClientToken   string `json:"client_token"`
	JWTSecret     string `json:"jwt_secret"`
	WebhookURL    string `json:"webhook_url"`
	WebhookKey    string `json:"webhook_key"`
	WebhookEnable bool   `json:"webhook_enable"`

	Server struct {
		Host         string `json:"host"`
		Port         int    `json:"port"`
		ReadTimeout  int    `json:"read_timeout"`
		WriteTimeout int    `json:"write_timeout"`
		MaxBodySize  int    `json:"max_body_size"`
	} `json:"server"`

	Routes struct {
		AdminPrefix    string `json:"admin_prefix"`
		APIPrefix      string `json:"api_prefix"`
		BeaconEndpoint string `json:"beacon_endpoint"`
		RegisterPath   string `json:"register_path"`
		LoginPath      string `json:"login_path"`
	} `json:"routes"`

	Encoding struct {
		CustomBase64Table string `json:"custom_base64_table"`
		UseCustomBase64   bool   `json:"use_custom_base64"`
	} `json:"encoding"`

	TrafficDisguise struct {
		Enable bool   `json:"enable"`
		Prefix string `json:"prefix"`
		Suffix string `json:"suffix"`
	} `json:"traffic_disguise"`
}

var (
	globalConfig *Config
	configMutex  sync.RWMutex
)

// LoadConfig 加载配置文件
func LoadConfig(configPath string) (*Config, error) {
	data, err := ioutil.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("读取配置文件失败: %v", err)
	}

	var config Config
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("解析配置文件失败: %v", err)
	}

	// 验证自定义Base64编码表
	if config.Encoding.UseCustomBase64 {
		if len(config.Encoding.CustomBase64Table) != 64 {
			return nil, fmt.Errorf("自定义Base64编码表长度必须为64个字符，当前长度: %d",
				len(config.Encoding.CustomBase64Table))
		}

		// 检查编码表字符是否唯一
		charMap := make(map[rune]bool)
		for _, char := range config.Encoding.CustomBase64Table {
			if charMap[char] {
				return nil, fmt.Errorf("自定义Base64编码表包含重复字符: %c", char)
			}
			charMap[char] = true
		}

		log.Printf("使用自定义Base64编码表: %s", config.Encoding.CustomBase64Table)
	} else {
		log.Println("使用标准Base64编码表")
	}

	// 设置全局配置
	configMutex.Lock()
	globalConfig = &config
	configMutex.Unlock()

	return &config, nil
}

// GetConfig 获取全局配置
func GetConfig() *Config {
	configMutex.RLock()
	defer configMutex.RUnlock()
	return globalConfig
}

// UpdateCustomBase64Table 更新自定义Base64编码表
func UpdateCustomBase64Table(newTable string) error {
	if len(newTable) != 64 {
		return fmt.Errorf("Base64编码表长度必须为64个字符")
	}

	// 检查字符唯一性
	charMap := make(map[rune]bool)
	for _, char := range newTable {
		if charMap[char] {
			return fmt.Errorf("编码表包含重复字符: %c", char)
		}
		charMap[char] = true
	}

	configMutex.Lock()
	defer configMutex.Unlock()

	if globalConfig != nil {
		globalConfig.Encoding.CustomBase64Table = newTable
		globalConfig.Encoding.UseCustomBase64 = true
		log.Printf("已更新自定义Base64编码表: %s", newTable)
	}

	return nil
}

// SaveConfig 保存配置到文件
func SaveConfig(configPath string) error {
	configMutex.RLock()
	config := globalConfig
	configMutex.RUnlock()

	if config == nil {
		return fmt.Errorf("配置未初始化")
	}

	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return fmt.Errorf("序列化配置失败: %v", err)
	}

	if err := ioutil.WriteFile(configPath, data, 0644); err != nil {
		return fmt.Errorf("写入配置文件失败: %v", err)
	}

	log.Printf("配置已保存到: %s", configPath)
	return nil
}
