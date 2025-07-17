package db

import (
	"database/sql"
	"gatesentinel/config"
	"time"
	"unicode/utf8"

	_ "github.com/mattn/go-sqlite3"
)

var DB *sql.DB

func Init() error {
	db, err := sql.Open("sqlite3", config.GlobalConfig.DBPath)
	if err != nil {
		return err
	}

	DB = db
	return createTables()
}

func createTables() error {
	// 创建Beacon表
	_, err := DB.Exec(`
    CREATE TABLE IF NOT EXISTS beacons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip TEXT NOT NULL,
        hostname TEXT NOT NULL,
        username TEXT NOT NULL,
        process_name TEXT NOT NULL,
        process_path TEXT NOT NULL,
        process_id INTEGER NOT NULL,
        arch TEXT NOT NULL,
        os_uuid TEXT NOT NULL,
        uuid TEXT NOT NULL UNIQUE,
        first_time DATETIME NOT NULL,
        last_seen DATETIME NOT NULL,
        job TEXT,
        job_result TEXT
    )`)
	if err != nil {
		return err
	}

	// 创建管理员表
	_, err = DB.Exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL
    )`)
	if err != nil {
		return err
	}

	// 创建任务历史表
	_, err = DB.Exec(`
    CREATE TABLE IF NOT EXISTS task_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        beacon_uuid TEXT NOT NULL,
        task_type TEXT NOT NULL,
        command TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        result TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (beacon_uuid) REFERENCES beacons(uuid)
    )`)
	if err != nil {
		return err
	}

	return nil
}

// CreateBeacon 创建新的Beacon记录
func CreateBeacon(beacon *Beacon) error {
	// 处理路径编码
	processPath := []byte(beacon.ProcessPath)
	if !utf8.Valid(processPath) {
		// 如果不是有效的UTF-8，尝试转换
		processPath = []byte(string([]rune(beacon.ProcessPath)))
	}

	_, err := DB.Exec(`
    INSERT INTO beacons (
        ip, hostname, username, process_name, process_path, process_id,
        arch, os_uuid, uuid, first_time, last_seen, job, job_result
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		beacon.IP, beacon.HostName, beacon.UserName, beacon.ProcessName,
		string(processPath), beacon.ProcessID, beacon.Arch, beacon.OSUUID,
		beacon.UUID, beacon.FirstTime, beacon.LastSeen, beacon.Job,
		beacon.JobResult)
	return err
}

// GetBeaconByUUID 通过UUID获取Beacon
func GetBeaconByUUID(uuid string) (*Beacon, error) {
	beacon := &Beacon{}
	err := DB.QueryRow(`
    SELECT id, ip, hostname, username, process_name, process_path,
           process_id, arch, os_uuid, uuid, first_time, last_seen,
           job, job_result
    FROM beacons WHERE uuid = ?`, uuid).Scan(
		&beacon.ID, &beacon.IP, &beacon.HostName, &beacon.UserName,
		&beacon.ProcessName, &beacon.ProcessPath, &beacon.ProcessID,
		&beacon.Arch, &beacon.OSUUID, &beacon.UUID, &beacon.FirstTime,
		&beacon.LastSeen, &beacon.Job, &beacon.JobResult)

	if err != nil {
		return nil, err
	}

	// 处理路径编码
	processPath := []byte(beacon.ProcessPath)
	if !utf8.Valid(processPath) {
		// 如果不是有效的UTF-8，尝试转换
		beacon.ProcessPath = string([]rune(beacon.ProcessPath))
	}

	return beacon, nil
}

// UpdateBeaconLastSeen 更新Beacon最后在线时间
func UpdateBeaconLastSeen(uuid string) error {
	_, err := DB.Exec("UPDATE beacons SET last_seen = ? WHERE uuid = ?",
		time.Now(), uuid)
	return err
}

// UpdateBeaconJob 更新Beacon任务
func UpdateBeaconJob(uuid string, job string) error {
	_, err := DB.Exec("UPDATE beacons SET job = ? WHERE uuid = ?",
		job, uuid)
	return err
}

// UpdateBeaconJobResult 更新Beacon任务结果
func UpdateBeaconJobResult(uuid string, result string) error {
	_, err := DB.Exec("UPDATE beacons SET job_result = ? WHERE uuid = ?",
		result, uuid)
	return err
}

// ListBeacons 获取所有Beacon列表
func ListBeacons() ([]*Beacon, error) {
	rows, err := DB.Query(`
    SELECT id, ip, hostname, username, process_name, process_path,
           process_id, arch, os_uuid, uuid, first_time, last_seen,
           job, job_result
    FROM beacons`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var beacons []*Beacon
	for rows.Next() {
		beacon := &Beacon{}
		err := rows.Scan(
			&beacon.ID, &beacon.IP, &beacon.HostName, &beacon.UserName,
			&beacon.ProcessName, &beacon.ProcessPath, &beacon.ProcessID,
			&beacon.Arch, &beacon.OSUUID, &beacon.UUID, &beacon.FirstTime,
			&beacon.LastSeen, &beacon.Job, &beacon.JobResult)
		if err != nil {
			return nil, err
		}

		// 处理路径编码
		processPath := []byte(beacon.ProcessPath)
		if !utf8.Valid(processPath) {
			// 如果不是有效的UTF-8，尝试转换
			beacon.ProcessPath = string([]rune(beacon.ProcessPath))
		}

		beacons = append(beacons, beacon)
	}
	return beacons, nil
}

// CreateTaskHistory 创建任务历史记录
func CreateTaskHistory(history *TaskHistory) error {
	_, err := DB.Exec(`
    INSERT INTO task_history (beacon_uuid, task_type, command, status, result, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
		history.BeaconUUID, history.TaskType, history.Command, history.Status,
		history.Result, history.CreatedAt, history.UpdatedAt)
	return err
}

// UpdateTaskHistory 更新任务历史记录
func UpdateTaskHistory(id int64, status, result string) error {
	_, err := DB.Exec(`
    UPDATE task_history
    SET status = ?, result = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`,
		status, result, id)
	return err
}

// GetTaskHistoryByBeaconUUID 获取指定Beacon的任务历史
func GetTaskHistoryByBeaconUUID(beaconUUID string) ([]*TaskHistory, error) {
	rows, err := DB.Query(`
    SELECT id, beacon_uuid, task_type, command, status, result, created_at, updated_at
    FROM task_history
    WHERE beacon_uuid = ?
    ORDER BY created_at DESC`,
		beaconUUID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var histories []*TaskHistory
	for rows.Next() {
		history := &TaskHistory{}
		err := rows.Scan(
			&history.ID, &history.BeaconUUID, &history.TaskType, &history.Command,
			&history.Status, &history.Result, &history.CreatedAt, &history.UpdatedAt)
		if err != nil {
			return nil, err
		}
		histories = append(histories, history)
	}

	return histories, nil
}

// GetAllTaskHistory 获取所有任务历史
func GetAllTaskHistory() ([]*TaskHistory, error) {
	rows, err := DB.Query(`
    SELECT id, beacon_uuid, task_type, command, status, result, created_at, updated_at
    FROM task_history
    ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var histories []*TaskHistory
	for rows.Next() {
		history := &TaskHistory{}
		err := rows.Scan(
			&history.ID, &history.BeaconUUID, &history.TaskType, &history.Command,
			&history.Status, &history.Result, &history.CreatedAt, &history.UpdatedAt)
		if err != nil {
			return nil, err
		}
		histories = append(histories, history)
	}

	return histories, nil
}

// DeleteBeaconByUUID 通过UUID删除Beacon
func DeleteBeaconByUUID(uuid string) error {
	result, err := DB.Exec("DELETE FROM beacons WHERE uuid = ?", uuid)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return sql.ErrNoRows
	}

	return nil
}
