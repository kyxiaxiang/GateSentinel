/**
 * Enhanced login form submission with XSS protection and improved UX
 */
async function handleLogin(event) {
    event.preventDefault();

    const form = event.target;
    const loginButton = document.getElementById('loginButton');
    const usernameField = document.getElementById('username');
    const passwordField = document.getElementById('password');

    // Clear previous validation states
    clearValidation();

    // Get and sanitize form data
    const rawUsername = usernameField.value;
    const rawPassword = passwordField.value;

    // Sanitize inputs using security manager
    const username = security.sanitizeFormInput(rawUsername, 'username');
    const password = security.sanitizeFormInput(rawPassword, 'password');

    // Validate sanitized inputs
    if (rawUsername !== username) {
        showFieldError(usernameField, 'Username contains invalid characters');
        return false;
    }

    // Client-side validation
    if (!validateForm(username, password)) {
        return false;
    }

    // Set loading state
    setLoadingState(true);

    try {
        // Generate secure request token
        const requestToken = security.generateSecureToken(16);

        // Send login request with timeout and security headers
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const apiPrefix = window.APP_CONFIG ? window.APP_CONFIG.apiPrefix : '/web/admin/api';
        const response = await fetch(apiPrefix + '/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-Request-Token': requestToken
            },
            body: JSON.stringify({
                username: username,
                password: password,
                requestToken: requestToken,
                timestamp: Date.now()
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        // Validate response
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.status === 'success' && data.token) {
            // Validate token format (basic check)
            if (typeof data.token !== 'string' || data.token.length < 10) {
                throw new Error('Invalid token received');
            }

            // Save token securely
            localStorage.setItem('token', data.token);
            localStorage.setItem('loginTime', Date.now().toString());

            // Show success message
            showSuccess('Login successful! Redirecting...');

            // Clear form for security
            form.reset();

            // Redirect with delay for better UX
            setTimeout(() => {
                const adminPrefix = window.APP_CONFIG ? window.APP_CONFIG.adminPrefix : '/web/admin';
                window.location.href = adminPrefix + '/beacons';
            }, 1000);
        } else {
            // Login failed
            const errorMessage = security.sanitizeText(data.error || 'Invalid credentials');
            showError(errorMessage);

            // Focus on username field for retry
            usernameField.focus();
            usernameField.select();
        }
    } catch (error) {
        console.error('Login error:', error);

        let errorMessage = 'An error occurred during login';

        if (error.name === 'AbortError') {
            errorMessage = 'Request timeout. Please check your connection and try again.';
        } else if (error.message.includes('HTTP')) {
            errorMessage = 'Server error. Please try again later.';
        } else {
            errorMessage = 'Network error. Please check your connection and try again.';
        }

        showError(errorMessage);

        // Log security event
        security.logSecurityEvent('login_error', {
            error: error.message,
            username: username.substring(0, 3) + '***' // Partial username for debugging
        });
    } finally {
        setLoadingState(false);
    }

    return false;
}

// Validate form inputs
function validateForm(username, password) {
    let isValid = true;
    const usernameField = document.getElementById('username');
    const passwordField = document.getElementById('password');

    if (!username) {
        showFieldError(usernameField, 'Username is required');
        isValid = false;
    } else if (username.length < 3) {
        showFieldError(usernameField, 'Username must be at least 3 characters');
        isValid = false;
    }

    if (!password) {
        showFieldError(passwordField, 'Password is required');
        isValid = false;
    } else if (password.length < 6) {
        showFieldError(passwordField, 'Password must be at least 6 characters');
        isValid = false;
    }

    return isValid;
}

// Show field-specific error
function showFieldError(field, message) {
    field.classList.add('is-invalid');
    const feedback = field.parentNode.querySelector('.invalid-feedback');
    if (feedback) {
        feedback.textContent = message;
    }
}

// Clear validation states
function clearValidation() {
    const fields = document.querySelectorAll('.form-control');
    fields.forEach(field => {
        field.classList.remove('is-invalid', 'is-valid');
    });
}

// Set loading state
function setLoadingState(loading) {
    const loginButton = document.getElementById('loginButton');
    const usernameField = document.getElementById('username');
    const passwordField = document.getElementById('password');

    if (loading) {
        loginButton.classList.add('loading');
        loginButton.disabled = true;
        usernameField.disabled = true;
        passwordField.disabled = true;
    } else {
        loginButton.classList.remove('loading');
        loginButton.disabled = false;
        usernameField.disabled = false;
        passwordField.disabled = false;
    }
}

// Show error message with enhanced styling
function showError(message) {
    showAlert(message, 'danger', 'bi-exclamation-triangle');
}

// Show success message
function showSuccess(message) {
    showAlert(message, 'success', 'bi-check-circle');
}

// Generic alert function
function showAlert(message, type, icon) {
    // Remove old alerts
    const oldAlerts = document.querySelectorAll('.alert');
    oldAlerts.forEach(alert => alert.remove());

    // Create new alert
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.role = 'alert';
    alert.innerHTML = `
        <i class="bi ${icon} me-2"></i>
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;

    // Insert before the form
    const form = document.getElementById('loginForm');
    form.parentNode.insertBefore(alert, form);

    // Auto-hide after 5 seconds (except for success messages)
    if (type !== 'success') {
        setTimeout(() => {
            if (alert.parentNode) {
                alert.remove();
            }
        }, 5000);
    }
}

// Toggle password visibility
function togglePassword() {
    const passwordField = document.getElementById('password');
    const toggleIcon = document.getElementById('passwordToggleIcon');

    if (passwordField.type === 'password') {
        passwordField.type = 'text';
        toggleIcon.className = 'bi bi-eye-slash';
    } else {
        passwordField.type = 'password';
        toggleIcon.className = 'bi bi-eye';
    }
}

// Enhanced keyboard navigation
document.addEventListener('DOMContentLoaded', function() {
    const usernameField = document.getElementById('username');
    const passwordField = document.getElementById('password');
    const loginButton = document.getElementById('loginButton');

    // Focus username field on page load
    usernameField.focus();

    // Enter key navigation
    usernameField.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            passwordField.focus();
        }
    });

    // Real-time validation feedback
    usernameField.addEventListener('input', function() {
        if (this.value.trim().length >= 3) {
            this.classList.remove('is-invalid');
            this.classList.add('is-valid');
        } else {
            this.classList.remove('is-valid');
        }
    });

    passwordField.addEventListener('input', function() {
        if (this.value.length >= 6) {
            this.classList.remove('is-invalid');
            this.classList.add('is-valid');
        } else {
            this.classList.remove('is-valid');
        }
    });

    // Caps Lock detection
    document.addEventListener('keydown', function(e) {
        if (e.getModifierState && e.getModifierState('CapsLock')) {
            showCapsLockWarning(true);
        }
    });

    document.addEventListener('keyup', function(e) {
        if (e.getModifierState && !e.getModifierState('CapsLock')) {
            showCapsLockWarning(false);
        }
    });
});

// Show/hide caps lock warning
function showCapsLockWarning(show) {
    let warning = document.getElementById('capsLockWarning');

    if (show && !warning) {
        warning = document.createElement('div');
        warning.id = 'capsLockWarning';
        warning.className = 'alert alert-warning mt-2 mb-0';
        warning.innerHTML = '<i class="bi bi-exclamation-triangle me-2"></i>Caps Lock is on';

        const passwordField = document.getElementById('password');
        passwordField.parentNode.appendChild(warning);
    } else if (!show && warning) {
        warning.remove();
    }
}

// 完全重写的登录脚本 - 无API调用
console.log('Login page loaded - new version');

// 清理localStorage
localStorage.removeItem('token');
localStorage.removeItem('loginTime');
console.log('Cleared localStorage');