package handler

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"gatesentinel/config"
	"gatesentinel/db"
	"gatesentinel/utils"
	"io/ioutil"
	"log"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"golang.org/x/text/encoding/simplifiedchinese"
	"golang.org/x/text/transform"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// GBK转UTF8
func GbkToUtf8(s []byte) ([]byte, error) {
	reader := transform.NewReader(bytes.NewReader(s), simplifiedchinese.GBK.NewDecoder())
	d, e := ioutil.ReadAll(reader)
	if e != nil {
		return nil, e
	}
	return d, nil
}

// RegisterHandler 处理Beacon注册请求
func RegisterHandler(c *gin.Context) {
	log.Printf("收到注册请求")

	// 验证Token
	token := c.GetHeader("X-Request-ID")
	if !utils.ValidateClientToken(token) {
		log.Printf("Token验证失败")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
		return
	}

	// 解析请求体
	var registerInfo db.BeaconRegisterInfo
	body, err := c.GetRawData()
	if err != nil {
		log.Printf("读取请求体失败: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	var jsonData []byte
	bodyStr := string(body)

	// 移除流量伪装包装
	unwrappedData := utils.UnwrapDataFromDisguise(bodyStr)

	// 尝试Base64解码，如果失败则假设是原始JSON
	decodedData, err := base64.StdEncoding.DecodeString(unwrappedData)
	if err != nil {
		log.Printf("不是Base64数据，尝试作为原始JSON处理")
		// 验证是否为有效的UTF-8编码
		if !utf8.Valid([]byte(unwrappedData)) {
			log.Printf("无效的UTF-8编码")
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid UTF-8 encoding"})
			return
		}
		jsonData = []byte(unwrappedData)
	} else {
		// 验证解码后的UTF-8编码
		if !utf8.Valid(decodedData) {
			log.Printf("Base64解码后数据无效的UTF-8编码")
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid UTF-8 encoding after base64 decode"})
			return
		}
		log.Printf("Base64解码后数据: %s", string(decodedData))
		jsonData = decodedData
	}

	// 解析JSON
	decoder := json.NewDecoder(bytes.NewReader(jsonData))
	decoder.UseNumber() // 使用Number类型来处理数字
	if err := decoder.Decode(&registerInfo); err != nil {
		log.Printf("JSON解析失败: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Invalid JSON: %v", err)})
		return
	}

	// 处理路径中的Unicode转义序列
	processPath := registerInfo.ProcessPath
	// 移除多余的反斜杠
	processPath = strings.ReplaceAll(processPath, "\\\\", "\\")
	registerInfo.ProcessPath = processPath

	// 验证数据
	if !utils.ValidateBeaconRegisterInfo(&registerInfo) {
		log.Printf("注册信息验证失败")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid register info"})
		return
	}

	// 生成UUID
	newUUID := uuid.New().String()

	// 获取IP
	ip := c.GetHeader("CF-Connecting-IP")
	if ip == "" {
		ip = c.ClientIP()
	}

	// 创建Beacon记录
	beacon := &db.Beacon{
		IP:          ip,
		HostName:    registerInfo.HostName,
		UserName:    registerInfo.UserName,
		ProcessName: registerInfo.ProcessName,
		ProcessPath: processPath,
		ProcessID:   registerInfo.ProcessID,
		Arch:        registerInfo.Arch,
		OSUUID:      registerInfo.OSUUID,
		UUID:        newUUID,
		FirstTime:   time.Now(),
		LastSeen:    time.Now(),
		Job:         "",
		JobResult:   "",
	}

	if err := db.CreateBeacon(beacon); err != nil {
		log.Printf("创建Beacon记录失败: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create beacon"})
		return
	}

	log.Printf("Beacon注册成功，UUID: %s", newUUID)

	// 返回通讯地址
	response := gin.H{
		"status": "success",
		"url":    config.GlobalConfig.Routes.BeaconEndpoint + "?clientId=" + newUUID,
	}
	c.JSON(http.StatusOK, response)
}
