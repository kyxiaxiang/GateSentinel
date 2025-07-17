package db

import (
	"encoding/json"
	"time"
)

type Beacon struct {
	ID          int64     `json:"id"`
	IP          string    `json:"ip"`
	HostName    string    `json:"hostname"`
	UserName    string    `json:"username"`
	ProcessName string    `json:"process_name"`
	ProcessPath string    `json:"process_path"`
	ProcessID   int       `json:"process_id"`
	Arch        string    `json:"arch"`
	OSUUID      string    `json:"os_uuid"`
	UUID        string    `json:"uuid"`
	FirstTime   time.Time `json:"first_time,omitempty"`
	LastSeen    time.Time `json:"last_seen,omitempty"`
	Job         string    `json:"job"`
	JobResult   string    `json:"job_result"`
}

// MarshalJSON 自定义JSON编码方法
func (b *Beacon) MarshalJSON() ([]byte, error) {
	type Alias Beacon
	return json.Marshal(&struct {
		*Alias
		ProcessPath string `json:"process_path"`
	}{
		Alias:       (*Alias)(b),
		ProcessPath: decodeUTF8Path(b.ProcessPath),
	})
}

// decodeUTF8Path 解码UTF-8路径
func decodeUTF8Path(path string) string {
	// 将UTF-8字节序列解码为Unicode字符
	runes := []rune(path)
	return string(runes)
}

type BeaconRegisterInfo struct {
	HostName    string `json:"hostname"`
	UserName    string `json:"username"`
	ProcessName string `json:"process_name"`
	ProcessPath string `json:"process_path"`
	ProcessID   int    `json:"process_id"`
	Arch        string `json:"arch"`
	OSUUID      string `json:"os_uuid"`
}

// TaskHistory 任务历史结构体
type TaskHistory struct {
	ID         int64     `json:"id"`
	BeaconUUID string    `json:"beacon_uuid"`
	TaskType   string    `json:"task_type"`
	Command    string    `json:"command"`
	Status     string    `json:"status"`
	Result     string    `json:"result"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type AdminUser struct {
	ID       int64  `json:"id"`
	Username string `json:"username"`
	Password string `json:"password"`
}
