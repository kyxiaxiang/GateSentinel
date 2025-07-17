package main

import (
	"gatesentinel/config"
	"gatesentinel/db"
	"log"
	"net"
	"net/http"
	"time"
)

func main() {
	// 设置为release模式（必须在创建gin实例前设置）
	//gin.SetMode(gin.ReleaseMode)

	// 初始化配置
	if err := config.Init(); err != nil {
		log.Fatalf("Failed to init config: %v", err)
	}

	// 初始化数据库
	if err := db.Init(); err != nil {
		log.Fatalf("Failed to init database: %v", err)
	}

	// 设置路由
	r := setupRouter()

	// 设置受信任代理
	// 仅信任本地回环地址和私有网络
	trustedCIDRs := []string{
		"127.0.0.1/8",    // IPv4 回环地址
		"10.0.0.0/8",     // RFC1918 私有网络
		"172.16.0.0/12",  // RFC1918 私有网络
		"192.168.0.0/16", // RFC1918 私有网络
	}

	trustedProxies := make([]string, 0)
	for _, cidr := range trustedCIDRs {
		_, network, err := net.ParseCIDR(cidr)
		if err != nil {
			log.Printf("Warning: Invalid CIDR %s: %v", cidr, err)
			continue
		}
		trustedProxies = append(trustedProxies, network.String())
	}

	if err := r.SetTrustedProxies(trustedProxies); err != nil {
		log.Printf("Warning: Failed to set trusted proxies: %v", err)
	}

	// 创建自定义HTTP服务器，设置更大的请求体限制
	serverAddr := config.GetServerAddress()
	srv := &http.Server{
		Addr:           serverAddr,
		Handler:        r,
		ReadTimeout:    time.Duration(config.GlobalConfig.Server.ReadTimeout) * time.Second,
		WriteTimeout:   time.Duration(config.GlobalConfig.Server.WriteTimeout) * time.Second,
		MaxHeaderBytes: 1 << 20, // 1MB header limit
	}

	// 如果启用HTTPS，同时启动HTTPS服务器
	if config.IsHTTPSEnabled() {
		httpsAddr := config.GetHTTPSServerAddress()
		httpsSrv := &http.Server{
			Addr:           httpsAddr,
			Handler:        r,
			ReadTimeout:    time.Duration(config.GlobalConfig.Server.ReadTimeout) * time.Second,
			WriteTimeout:   time.Duration(config.GlobalConfig.Server.WriteTimeout) * time.Second,
			MaxHeaderBytes: 1 << 20, // 1MB header limit
		}

		// 启动HTTPS服务器（在goroutine中）
		go func() {
			log.Printf("Starting HTTPS server on %s", httpsAddr)
			if err := httpsSrv.ListenAndServeTLS(config.GlobalConfig.Server.CertFile, config.GlobalConfig.Server.KeyFile); err != nil {
				log.Printf("HTTPS server error: %v", err)
			}
		}()
	}

	log.Printf("Starting HTTP server on %s with custom limits", serverAddr)
	if err := srv.ListenAndServe(); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
