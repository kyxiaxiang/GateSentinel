// Get token
const token = localStorage.getItem('token');

// If no token, redirect to login page
if (!token) {
    const loginPath = window.APP_CONFIG ? window.APP_CONFIG.loginPath : '/login';
    window.location.href = loginPath;
}

// 获取API前缀
function getApiPrefix() {
    return window.APP_CONFIG ? window.APP_CONFIG.apiPrefix : '/web/admin/api';
}

// Load current settings
async function loadSettings() {
    try {
        const response = await fetch(getApiPrefix() + '/config', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.status === 401) {
            // Token expired, redirect to login page
            const loginPath = window.APP_CONFIG ? window.APP_CONFIG.loginPath : '/login';
            window.location.href = loginPath;
            return;
        }

        if (!response.ok) {
            throw new Error('Failed to load settings');
        }

        const config = await response.json();

        // Update JWT Secret (显示为星号，不显示实际值)
        document.getElementById('jwtSecret').value = config.jwt_secret ? '••••••••••••••••' : '';

        // Update Webhook settings
        document.getElementById('webhookEnable').checked = config.webhook_enable;
        document.getElementById('webhookURL').value = config.webhook_url || '';
        document.getElementById('webhookKey').value = config.webhook_key || '';

        // Update Server settings
        if (config.server) {
            document.getElementById('serverHost').value = config.server.host || '';
            document.getElementById('serverPort').value = config.server.port || '';
            document.getElementById('readTimeout').value = config.server.read_timeout || '';
            document.getElementById('writeTimeout').value = config.server.write_timeout || '';
            document.getElementById('maxBodySize').value = config.server.max_body_size || '';
        }

        // Update Route settings
        if (config.routes) {
            document.getElementById('adminPrefix').value = config.routes.admin_prefix || '';
            document.getElementById('apiPrefix').value = config.routes.api_prefix || '';
            document.getElementById('beaconEndpoint').value = config.routes.beacon_endpoint || '';
            document.getElementById('registerPath').value = config.routes.register_path || '';
            document.getElementById('loginPath').value = config.routes.login_path || '';
        }

    } catch (error) {
        console.error('Error loading settings:', error);
        showAlert('danger', 'Failed to load settings: ' + error.message);
    }
}

// Handle password change
document.getElementById('passwordForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (newPassword !== confirmPassword) {
        showAlert('warning', 'Passwords do not match');
        return;
    }

    try {
        const response = await fetch(getApiPrefix() + '/config', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                admin_pass: newPassword
            })
        });

        if (response.status === 401) {
            window.location.href = '/login';
            return;
        }

        if (!response.ok) {
            throw new Error('Failed to update password');
        }

        showAlert('success', 'Password updated successfully');
        document.getElementById('passwordForm').reset();
    } catch (error) {
        console.error('Error updating password:', error);
        showAlert('danger', 'Failed to update password: ' + error.message);
    }
});

// Handle JWT Secret update
document.getElementById('jwtForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const jwtSecret = document.getElementById('jwtSecret').value;

    // 如果是默认的星号值，提示用户输入新值
    if (jwtSecret === '••••••••••••••••') {
        showAlert('warning', 'Please enter a new JWT secret key');
        return;
    }

    if (jwtSecret.length < 16) {
        showAlert('warning', 'JWT secret should be at least 16 characters long');
        return;
    }

    try {
        const response = await fetch(getApiPrefix() + '/config', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                jwt_secret: jwtSecret
            })
        });

        if (response.status === 401) {
            const loginPath = window.APP_CONFIG ? window.APP_CONFIG.loginPath : '/login';
            window.location.href = loginPath;
            return;
        }

        if (!response.ok) {
            throw new Error('Failed to update JWT secret');
        }

        showAlert('success', 'JWT secret updated successfully. Please re-login for security.');
        document.getElementById('jwtForm').reset();

        // 提示用户重新登录
        setTimeout(() => {
            if (confirm('JWT secret has been updated. You need to re-login for security. Logout now?')) {
                localStorage.removeItem('adminToken');
                localStorage.removeItem('token');
                const loginPath = window.APP_CONFIG ? window.APP_CONFIG.loginPath : '/login';
                window.location.href = loginPath;
            }
        }, 2000);
    } catch (error) {
        console.error('Error updating JWT secret:', error);
        showAlert('danger', 'Failed to update JWT secret: ' + error.message);
    }
});

// Handle Webhook settings
document.getElementById('webhookForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const webhookEnable = document.getElementById('webhookEnable').checked;
    const webhookURL = document.getElementById('webhookURL').value;
    const webhookKey = document.getElementById('webhookKey').value;

    try {
        const response = await fetch(getApiPrefix() + '/config', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                webhook_enable: webhookEnable,
                webhook_url: webhookURL,
                webhook_key: webhookKey
            })
        });

        if (response.status === 401) {
            const loginPath = window.APP_CONFIG ? window.APP_CONFIG.loginPath : '/login';
            window.location.href = loginPath;
            return;
        }

        if (!response.ok) {
            throw new Error('Failed to update webhook settings');
        }

        showAlert('success', 'Webhook settings saved successfully');
    } catch (error) {
        console.error('Error updating webhook settings:', error);
        showAlert('danger', 'Failed to save webhook settings: ' + error.message);
    }
});

// Handle Server configuration
document.getElementById('serverForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const serverHost = document.getElementById('serverHost').value;
    const serverPort = parseInt(document.getElementById('serverPort').value);
    const readTimeout = parseInt(document.getElementById('readTimeout').value);
    const writeTimeout = parseInt(document.getElementById('writeTimeout').value);
    const maxBodySize = parseInt(document.getElementById('maxBodySize').value);

    try {
        const response = await fetch(getApiPrefix() + '/config', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                server: {
                    host: serverHost,
                    port: serverPort,
                    read_timeout: readTimeout,
                    write_timeout: writeTimeout,
                    max_body_size: maxBodySize
                }
            })
        });

        if (response.status === 401) {
            const loginPath = window.APP_CONFIG ? window.APP_CONFIG.loginPath : '/login';
            window.location.href = loginPath;
            return;
        }

        if (!response.ok) {
            throw new Error('Failed to update server settings');
        }

        const result = await response.json();
        showAlert('success', result.message || 'Server configuration saved successfully');
    } catch (error) {
        console.error('Error updating server settings:', error);
        showAlert('danger', 'Failed to save server settings: ' + error.message);
    }
});

// Handle Route configuration
document.getElementById('routeForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const adminPrefix = document.getElementById('adminPrefix').value;
    const apiPrefix = document.getElementById('apiPrefix').value;
    const beaconEndpoint = document.getElementById('beaconEndpoint').value;
    const registerPath = document.getElementById('registerPath').value;
    const loginPath = document.getElementById('loginPath').value;

    try {
        const response = await fetch(getApiPrefix() + '/config', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                routes: {
                    admin_prefix: adminPrefix,
                    api_prefix: apiPrefix,
                    beacon_endpoint: beaconEndpoint,
                    register_path: registerPath,
                    login_path: loginPath
                }
            })
        });

        if (response.status === 401) {
            const loginPath = window.APP_CONFIG ? window.APP_CONFIG.loginPath : '/login';
            window.location.href = loginPath;
            return;
        }

        if (!response.ok) {
            throw new Error('Failed to update route settings');
        }

        const result = await response.json();
        showAlert('success', result.message || 'Route configuration saved successfully');

        // 提示用户刷新页面以应用新的路由配置
        setTimeout(() => {
            if (confirm('Route configuration updated! Would you like to refresh the page to apply changes?')) {
                window.location.reload();
            }
        }, 1500);
    } catch (error) {
        console.error('Error updating route settings:', error);
        showAlert('danger', 'Failed to save route settings: ' + error.message);
    }
});

// Reload configuration from file
async function reloadConfig() {
    if (!token) {
        showAlert('warning', 'Please login first');
        return;
    }

    try {
        const response = await fetch(getApiPrefix() + '/config/reload', {
            method: 'POST',
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
            throw new Error('Failed to reload configuration');
        }

        const result = await response.json();
        showAlert('success', result.message || 'Configuration reloaded successfully');

        // 重新加载设置显示
        setTimeout(() => {
            loadSettings();
        }, 1000);
    } catch (error) {
        console.error('Error reloading config:', error);
        showAlert('danger', 'Failed to reload configuration: ' + error.message);
    }
}

// Alert helper function
function showAlert(type, message) {
    // Remove existing alerts
    const existingAlerts = document.querySelectorAll('.alert');
    existingAlerts.forEach(alert => alert.remove());

    // Create new alert
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    // Insert at the top of the container
    const container = document.querySelector('.container-fluid');
    container.insertBefore(alertDiv, container.firstChild);

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}

// Load settings after page loads
document.addEventListener('DOMContentLoaded', loadSettings);