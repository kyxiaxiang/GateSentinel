package config

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
)

type Config struct {
	DBPath        string `json:"db_path"`
	AdminUser     string `json:"admin_user"`
	AdminPass     string `json:"admin_pass"`
	ClientToken   string `json:"client_token"`
	JWTSecret     string `json:"jwt_secret"`
	WebhookURL    string `json:"webhook_url"`
	WebhookKey    string `json:"webhook_key"`
	WebhookEnable bool   `json:"webhook_enable"`

	// 配置项
	Server          ServerConfig          `json:"server"`
	Routes          RoutesConfig          `json:"routes"`
	Encoding        EncodingConfig        `json:"encoding"`
	TrafficDisguise TrafficDisguiseConfig `json:"traffic_disguise"`
}

type ServerConfig struct {
	Host         string `json:"host"`
	Port         int    `json:"port"`
	ReadTimeout  int    `json:"read_timeout"`
	WriteTimeout int    `json:"write_timeout"`
	MaxBodySize  int    `json:"max_body_size"`
	EnableHTTPS  bool   `json:"enable_https"`
	HTTPSPort    int    `json:"https_port"`
	CertFile     string `json:"cert_file"`
	KeyFile      string `json:"key_file"`
}

type RoutesConfig struct {
	AdminPrefix    string `json:"admin_prefix"`
	APIPrefix      string `json:"api_prefix"`
	BeaconEndpoint string `json:"beacon_endpoint"`
	RegisterPath   string `json:"register_path"`
	LoginPath      string `json:"login_path"`
}

type EncodingConfig struct {
	CustomBase64Table string `json:"custom_base64_table"`
	UseCustomBase64   bool   `json:"use_custom_base64"`
}

type TrafficDisguiseConfig struct {
	Enable bool   `json:"enable"`
	Prefix string `json:"prefix"`
	Suffix string `json:"suffix"`
}

var GlobalConfig = &Config{
	DBPath:      "./gatesentinel.db",
	AdminUser:   "admin",
	AdminPass:   "admin123",
	ClientToken: "Demo",
	JWTSecret:   "GateSentinel-JWT-Secret-Key-2025-Change-This-In-Production",
	Server: ServerConfig{
		Host:         "0.0.0.0",
		Port:         8080,
		ReadTimeout:  60,
		WriteTimeout: 60,
		MaxBodySize:  10, // MB
		EnableHTTPS:  false,
		HTTPSPort:    8443,
		CertFile:     "./certs/server.crt",
		KeyFile:      "./certs/server.key",
	},
	Routes: RoutesConfig{
		AdminPrefix:    "/web/admin",
		APIPrefix:      "/web/admin/api",
		BeaconEndpoint: "/api.jsp",
		RegisterPath:   "/register",
		LoginPath:      "/login",
	},
	Encoding: EncodingConfig{
		CustomBase64Table: "QWERTYUIOPASDFGHJKLZXCVBNMqwertyuiopasdfghjklzxcvbnm0123456789+/",
		UseCustomBase64:   true,
	},
	TrafficDisguise: TrafficDisguiseConfig{
		Enable: true,
		Prefix: "<!--",
		Suffix: "-->",
	},
}

func Init() error {
	// 尝试加载配置文件
	if err := loadConfigFromFile("config.json"); err != nil {
		log.Printf("Warning: Failed to load config.json, using defaults: %v", err)
		// 创建默认配置文件
		if err := saveConfigToFile("config.json"); err != nil {
			log.Printf("Warning: Failed to create default config.json: %v", err)
		}
	}

	return nil
}

func loadConfigFromFile(filename string) error {
	data, err := ioutil.ReadFile(filename)
	if err != nil {
		return err
	}

	return json.Unmarshal(data, GlobalConfig)
}

func saveConfigToFile(filename string) error {
	data, err := json.MarshalIndent(GlobalConfig, "", "  ")
	if err != nil {
		return err
	}

	return ioutil.WriteFile(filename, data, 0644)
}

// SaveConfig 保存当前配置到文件
func SaveConfig() error {
	return saveConfigToFile("config.json")
}

// GetServerAddress 获取服务器监听地址
func GetServerAddress() string {
	return fmt.Sprintf("%s:%d", GlobalConfig.Server.Host, GlobalConfig.Server.Port)
}

// GetHTTPSServerAddress 获取HTTPS服务器监听地址
func GetHTTPSServerAddress() string {
	return fmt.Sprintf("%s:%d", GlobalConfig.Server.Host, GlobalConfig.Server.HTTPSPort)
}

// IsHTTPSEnabled 检查是否启用HTTPS
func IsHTTPSEnabled() bool {
	return GlobalConfig.Server.EnableHTTPS
}
