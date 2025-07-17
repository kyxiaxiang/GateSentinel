package main

import (
	"gatesentinel/config"
	"gatesentinel/handler"
	"io/fs"
	"net/http"
	"strings"

	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
)

// 辅助函数：处理HTML模板并替换路径
func serveHTMLWithRouteReplacement(c *gin.Context, staticFS fs.FS, htmlPath string) {
	// 读取HTML模板
	htmlBytes, err := staticFS.Open(htmlPath)
	if err != nil {
		c.String(http.StatusInternalServerError, "Failed to load page")
		return
	}
	defer htmlBytes.Close()

	htmlContent := make([]byte, 0)
	buffer := make([]byte, 1024)
	for {
		n, err := htmlBytes.Read(buffer)
		if n > 0 {
			htmlContent = append(htmlContent, buffer[:n]...)
		}
		if err != nil {
			break
		}
	}

	// 替换API路径
	htmlString := string(htmlContent)
	htmlString = strings.Replace(htmlString, "/web/admin/api/", config.GlobalConfig.Routes.APIPrefix+"/", -1)
	htmlString = strings.Replace(htmlString, "/web/admin/", config.GlobalConfig.Routes.AdminPrefix+"/", -1)

	// 注入配置信息到HTML中
	configScript := `<script>
		window.APP_CONFIG = {
			apiPrefix: "` + config.GlobalConfig.Routes.APIPrefix + `",
			adminPrefix: "` + config.GlobalConfig.Routes.AdminPrefix + `",
			beaconEndpoint: "` + config.GlobalConfig.Routes.BeaconEndpoint + `",
			registerPath: "` + config.GlobalConfig.Routes.RegisterPath + `",
			loginPath: "` + config.GlobalConfig.Routes.LoginPath + `"
		};
	</script>`

	// 在</head>标签前插入配置脚本
	htmlString = strings.Replace(htmlString, "</head>", configScript+"\n</head>", 1)

	c.Header("Content-Type", "text/html; charset=utf-8")
	c.String(http.StatusOK, htmlString)
}

func setupRouter() *gin.Engine {
	r := gin.Default()

	// 设置最大请求体大小为10MB，支持大型进程列表数据
	r.MaxMultipartMemory = 10 << 20 // 10MB

	// Set session middleware
	store := cookie.NewStore([]byte("secret"))
	r.Use(sessions.Sessions("gatesentinel", store))

	// 从嵌入的FS中获取static子目录
	staticFS, err := fs.Sub(staticFiles, "static")
	if err != nil {
		panic(err)
	}

	// 静态文件服务
	r.StaticFS("/static", http.FS(staticFS))

	// favicon.ico
	r.GET("/favicon.ico", func(c *gin.Context) {
		c.FileFromFS("favicon.ico", http.FS(staticFS))
	})

	// 根路径返回404，隐藏入口
	r.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not Found"})
	})

	// 自定义登录页面路径
	r.GET(config.GlobalConfig.Routes.LoginPath, func(c *gin.Context) {
		serveHTMLWithRouteReplacement(c, staticFS, "html/login-simple.html")
	})

	// Beacon相关路由
	r.POST(config.GlobalConfig.Routes.RegisterPath, handler.RegisterHandler)
	r.Any(config.GlobalConfig.Routes.BeaconEndpoint, handler.BeaconHandler)

	// 管理后台API路由
	api := r.Group(config.GlobalConfig.Routes.APIPrefix)
	{
		api.POST("/login", handler.AdminLoginHandler)

		// 需要登录验证的API
		authorized := api.Group("/", handler.AuthRequired())
		{
			authorized.GET("/beacons", handler.ListBeaconsHandler)
			authorized.GET("/beacons/:uuid", handler.GetBeaconHandler)
			authorized.POST("/beacons/:uuid/job", handler.UpdateBeaconJobHandler)
			authorized.GET("/beacons/:uuid/history", handler.GetTaskHistoryHandler)
			authorized.POST("/beacons/:uuid/delete", handler.DeleteBeaconHandler)
			authorized.GET("/config", handler.GetConfigHandler)
			authorized.POST("/config", handler.UpdateConfigHandler)
			authorized.POST("/config/reload", handler.ReloadConfigHandler)
		}
	}

	// 管理后台页面路由
	admin := r.Group(config.GlobalConfig.Routes.AdminPrefix)
	{
		// 处理根路径，需要登录验证并重定向到beacons页面
		admin.GET("", handler.PageAuthRequired(), func(c *gin.Context) {
			c.Redirect(http.StatusFound, config.GlobalConfig.Routes.AdminPrefix+"/beacons")
		})

		// Beacons列表页面
		admin.GET("/beacons", handler.PageAuthRequired(), func(c *gin.Context) {
			serveHTMLWithRouteReplacement(c, staticFS, "html/admin/beacons-new.html")
		})

		// 其他需要登录验证的页面
		authorized := admin.Group("/", handler.PageAuthRequired())
		{
			authorized.GET("details/:uuid", func(c *gin.Context) {
				serveHTMLWithRouteReplacement(c, staticFS, "html/admin/details.html")
			})
			authorized.GET("settings", func(c *gin.Context) {
				serveHTMLWithRouteReplacement(c, staticFS, "html/admin/settings.html")
			})
		}
	}

	return r
}
