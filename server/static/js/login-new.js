// 简化的登录脚本 - 避免无限循环
console.log('Login page loaded');

// 清理可能存在的无效token
function cleanupInvalidToken() {
    const token = localStorage.getItem('token');
    if (token) {
        console.log('Found existing token, removing it to avoid conflicts');
        localStorage.removeItem('token');
        localStorage.removeItem('loginTime');
    }
}

// 页面加载时清理token
cleanupInvalidToken();

// 登录函数
async function login(username, password) {
    try {
        console.log('Attempting login for user:', username);
        
        const apiPrefix = window.APP_CONFIG ? window.APP_CONFIG.apiPrefix : '/web/admin/api';
        const response = await fetch(apiPrefix + '/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: username,
                password: password
            })
        });

        const data = await response.json();
        console.log('Login response:', data);

        if (data.status === 'success' && data.token) {
            // 保存token
            localStorage.setItem('token', data.token);
            localStorage.setItem('loginTime', Date.now().toString());
            
            console.log('Login successful, redirecting...');
            
            // 显示成功消息
            showMessage('Login successful! Redirecting...', 'success');
            
            // 延迟重定向
            setTimeout(() => {
                const adminPrefix = window.APP_CONFIG ? window.APP_CONFIG.adminPrefix : '/web/admin';
                window.location.href = adminPrefix + '/beacons';
            }, 1000);
            
            return true;
        } else {
            throw new Error(data.error || 'Login failed');
        }
    } catch (error) {
        console.error('Login error:', error);
        showMessage('Login failed: ' + error.message, 'error');
        return false;
    }
}

// 显示消息
function showMessage(message, type) {
    // 移除现有消息
    const existingAlert = document.querySelector('.alert');
    if (existingAlert) {
        existingAlert.remove();
    }

    // 创建新消息
    const alertClass = type === 'success' ? 'alert-success' : 'alert-danger';
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert ${alertClass} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    // 插入到表单前面
    const form = document.getElementById('loginForm');
    form.parentNode.insertBefore(alertDiv, form);

    // 自动隐藏成功消息
    if (type === 'success') {
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 3000);
    }
}

// 表单提交处理
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, setting up login form');
    
    const form = document.getElementById('loginForm');
    const submitBtn = document.getElementById('loginBtn');
    const usernameField = document.getElementById('username');
    const passwordField = document.getElementById('password');

    if (!form) {
        console.error('Login form not found');
        return;
    }

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const username = usernameField.value.trim();
        const password = passwordField.value;

        if (!username || !password) {
            showMessage('Please enter both username and password', 'error');
            return;
        }

        // 禁用提交按钮
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Logging in...';

        try {
            await login(username, password);
        } finally {
            // 重新启用提交按钮
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="bi bi-box-arrow-in-right me-2"></i>Sign In';
        }
    });

    // 回车键提交
    [usernameField, passwordField].forEach(field => {
        field.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                form.dispatchEvent(new Event('submit'));
            }
        });
    });

    console.log('Login form setup complete');
});
