package utils

import (
	"gatesentinel/db"
	"log"

	"github.com/google/uuid"
)

// ValidateBeaconRegisterInfo 验证Beacon注册信息
func ValidateBeaconRegisterInfo(info *db.BeaconRegisterInfo) bool {
	log.Printf("验证注册信息:")
	log.Printf("- HostName: %s", info.HostName)
	log.Printf("- UserName: %s", info.UserName)
	log.Printf("- ProcessName: %s", info.ProcessName)
	log.Printf("- ProcessPath: %s", info.ProcessPath)
	log.Printf("- ProcessID: %d", info.ProcessID)
	log.Printf("- Arch: %s", info.Arch)
	log.Printf("- OSUUID: %s", info.OSUUID)

	if info.HostName == "" {
		log.Printf("验证失败: HostName为空")
		return false
	}
	if info.UserName == "" {
		log.Printf("验证失败: UserName为空")
		return false
	}
	if info.ProcessName == "" {
		log.Printf("验证失败: ProcessName为空")
		return false
	}
	if info.ProcessPath == "" {
		log.Printf("验证失败: ProcessPath为空")
		return false
	}
	if info.ProcessID <= 0 {
		log.Printf("验证失败: ProcessID无效")
		return false
	}
	if info.Arch == "" {
		log.Printf("验证失败: Arch为空")
		return false
	}
	if info.OSUUID == "" {
		log.Printf("验证失败: OSUUID为空")
		return false
	}

	log.Printf("验证通过")
	return true
}

// ValidateUUID 验证UUID格式
func ValidateUUID(id string) bool {
	_, err := uuid.Parse(id)
	valid := err == nil
	log.Printf("验证UUID [%s]: %v", id, valid)
	return valid
}

// ValidateClientToken 验证客户端Token
func ValidateClientToken(token string) bool {
	valid := token == "Demo"
	log.Printf("验证Token [%s]: %v", token, valid)
	return valid
}
