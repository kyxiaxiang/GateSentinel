// 简化的Beacon管理脚本
console.log('Beacons management loaded');

// 全局变量
let allBeacons = [];
let currentBeaconUuid = '';

// 获取API前缀
function getApiPrefix() {
    return window.APP_CONFIG ? window.APP_CONFIG.apiPrefix : '/web/admin/api';
}

// 获取管理前缀
function getAdminPrefix() {
    return window.APP_CONFIG ? window.APP_CONFIG.adminPrefix : '/web/admin';
}

// 检查认证
function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        const loginPath = window.APP_CONFIG ? window.APP_CONFIG.loginPath : '/login';
        window.location.href = loginPath;
        return false;
    }
    return token;
}

// API调用
async function apiCall(url, options = {}) {
    const token = checkAuth();
    if (!token) return null;

    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });

        if (response.status === 401) {
            localStorage.removeItem('token');
            const loginPath = window.APP_CONFIG ? window.APP_CONFIG.loginPath : '/login';
            window.location.href = loginPath;
            return null;
        }

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        showAlert('API call failed: ' + error.message, 'danger');
        return null;
    }
}

// 显示警告
function showAlert(message, type = 'info') {
    const container = document.getElementById('alertContainer');
    const alertId = 'alert-' + Date.now();
    
    container.innerHTML = `
        <div class="alert alert-${type}" id="${alertId}">
            ${message}
            <button onclick="document.getElementById('${alertId}').remove()" style="float: right; background: none; border: none; font-size: 1.2rem;">&times;</button>
        </div>
    `;
    
    // 自动隐藏
    setTimeout(() => {
        const alert = document.getElementById(alertId);
        if (alert) alert.remove();
    }, 5000);
}

// 加载Beacon列表
async function loadBeacons() {
    console.log('Loading beacons...');

    const data = await apiCall(getApiPrefix() + '/beacons');
    if (!data) return;

    if (data.status === 'success') {
        allBeacons = data.data || [];
        updateStatistics();
        renderBeacons();
    } else {
        showAlert('Failed to load beacons', 'danger');
    }
}

// 更新统计
function updateStatistics() {
    let online = 0, warning = 0, offline = 0;
    
    allBeacons.forEach(beacon => {
        const status = getBeaconStatus(beacon.last_seen);
        if (status === 'online') online++;
        else if (status === 'warning') warning++;
        else offline++;
    });
    
    document.getElementById('totalCount').textContent = allBeacons.length;
    document.getElementById('onlineCount').textContent = online;
    document.getElementById('warningCount').textContent = warning;
    document.getElementById('offlineCount').textContent = offline;
}

// 获取Beacon状态
function getBeaconStatus(lastSeen) {
    if (!lastSeen) return 'offline';
    
    const now = Date.now();
    const lastSeenTime = new Date(lastSeen).getTime();
    const diff = now - lastSeenTime;
    
    if (diff < 60000) return 'online';      // < 1分钟
    if (diff < 300000) return 'warning';    // < 5分钟
    return 'offline';                       // >= 5分钟
}

// 格式化时间
function formatDate(timestamp) {
    if (!timestamp) return 'Unknown';
    try {
        return new Date(timestamp).toLocaleString();
    } catch {
        return 'Invalid Date';
    }
}

// 渲染Beacon列表
function renderBeacons() {
    const tbody = document.getElementById('beaconTableBody');
    const emptyState = document.getElementById('emptyState');
    
    // 应用搜索过滤
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const filteredBeacons = allBeacons.filter(beacon => {
        if (!searchTerm) return true;
        const searchText = [
            beacon.hostname,
            beacon.username,
            beacon.ip,
            beacon.process_name,
            beacon.arch
        ].join(' ').toLowerCase();
        return searchText.includes(searchTerm);
    });
    
    if (filteredBeacons.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    
    tbody.innerHTML = filteredBeacons.map(beacon => {
        const status = getBeaconStatus(beacon.last_seen);
        const statusClass = status === 'online' ? 'success' : 
                           status === 'warning' ? 'warning' : 'danger';
        
        return `
            <tr>
                <td>
                    <span class="status-indicator status-${status}">
                        <span class="status-dot"></span>
                        ${status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                </td>
                <td><strong>${beacon.hostname || 'N/A'}</strong></td>
                <td>${beacon.username || 'N/A'}</td>
                <td><code>${beacon.ip || 'N/A'}</code></td>
                <td>
                    <div>${beacon.process_name || 'N/A'}</div>
                    <small class="text-muted">PID: ${beacon.process_id || 'N/A'}</small>
                </td>
                <td><span class="badge badge-secondary">${beacon.arch || 'N/A'}</span></td>
                <td><small>${formatDate(beacon.last_seen)}</small></td>
                <td>
                    ${beacon.job ?
                        `<span class="status-indicator status-pending">
                            <span class="status-dot"></span>
                            Pending
                        </span>` :
                        `<span class="status-indicator status-idle">
                            <span class="status-dot"></span>
                            Idle
                        </span>`
                    }
                </td>
                <td>
                    <div style="display: flex; gap: 0.25rem;">
                        <button class="btn btn-primary btn-sm" onclick="showTaskModal('${beacon.uuid}', '${beacon.hostname}')" title="Send Task">
                            <i class="bi bi-send"></i>
                        </button>
                        <button class="btn btn-success btn-sm" onclick="showHistory('${beacon.uuid}', '${beacon.hostname}')" title="History">
                            <i class="bi bi-clock-history"></i>
                        </button>
                        <button class="btn btn-outline btn-sm" onclick="showDetails('${beacon.uuid}')" title="Details">
                            <i class="bi bi-eye"></i>
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="deleteBeacon('${beacon.uuid}', '${beacon.hostname}')" title="Delete">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// 刷新Beacon列表
function refreshBeacons() {
    loadBeacons();
}

// 搜索功能
document.addEventListener('DOMContentLoaded', function() {
    // 检查认证
    if (!checkAuth()) return;
    
    // 加载数据
    loadBeacons();
    
    // 设置搜索
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', renderBeacons);
    }
    
    // 定时刷新
    setInterval(loadBeacons, 30000);
    
    console.log('Beacons page initialized');
});

// 下拉菜单
function toggleDropdown() {
    const dropdown = document.getElementById('userDropdown');
    dropdown.classList.toggle('show');
}

// 点击外部关闭下拉菜单
document.addEventListener('click', function(e) {
    if (!e.target.closest('.dropdown')) {
        document.getElementById('userDropdown').classList.remove('show');
    }
});

// 登出
function logout() {
    localStorage.removeItem('token');
    const loginPath = window.APP_CONFIG ? window.APP_CONFIG.loginPath : '/login';
    window.location.href = loginPath;
}

// 模态框控制
function showModal(modalId) {
    document.getElementById(modalId).classList.add('show');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
}

// 点击模态框外部关闭
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('show');
    }
});

// 显示任务发送模态框
function showTaskModal(uuid, hostname) {
    currentBeaconUuid = uuid;
    document.getElementById('taskBeaconName').value = hostname;
    document.getElementById('taskBeaconUuid').value = uuid;
    document.getElementById('taskType').value = '';
    document.getElementById('taskData').value = '';
    document.getElementById('taskDataGroup').style.display = 'none';
    showModal('taskModal');
}

// 更新任务表单
function updateTaskForm() {
    const taskType = document.getElementById('taskType').value;
    const dataGroup = document.getElementById('taskDataGroup');
    const fileGroup = document.getElementById('shellcodeFileGroup');
    const dataInput = document.getElementById('taskData');
    const dataLabel = document.getElementById('taskDataLabel');
    const dataHelp = document.getElementById('taskDataHelp');

    // 隐藏所有组
    dataGroup.style.display = 'none';
    fileGroup.style.display = 'none';
    dataInput.required = false;

    if (taskType === '0x1A') {
        dataGroup.style.display = 'block';
        dataLabel.textContent = 'Sleep Time (seconds)';
        dataInput.placeholder = 'Enter sleep time in seconds (e.g., 30)';
        dataHelp.textContent = 'Sleep time in seconds';
        dataInput.required = true;
    } else if (taskType === '0x1B') {
        // 进程列表不需要额外参数
    } else if (taskType === '0x1C') {
        dataGroup.style.display = 'block';
        fileGroup.style.display = 'block';
        dataLabel.textContent = 'Shellcode (Hex Format)';
        dataInput.placeholder = 'Enter shellcode in hex format or upload file below';
        dataHelp.textContent = 'Shellcode in hexadecimal format (e.g., 4831c0c3) or upload a binary file';
        dataInput.required = false; // 可以通过文件上传或手动输入
    } else if (taskType === '0x1D') {
        dataGroup.style.display = 'block';
        dataLabel.textContent = 'Command';
        dataInput.placeholder = 'Enter command to execute (e.g., dir, whoami, ipconfig)';
        dataHelp.textContent = 'Command will be executed with cmd.exe /c (timeout: 60 seconds)';
        dataInput.required = true;
    }

    // 设置文件上传事件监听器
    if (taskType === '0x1C') {
        setupFileUpload();
    }
}

// 设置文件上传功能
function setupFileUpload() {
    const fileInput = document.getElementById('shellcodeFile');
    if (fileInput && !fileInput.hasEventListener) {
        fileInput.hasEventListener = true;
        fileInput.addEventListener('change', handleFileUpload);
    }
}

// 处理文件上传
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) {
        hideFileInfo();
        return;
    }

    // 检查文件大小 (限制为1MB)
    if (file.size > 1024 * 1024) {
        showAlert('File size too large. Maximum size is 1MB.', 'warning');
        clearShellcodeFile();
        return;
    }

    // 显示文件信息
    showFileInfo(file.name, file.size);

    // 读取文件并转换为hex
    const reader = new FileReader();
    reader.onload = function(e) {
        const arrayBuffer = e.target.result;
        const uint8Array = new Uint8Array(arrayBuffer);
        const hexString = Array.from(uint8Array)
            .map(byte => byte.toString(16).padStart(2, '0'))
            .join('');

        // 将hex字符串填入文本框
        document.getElementById('taskData').value = hexString;
        showAlert(`File converted to hex format (${hexString.length / 2} bytes)`, 'success');
    };

    reader.onerror = function() {
        showAlert('Failed to read file', 'danger');
        clearShellcodeFile();
    };

    reader.readAsArrayBuffer(file);
}

// 显示文件信息
function showFileInfo(fileName, fileSize) {
    document.getElementById('fileName').textContent = fileName;
    document.getElementById('fileSize').textContent = fileSize;
    document.getElementById('fileInfo').style.display = 'block';
}

// 隐藏文件信息
function hideFileInfo() {
    document.getElementById('fileInfo').style.display = 'none';
}

// 清除文件上传
function clearShellcodeFile() {
    document.getElementById('shellcodeFile').value = '';
    document.getElementById('taskData').value = '';
    hideFileInfo();
}

// 发送任务
async function sendTask() {
    const uuid = document.getElementById('taskBeaconUuid').value;
    const taskType = document.getElementById('taskType').value;
    const taskData = document.getElementById('taskData').value;

    if (!taskType) {
        showAlert('Please select a task type', 'warning');
        return;
    }

    // 验证shellcode任务
    if (taskType === '0x1C') {
        if (!taskData) {
            showAlert('Please enter shellcode in hex format or upload a file', 'warning');
            return;
        }

        // 验证hex格式
        if (!/^[0-9a-fA-F]+$/.test(taskData)) {
            showAlert('Invalid hex format. Please use only hexadecimal characters (0-9, a-f, A-F)', 'warning');
            return;
        }

        // 检查是否为偶数长度
        if (taskData.length % 2 !== 0) {
            showAlert('Invalid hex format. Hex string must have even length', 'warning');
            return;
        }
    }

    // 验证命令执行任务
    if (taskType === '0x1D') {
        if (!taskData || taskData.trim() === '') {
            showAlert('Please enter a command to execute', 'warning');
            return;
        }
    }

    // 验证sleep任务
    if (taskType === '0x1A') {
        if (!taskData) {
            showAlert('Please enter sleep time in seconds', 'warning');
            return;
        }

        const sleepTime = parseInt(taskData);
        if (isNaN(sleepTime) || sleepTime < 1 || sleepTime > 3600) {
            showAlert('Sleep time must be a number between 1 and 3600 seconds', 'warning');
            return;
        }
    }

    let jobData = '';
    if (taskType === '0x1A' && taskData) {
        jobData = `Sleep ${taskData}`;
    } else if (taskType === '0x1B') {
        jobData = 'ProcessList';
    } else if (taskType === '0x1C' && taskData) {
        jobData = taskData;
    } else if (taskType === '0x1D' && taskData) {
        jobData = taskData;
    }

    const result = await apiCall(`${getApiPrefix()}/beacons/${uuid}/job`, {
        method: 'POST',
        body: JSON.stringify({
            type: taskType,
            data: jobData
        })
    });

    if (result && result.status === 'success') {
        const fileInput = document.getElementById('shellcodeFile');
        const fileName = fileInput && fileInput.files[0] ? fileInput.files[0].name : '';
        const message = fileName ?
            `Task sent successfully (file: ${fileName})` :
            'Task sent successfully';

        showAlert(message, 'success');
        closeModal('taskModal');
        loadBeacons(); // 刷新列表
    } else {
        showAlert('Failed to send task', 'danger');
    }
}

// 显示任务历史
async function showHistory(uuid, hostname) {
    currentBeaconUuid = uuid;

    const data = await apiCall(`${getApiPrefix()}/beacons/${uuid}/history`);
    if (!data) return;

    const historyContent = document.getElementById('historyContent');
    const modalTitle = document.querySelector('#historyModal .modal-title');
    modalTitle.textContent = `Task History - ${hostname}`;

    if (data.status === 'success' && data.data && data.data.length > 0) {
        historyContent.innerHTML = data.data.map(task => `
            <div style="border: 1px solid var(--border-color); border-radius: 0.375rem; padding: 1rem; margin-bottom: 1rem;">
                <div style="display: flex; justify-content: between; align-items: start; margin-bottom: 0.5rem;">
                    <h6 style="margin: 0;">${task.task_type || 'Unknown Task'}</h6>
                    <small style="color: var(--text-secondary);">${formatDate(task.created_at)}</small>
                </div>
                <div style="margin-bottom: 0.5rem;">
                    <strong>Command:</strong> <code>${task.command || 'N/A'}</code>
                </div>
                <div style="margin-bottom: 0.5rem;">
                    <strong>Status:</strong>
                    <span class="badge badge-${getTaskStatusClass(task.status)}">${task.status || 'Unknown'}</span>
                </div>
                ${task.result ? `
                    <div>
                        <strong>Result:</strong>
                        <pre style="background: var(--light-color); padding: 0.75rem; border-radius: 0.25rem; margin-top: 0.5rem; max-height: 200px; overflow-y: auto; font-size: 0.75rem;">${task.result}</pre>
                    </div>
                ` : ''}
            </div>
        `).join('');
    } else {
        historyContent.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-clock-history"></i>
                <h3>No Task History</h3>
                <p>No tasks have been executed for this beacon yet.</p>
            </div>
        `;
    }

    showModal('historyModal');
}

// 获取任务状态样式
function getTaskStatusClass(status) {
    switch (status?.toLowerCase()) {
        case 'completed': return 'success';
        case 'pending': return 'warning';
        case 'failed': return 'danger';
        case 'running': return 'primary';
        default: return 'secondary';
    }
}

// 刷新历史
function refreshHistory() {
    if (currentBeaconUuid) {
        const beacon = allBeacons.find(b => b.uuid === currentBeaconUuid);
        if (beacon) {
            showHistory(currentBeaconUuid, beacon.hostname);
        }
    }
}

// 显示详情
async function showDetails(uuid) {
    const beacon = allBeacons.find(b => b.uuid === uuid);
    if (!beacon) {
        showAlert('Beacon not found', 'danger');
        return;
    }

    currentBeaconUuid = uuid;
    const status = getBeaconStatus(beacon.last_seen);

    const detailsContent = document.getElementById('detailsContent');
    const modalTitle = document.querySelector('#detailsModal .modal-title');
    modalTitle.textContent = `Beacon Details - ${beacon.hostname}`;

    detailsContent.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
            <div>
                <h6>Basic Information</h6>
                <table style="width: 100%; font-size: 0.875rem;">
                    <tr><td><strong>UUID:</strong></td><td><code style="font-size: 0.75rem;">${beacon.uuid}</code></td></tr>
                    <tr><td><strong>Hostname:</strong></td><td>${beacon.hostname}</td></tr>
                    <tr><td><strong>Username:</strong></td><td>${beacon.username}</td></tr>
                    <tr><td><strong>IP Address:</strong></td><td><code>${beacon.ip}</code></td></tr>
                    <tr><td><strong>Architecture:</strong></td><td><span class="badge badge-secondary">${beacon.arch}</span></td></tr>
                    <tr><td><strong>Status:</strong></td><td><span class="status-indicator status-${status}"><span class="status-dot"></span>${status.charAt(0).toUpperCase() + status.slice(1)}</span></td></tr>
                </table>
            </div>
            <div>
                <h6>Process Information</h6>
                <table style="width: 100%; font-size: 0.875rem;">
                    <tr><td><strong>Process Name:</strong></td><td>${beacon.process_name}</td></tr>
                    <tr><td><strong>Process ID:</strong></td><td>${beacon.process_id}</td></tr>
                    <tr><td><strong>Process Path:</strong></td><td><small>${beacon.process_path}</small></td></tr>
                </table>

                <h6 style="margin-top: 1.5rem;">Timing Information</h6>
                <table style="width: 100%; font-size: 0.875rem;">
                    <tr><td><strong>First Seen:</strong></td><td><small>${formatDate(beacon.first_time)}</small></td></tr>
                    <tr><td><strong>Last Seen:</strong></td><td><small>${formatDate(beacon.last_seen)}</small></td></tr>
                </table>
            </div>
        </div>

        ${beacon.job ? `
            <div style="margin-top: 1.5rem;">
                <h6>Current Job</h6>
                <div class="alert alert-info">
                    <code>${beacon.job}</code>
                </div>
            </div>
        ` : ''}

        ${beacon.job_result ? `
            <div style="margin-top: 1.5rem;">
                <h6>Last Job Result</h6>
                <pre style="background: var(--light-color); padding: 1rem; border-radius: 0.375rem; max-height: 200px; overflow-y: auto; font-size: 0.75rem;">${beacon.job_result}</pre>
            </div>
        ` : ''}
    `;

    showModal('detailsModal');
}

// 从详情页面显示任务模态框
function showTaskModalFromDetails() {
    const beacon = allBeacons.find(b => b.uuid === currentBeaconUuid);
    if (beacon) {
        closeModal('detailsModal');
        showTaskModal(currentBeaconUuid, beacon.hostname);
    }
}

// 从详情页面显示历史
function showHistoryFromDetails() {
    const beacon = allBeacons.find(b => b.uuid === currentBeaconUuid);
    if (beacon) {
        closeModal('detailsModal');
        showHistory(currentBeaconUuid, beacon.hostname);
    }
}

// 删除Beacon
async function deleteBeacon(uuid, hostname) {
    if (!confirm(`Are you sure you want to delete beacon "${hostname}"?\n\nThis action cannot be undone and will:\n- Remove the beacon from the system\n- Delete all associated task history\n- Terminate the beacon session`)) {
        return;
    }

    const result = await apiCall(`${getApiPrefix()}/beacons/${uuid}/delete`, {
        method: 'POST'
    });

    if (result && result.success) {
        showAlert(`Beacon "${hostname}" deleted successfully`, 'success');
        loadBeacons(); // 刷新列表
    } else {
        showAlert(`Failed to delete beacon "${hostname}"`, 'danger');
    }
}

// 快速操作
function showQuickActions() {
    const modalHtml = `
        <div class="modal" id="quickActionsModal">
            <div class="modal-dialog">
                <div class="modal-header">
                    <h5 class="modal-title">Quick Actions</h5>
                    <button class="modal-close" onclick="closeModal('quickActionsModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="display: grid; gap: 1rem;">
                        <button class="btn btn-primary" onclick="sendTaskToAll('0x1B')">
                            <i class="bi bi-list-task me-2"></i>
                            Get Process List from All Beacons
                        </button>
                        <button class="btn btn-warning" onclick="sendTaskToAll('0x1A', '60')">
                            <i class="bi bi-clock me-2"></i>
                            Set All Beacons Sleep to 60s
                        </button>
                        <button class="btn btn-danger" onclick="deleteAllOfflineBeacons()">
                            <i class="bi bi-trash me-2"></i>
                            Delete All Offline Beacons
                        </button>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal('quickActionsModal')">Close</button>
                </div>
            </div>
        </div>
    `;

    // 移除现有模态框
    const existingModal = document.getElementById('quickActionsModal');
    if (existingModal) {
        existingModal.remove();
    }

    // 添加新模态框
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    showModal('quickActionsModal');
}

// 向所有Beacon发送任务
async function sendTaskToAll(taskType, data = '') {
    const onlineBeacons = allBeacons.filter(beacon => getBeaconStatus(beacon.last_seen) === 'online');

    if (onlineBeacons.length === 0) {
        showAlert('No online beacons found', 'warning');
        return;
    }

    if (!confirm(`Send task to ${onlineBeacons.length} online beacon(s)?`)) {
        return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const beacon of onlineBeacons) {
        let jobData = '';
        if (taskType === '0x1A' && data) {
            jobData = `Sleep ${data}`;
        } else if (taskType === '0x1B') {
            jobData = 'ProcessList';
        }

        const result = await apiCall(`${getApiPrefix()}/beacons/${beacon.uuid}/job`, {
            method: 'POST',
            body: JSON.stringify({
                type: taskType,
                data: jobData
            })
        });

        if (result && result.status === 'success') {
            successCount++;
        } else {
            failCount++;
        }
    }

    showAlert(`Task sent: ${successCount} successful, ${failCount} failed`, successCount > 0 ? 'success' : 'danger');
    closeModal('quickActionsModal');
    loadBeacons();
}

// 删除所有离线Beacon
async function deleteAllOfflineBeacons() {
    const offlineBeacons = allBeacons.filter(beacon => getBeaconStatus(beacon.last_seen) === 'offline');

    if (offlineBeacons.length === 0) {
        showAlert('No offline beacons found', 'info');
        return;
    }

    if (!confirm(`Delete ${offlineBeacons.length} offline beacon(s)?\n\nThis action cannot be undone.`)) {
        return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const beacon of offlineBeacons) {
        const result = await apiCall(`${getApiPrefix()}/beacons/${beacon.uuid}/delete`, {
            method: 'POST'
        });

        if (result && result.success) {
            successCount++;
        } else {
            failCount++;
        }
    }

    showAlert(`Deleted: ${successCount} successful, ${failCount} failed`, successCount > 0 ? 'success' : 'danger');
    closeModal('quickActionsModal');
    loadBeacons();
}

// 显示会话管理
function showSessionManager() {
    refreshSessions();
    showModal('sessionModal');
}

// 刷新会话列表
function refreshSessions() {
    const sessionContent = document.getElementById('sessionContent');

    if (allBeacons.length === 0) {
        sessionContent.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-pc-display"></i>
                <h3>No Active Sessions</h3>
                <p>No beacon sessions are currently active.</p>
            </div>
        `;
        return;
    }

    const sessionHtml = `
        <div style="margin-bottom: 1rem;">
            <h6>Active Beacon Sessions (${allBeacons.length})</h6>
            <p class="text-muted">Manage and terminate beacon sessions</p>
        </div>

        <div class="table-container">
            <table class="table">
                <thead>
                    <tr>
                        <th>Status</th>
                        <th>Hostname</th>
                        <th>User</th>
                        <th>IP Address</th>
                        <th>Last Seen</th>
                        <th>Session Duration</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${allBeacons.map(beacon => {
                        const status = getBeaconStatus(beacon.last_seen);
                        const duration = getSessionDuration(beacon.first_time);

                        return `
                            <tr>
                                <td>
                                    <span class="status-indicator status-${status}">
                                        <span class="status-dot"></span>
                                        ${status.charAt(0).toUpperCase() + status.slice(1)}
                                    </span>
                                </td>
                                <td><strong>${beacon.hostname || 'N/A'}</strong></td>
                                <td>${beacon.username || 'N/A'}</td>
                                <td><code>${beacon.ip || 'N/A'}</code></td>
                                <td><small>${formatDate(beacon.last_seen)}</small></td>
                                <td><small>${duration}</small></td>
                                <td>
                                    <div style="display: flex; gap: 0.25rem;">
                                        <button class="btn btn-warning btn-sm" onclick="terminateSession('${beacon.uuid}', '${beacon.hostname}')" title="Terminate Session">
                                            <i class="bi bi-power"></i>
                                        </button>
                                        <button class="btn btn-danger btn-sm" onclick="deleteBeacon('${beacon.uuid}', '${beacon.hostname}')" title="Delete">
                                            <i class="bi bi-trash"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;

    sessionContent.innerHTML = sessionHtml;
}

// 计算会话持续时间
function getSessionDuration(firstTime) {
    if (!firstTime) return 'Unknown';

    try {
        const start = new Date(firstTime);
        const now = new Date();
        const diff = now - start;

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    } catch {
        return 'Unknown';
    }
}

// 终止单个会话
async function terminateSession(uuid, hostname) {
    if (!confirm(`Terminate session for "${hostname}"?\n\nThis will:\n- Send exit command to the beacon\n- Remove the beacon from the system\n- End the session gracefully`)) {
        return;
    }

    // 首先发送退出命令
    const exitResult = await apiCall(`${getApiPrefix()}/beacons/${uuid}/job`, {
        method: 'POST',
        body: JSON.stringify({
            type: 'NULL',
            data: 'EXIT'
        })
    });

    if (exitResult && exitResult.status === 'success') {
        showAlert(`Exit command sent to "${hostname}"`, 'info');

        // 等待一段时间后删除记录
        setTimeout(async () => {
            const deleteResult = await apiCall(`${getApiPrefix()}/beacons/${uuid}/delete`, {
                method: 'POST'
            });

            if (deleteResult && deleteResult.success) {
                showAlert(`Session terminated for "${hostname}"`, 'success');
                loadBeacons();
                refreshSessions();
            }
        }, 2000);
    } else {
        showAlert(`Failed to terminate session for "${hostname}"`, 'danger');
    }
}

// 终止所有会话
async function terminateAllSessions() {
    if (allBeacons.length === 0) {
        showAlert('No active sessions to terminate', 'info');
        return;
    }

    if (!confirm(`Terminate all ${allBeacons.length} active session(s)?\n\nThis action will:\n- Send exit commands to all beacons\n- Remove all beacons from the system\n- End all sessions gracefully\n\nThis cannot be undone.`)) {
        return;
    }

    let successCount = 0;
    let failCount = 0;

    // 发送退出命令给所有Beacon
    for (const beacon of allBeacons) {
        const exitResult = await apiCall(`${getApiPrefix()}/beacons/${beacon.uuid}/job`, {
            method: 'POST',
            body: JSON.stringify({
                type: 'NULL',
                data: 'EXIT'
            })
        });

        if (exitResult && exitResult.status === 'success') {
            successCount++;
        } else {
            failCount++;
        }
    }

    showAlert(`Exit commands sent: ${successCount} successful, ${failCount} failed`, 'info');

    // 等待一段时间后删除所有记录
    setTimeout(async () => {
        let deleteSuccess = 0;
        let deleteFail = 0;

        for (const beacon of allBeacons) {
            const deleteResult = await apiCall(`${getApiPrefix()}/beacons/${beacon.uuid}/delete`, {
                method: 'POST'
            });

            if (deleteResult && deleteResult.success) {
                deleteSuccess++;
            } else {
                deleteFail++;
            }
        }

        showAlert(`Sessions terminated: ${deleteSuccess} successful, ${deleteFail} failed`, deleteSuccess > 0 ? 'success' : 'danger');
        closeModal('sessionModal');
        loadBeacons();
    }, 3000);
}
