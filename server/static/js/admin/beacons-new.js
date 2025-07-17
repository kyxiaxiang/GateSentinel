// 重构的Beacon管理脚本
console.log('Beacons management page loaded');

// 全局变量
let allBeacons = [];
let filteredBeacons = [];
let currentFilter = 'all';
let currentSort = { field: 'last_seen', direction: 'desc' };

// 获取API前缀
function getApiPrefix() {
    return window.APP_CONFIG ? window.APP_CONFIG.apiPrefix : '/web/admin/api';
}

// 检查认证状态
function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        console.log('No token found, redirecting to login');
        const loginPath = window.APP_CONFIG ? window.APP_CONFIG.loginPath : '/login';
        window.location.href = loginPath;
        return false;
    }
    return token;
}

// API调用封装
async function apiCall(url, options = {}) {
    const token = checkAuth();
    if (!token) return null;

    const defaultOptions = {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...options.headers
        }
    };

    try {
        const response = await fetch(url, { ...defaultOptions, ...options });
        
        if (response.status === 401) {
            console.log('Token expired, redirecting to login');
            localStorage.removeItem('token');
            localStorage.removeItem('loginTime');
            const loginPath = window.APP_CONFIG ? window.APP_CONFIG.loginPath : '/login';
            window.location.href = loginPath;
            return null;
        }

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('API call failed:', error);
        showError('API call failed: ' + error.message);
        return null;
    }
}

// 加载Beacon列表
async function loadBeacons() {
    console.log('Loading beacons...');
    
    const data = await apiCall(getApiPrefix() + '/beacons');
    if (!data) return;

    if (data.status === 'success') {
        allBeacons = data.data || [];
        console.log('Loaded beacons:', allBeacons.length);
        updateStatistics();
        applyFilters();
        renderBeacons();
    } else {
        console.error('Failed to load beacons:', data);
        showError('Failed to load beacons');
    }
}

// 更新统计信息
function updateStatistics() {
    let onlineCount = 0;
    let warningCount = 0;
    let offlineCount = 0;

    allBeacons.forEach(beacon => {
        const status = getBeaconStatus(beacon.last_seen);
        switch (status) {
            case 'online': onlineCount++; break;
            case 'warning': warningCount++; break;
            case 'offline': offlineCount++; break;
        }
    });

    // 更新统计卡片
    updateCounter('totalCount', allBeacons.length);
    updateCounter('onlineCount', onlineCount);
    updateCounter('warningCount', warningCount);
    updateCounter('offlineCount', offlineCount);
}

// 更新计数器
function updateCounter(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

// 获取Beacon状态
function getBeaconStatus(lastSeen) {
    if (!lastSeen) return 'offline';
    
    const now = Date.now();
    const lastSeenTime = new Date(lastSeen).getTime();
    const timeDiff = now - lastSeenTime;
    
    if (timeDiff < 60000) return 'online';      // < 1分钟
    if (timeDiff < 300000) return 'warning';    // < 5分钟
    return 'offline';                           // >= 5分钟
}

// 格式化时间
function formatDate(timestamp) {
    if (!timestamp) return 'Unknown';
    
    try {
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    } catch (error) {
        console.error('Date formatting error:', error);
        return 'Invalid Date';
    }
}

// 应用过滤器
function applyFilters() {
    filteredBeacons = allBeacons.filter(beacon => {
        // 状态过滤
        if (currentFilter !== 'all') {
            const status = getBeaconStatus(beacon.last_seen);
            if (status !== currentFilter) return false;
        }
        
        // 搜索过滤
        const searchTerm = document.getElementById('searchInput')?.value?.toLowerCase();
        if (searchTerm) {
            const searchableText = [
                beacon.hostname,
                beacon.username,
                beacon.ip,
                beacon.process_name,
                beacon.arch
            ].join(' ').toLowerCase();
            
            if (!searchableText.includes(searchTerm)) return false;
        }
        
        return true;
    });
    
    applySorting();
}

// 应用排序
function applySorting() {
    filteredBeacons.sort((a, b) => {
        let aValue = a[currentSort.field];
        let bValue = b[currentSort.field];
        
        // 特殊处理
        if (currentSort.field === 'status') {
            aValue = getBeaconStatus(a.last_seen);
            bValue = getBeaconStatus(b.last_seen);
        } else if (currentSort.field === 'last_seen' || currentSort.field === 'first_time') {
            aValue = new Date(aValue);
            bValue = new Date(bValue);
        }
        
        // 字符串比较
        if (typeof aValue === 'string') {
            aValue = aValue.toLowerCase();
            bValue = bValue.toLowerCase();
        }
        
        let result = 0;
        if (aValue < bValue) result = -1;
        if (aValue > bValue) result = 1;
        
        return currentSort.direction === 'desc' ? -result : result;
    });
}

// 渲染Beacon列表
function renderBeacons() {
    const beaconList = document.getElementById('beaconList');
    const emptyState = document.getElementById('emptyState');
    
    if (!beaconList) {
        console.error('Beacon list element not found');
        return;
    }
    
    if (filteredBeacons.length === 0) {
        beaconList.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }
    
    if (emptyState) emptyState.style.display = 'none';
    beaconList.innerHTML = '';
    
    filteredBeacons.forEach((beacon, index) => {
        const row = createBeaconRow(beacon, index);
        beaconList.appendChild(row);
    });
}

// 创建Beacon行
function createBeaconRow(beacon, index) {
    const row = document.createElement('tr');
    row.className = 'beacon-row';
    row.style.animationDelay = `${index * 50}ms`;
    
    const status = getBeaconStatus(beacon.last_seen);
    const statusIcon = getStatusIcon(status);
    const statusBadge = getStatusBadge(status);
    
    row.innerHTML = `
        <td>
            <div class="d-flex align-items-center">
                ${statusIcon}
                <span class="ms-2">${statusBadge}</span>
            </div>
        </td>
        <td>
            <div class="fw-medium">${beacon.hostname || 'N/A'}</div>
        </td>
        <td>
            <div class="d-flex align-items-center">
                <i class="bi bi-person-circle me-2 text-muted"></i>
                ${beacon.username || 'N/A'}
            </div>
        </td>
        <td>
            <code class="bg-light px-2 py-1 rounded">${beacon.ip || 'N/A'}</code>
        </td>
        <td>
            <div class="small">
                <div class="fw-medium">${beacon.process_name || 'N/A'}</div>
                <div class="text-muted">PID: ${beacon.process_id || 'N/A'}</div>
            </div>
        </td>
        <td>
            <span class="badge bg-secondary">${beacon.arch || 'N/A'}</span>
        </td>
        <td>
            <small class="text-muted">${formatDate(beacon.first_time)}</small>
        </td>
        <td>
            <small class="text-muted">${formatDate(beacon.last_seen)}</small>
        </td>
        <td>
            ${beacon.job ? `<span class="badge bg-info">${beacon.job}</span>` : '<span class="text-muted">None</span>'}
        </td>
        <td>
            <div class="btn-group btn-group-sm" role="group">
                <button class="btn btn-outline-primary" onclick="showTaskModal('${beacon.uuid}')" title="Send Task">
                    <i class="bi bi-send"></i>
                </button>
                <button class="btn btn-outline-success" onclick="showTaskHistory('${beacon.uuid}')" title="Task History">
                    <i class="bi bi-clock-history"></i>
                </button>
                <button class="btn btn-outline-info" onclick="viewDetails('${beacon.uuid}')" title="View Details">
                    <i class="bi bi-eye"></i>
                </button>
            </div>
        </td>
    `;
    
    return row;
}

// 获取状态图标
function getStatusIcon(status) {
    switch (status) {
        case 'online':
            return '<i class="bi bi-circle-fill text-success"></i>';
        case 'warning':
            return '<i class="bi bi-circle-fill text-warning"></i>';
        case 'offline':
            return '<i class="bi bi-circle-fill text-danger"></i>';
        default:
            return '<i class="bi bi-circle text-muted"></i>';
    }
}

// 获取状态徽章
function getStatusBadge(status) {
    switch (status) {
        case 'online':
            return '<span class="badge bg-success">Online</span>';
        case 'warning':
            return '<span class="badge bg-warning">Warning</span>';
        case 'offline':
            return '<span class="badge bg-danger">Offline</span>';
        default:
            return '<span class="badge bg-secondary">Unknown</span>';
    }
}

// 显示错误消息
function showError(message) {
    console.error('Error:', message);
    
    // 简单的错误显示
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-danger alert-dismissible fade show';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    const container = document.querySelector('.container-fluid');
    if (container) {
        container.insertBefore(alertDiv, container.firstChild);
        
        // 自动隐藏
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }
}

// 页面初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing beacons page');
    
    // 检查认证
    if (!checkAuth()) return;
    
    // 加载数据
    loadBeacons();
    
    // 设置搜索
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            applyFilters();
            renderBeacons();
        });
    }
    
    // 设置过滤器
    window.filterBeacons = function(filter) {
        currentFilter = filter;
        applyFilters();
        renderBeacons();
    };
    
    // 设置刷新
    window.refreshBeacons = function() {
        loadBeacons();
    };
    
    // 定时刷新（30秒）
    setInterval(loadBeacons, 30000);
    
    console.log('Beacons page initialization complete');
});

// 显示任务历史
window.showTaskHistory = function(uuid) {
    console.log('Show task history for:', uuid);
    loadTaskHistory(uuid);
};

// 显示任务发送模态框
window.showTaskModal = function(uuid) {
    console.log('Show task modal for:', uuid);

    // 使用HTML中已有的taskModal而不是动态创建
    const beacon = allBeacons.find(b => b.uuid === uuid);
    if (!beacon) {
        console.error('Beacon not found:', uuid);
        return;
    }

    // 设置beacon信息
    const beaconInfo = document.getElementById('targetBeaconInfo');
    if (beaconInfo) {
        beaconInfo.textContent = `${beacon.hostname} (${beacon.ip}) - ${beacon.username}`;
    }

    // 设置UUID
    const beaconUuidInput = document.getElementById('beaconUUID');
    if (beaconUuidInput) {
        beaconUuidInput.value = uuid;
    }

    // 重置表单
    const taskForm = document.getElementById('taskForm');
    if (taskForm) {
        taskForm.reset();
        taskForm.classList.remove('was-validated');
    }

    // 隐藏所有条件字段
    const sleepTimeDiv = document.getElementById('sleepTimeDiv');
    const shellcodeDiv = document.getElementById('shellcodeDiv');
    const commandDiv = document.getElementById('commandDiv');

    if (sleepTimeDiv) sleepTimeDiv.style.display = 'none';
    if (shellcodeDiv) shellcodeDiv.style.display = 'none';
    if (commandDiv) commandDiv.style.display = 'none';

    // 显示模态框
    const modal = new bootstrap.Modal(document.getElementById('taskModal'));
    modal.show();
};

// 查看详情
window.viewDetails = function(uuid) {
    console.log('View details for:', uuid);
    showBeaconDetails(uuid);
};

// 加载任务历史
async function loadTaskHistory(uuid) {
    const data = await apiCall(`${getApiPrefix()}/beacons/${uuid}/history`);
    if (!data) return;

    if (data.status === 'success') {
        displayTaskHistory(uuid, data.data || []);
    } else {
        showError('Failed to load task history');
    }
}

// 显示任务历史
function displayTaskHistory(uuid, history) {
    const beacon = allBeacons.find(b => b.uuid === uuid);
    const beaconName = beacon ? beacon.hostname : uuid;

    const historyHtml = history.length > 0 ?
        history.map(task => `
            <div class="task-history-item mb-3 p-3 border rounded">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <h6 class="mb-0">${task.task_type || 'Unknown Task'}</h6>
                    <small class="text-muted">${formatDate(task.created_at)}</small>
                </div>
                <div class="mb-2">
                    <strong>Command:</strong> <code>${task.command || 'N/A'}</code>
                </div>
                <div class="mb-2">
                    <strong>Status:</strong>
                    <span class="badge ${getTaskStatusBadge(task.status)}">${task.status || 'Unknown'}</span>
                </div>
                ${task.result ? `
                    <div class="mb-2">
                        <strong>Result:</strong>
                        <pre class="bg-light p-2 rounded mt-1" style="max-height: 200px; overflow-y: auto;">${task.result}</pre>
                    </div>
                ` : ''}
            </div>
        `).join('') :
        '<div class="text-center text-muted py-4">No task history found</div>';

    const modalHtml = `
        <div class="modal fade" id="taskHistoryModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="bi bi-clock-history me-2"></i>
                            Task History - ${beaconName}
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body" style="max-height: 500px; overflow-y: auto;">
                        ${historyHtml}
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        <button type="button" class="btn btn-primary" onclick="loadTaskHistory('${uuid}')">
                            <i class="bi bi-arrow-clockwise me-2"></i>Refresh
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // 移除现有模态框
    const existingModal = document.getElementById('taskHistoryModal');
    if (existingModal) {
        existingModal.remove();
    }

    // 添加新模态框
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // 显示模态框
    const modal = new bootstrap.Modal(document.getElementById('taskHistoryModal'));
    modal.show();
}

// 获取任务状态徽章样式
function getTaskStatusBadge(status) {
    switch (status?.toLowerCase()) {
        case 'completed': return 'bg-success';
        case 'pending': return 'bg-warning';
        case 'failed': return 'bg-danger';
        case 'running': return 'bg-info';
        default: return 'bg-secondary';
    }
}

// 显示发送任务模态框
function showSendTaskModal(uuid) {
    const beacon = allBeacons.find(b => b.uuid === uuid);
    const beaconName = beacon ? beacon.hostname : uuid;

    const modalHtml = `
        <div class="modal fade" id="sendTaskModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="bi bi-send me-2"></i>
                            Send Task - ${beaconName}
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="sendTaskForm">
                            <div class="mb-3">
                                <label for="taskType" class="form-label">Task Type</label>
                                <select class="form-select" id="taskType" required>
                                    <option value="">Select task type...</option>
                                    <option value="0x1A">Sleep (Set beacon sleep time)</option>
                                    <option value="0x1B">Process List (Get running processes)</option>
                                    <option value="0x1C">Shellcode (Execute shellcode)</option>
                                    <option value="0x1D">Execute Command (Run system command)</option>
                                </select>
                            </div>
                            <div class="mb-3" id="taskDataContainer" style="display: none;">
                                <label for="taskData" class="form-label">Task Data</label>
                                <input type="text" class="form-control" id="taskData" placeholder="Enter task data...">
                                <div class="form-text" id="taskDataHelp"></div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" onclick="sendTask('${uuid}')">
                            <i class="bi bi-send me-2"></i>Send Task
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // 移除现有模态框
    const existingModal = document.getElementById('sendTaskModal');
    if (existingModal) {
        existingModal.remove();
    }

    // 添加新模态框
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // 设置任务类型变化事件
    document.getElementById('taskType').addEventListener('change', function() {
        const taskDataContainer = document.getElementById('taskDataContainer');
        const taskData = document.getElementById('taskData');
        const taskDataHelp = document.getElementById('taskDataHelp');

        if (this.value === '0x1A') {
            taskDataContainer.style.display = 'block';
            taskData.placeholder = 'Enter sleep time in seconds (e.g., 30)';
            taskDataHelp.textContent = 'Sleep time in seconds';
            taskData.required = true;
        } else if (this.value === '0x1B') {
            taskDataContainer.style.display = 'none';
            taskData.required = false;
        } else if (this.value === '0x1C') {
            taskDataContainer.style.display = 'block';
            taskData.placeholder = 'Enter shellcode in hex format';
            taskDataHelp.textContent = 'Shellcode in hexadecimal format';
            taskData.required = true;
        } else if (this.value === '0x1D') {
            taskDataContainer.style.display = 'block';
            taskData.placeholder = 'Enter command to execute (e.g., dir, whoami, ipconfig)';
            taskDataHelp.textContent = 'Command will be executed with cmd.exe /c (timeout: 60 seconds)';
            taskData.required = true;
        } else {
            taskDataContainer.style.display = 'none';
            taskData.required = false;
        }
    });

    // 显示模态框
    const modal = new bootstrap.Modal(document.getElementById('sendTaskModal'));
    modal.show();
}

// 发送任务
async function sendTask(uuid) {
    const taskType = document.getElementById('taskType').value;
    const taskData = document.getElementById('taskData').value;

    if (!taskType) {
        showError('Please select a task type');
        return;
    }

    if (document.getElementById('taskData').required && !taskData) {
        showError('Please enter task data');
        return;
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
        showSuccess('Task sent successfully');

        // 关闭模态框
        const modal = bootstrap.Modal.getInstance(document.getElementById('sendTaskModal'));
        modal.hide();

        // 刷新beacon列表
        loadBeacons();
    } else {
        showError('Failed to send task');
    }
}

// 显示Beacon详情
function showBeaconDetails(uuid) {
    const beacon = allBeacons.find(b => b.uuid === uuid);
    if (!beacon) {
        showError('Beacon not found');
        return;
    }

    const status = getBeaconStatus(beacon.last_seen);
    const statusIcon = getStatusIcon(status);
    const statusBadge = getStatusBadge(status);

    const modalHtml = `
        <div class="modal fade" id="beaconDetailsModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="bi bi-info-circle me-2"></i>
                            Beacon Details - ${beacon.hostname}
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row">
                            <div class="col-md-6">
                                <h6>Basic Information</h6>
                                <table class="table table-sm">
                                    <tr><td><strong>UUID:</strong></td><td><code>${beacon.uuid}</code></td></tr>
                                    <tr><td><strong>Hostname:</strong></td><td>${beacon.hostname}</td></tr>
                                    <tr><td><strong>Username:</strong></td><td>${beacon.username}</td></tr>
                                    <tr><td><strong>IP Address:</strong></td><td><code>${beacon.ip}</code></td></tr>
                                    <tr><td><strong>Architecture:</strong></td><td><span class="badge bg-secondary">${beacon.arch}</span></td></tr>
                                    <tr><td><strong>Status:</strong></td><td>${statusIcon} ${statusBadge}</td></tr>
                                </table>
                            </div>
                            <div class="col-md-6">
                                <h6>Process Information</h6>
                                <table class="table table-sm">
                                    <tr><td><strong>Process Name:</strong></td><td>${beacon.process_name}</td></tr>
                                    <tr><td><strong>Process ID:</strong></td><td>${beacon.process_id}</td></tr>
                                    <tr><td><strong>Process Path:</strong></td><td><small>${beacon.process_path}</small></td></tr>
                                </table>

                                <h6>Timing Information</h6>
                                <table class="table table-sm">
                                    <tr><td><strong>First Seen:</strong></td><td><small>${formatDate(beacon.first_time)}</small></td></tr>
                                    <tr><td><strong>Last Seen:</strong></td><td><small>${formatDate(beacon.last_seen)}</small></td></tr>
                                </table>
                            </div>
                        </div>

                        ${beacon.job ? `
                            <div class="mt-3">
                                <h6>Current Job</h6>
                                <div class="alert alert-info">
                                    <code>${beacon.job}</code>
                                </div>
                            </div>
                        ` : ''}

                        ${beacon.job_result ? `
                            <div class="mt-3">
                                <h6>Last Job Result</h6>
                                <pre class="bg-light p-3 rounded" style="max-height: 200px; overflow-y: auto;">${beacon.job_result}</pre>
                            </div>
                        ` : ''}
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        <button type="button" class="btn btn-info" onclick="showTaskHistory('${uuid}')">
                            <i class="bi bi-clock-history me-2"></i>View History
                        </button>
                        <button type="button" class="btn btn-primary" onclick="showTaskModal('${uuid}')">
                            <i class="bi bi-send me-2"></i>Send Task
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // 移除现有模态框
    const existingModal = document.getElementById('beaconDetailsModal');
    if (existingModal) {
        existingModal.remove();
    }

    // 添加新模态框
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // 显示模态框
    const modal = new bootstrap.Modal(document.getElementById('beaconDetailsModal'));
    modal.show();
}

// 显示成功消息
function showSuccess(message) {
    console.log('Success:', message);

    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-success alert-dismissible fade show';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    const container = document.querySelector('.container-fluid');
    if (container) {
        container.insertBefore(alertDiv, container.firstChild);

        // 自动隐藏
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 3000);
    }
}
