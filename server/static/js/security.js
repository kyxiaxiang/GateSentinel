/**
 * Security Module - XSS Protection and Input Sanitization
 * Provides comprehensive protection against XSS attacks
 */

class SecurityManager {
    constructor() {
        this.initCSP();
        this.setupGlobalProtection();
    }

    /**
     * Initialize Content Security Policy
     */
    initCSP() {
        // Add CSP meta tag if not present
        if (!document.querySelector('meta[http-equiv="Content-Security-Policy"]')) {
            const cspMeta = document.createElement('meta');
            cspMeta.setAttribute('http-equiv', 'Content-Security-Policy');
            cspMeta.setAttribute('content', this.getCSPPolicy());
            document.head.appendChild(cspMeta);
        }
    }

    /**
     * Get Content Security Policy
     */
    getCSPPolicy() {
        return [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com",
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net",
            "img-src 'self' data: https:",
            "connect-src 'self'",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'"
        ].join('; ');
    }

    /**
     * Setup global protection mechanisms
     */
    setupGlobalProtection() {
        // Prevent clickjacking
        if (window.top !== window.self) {
            window.top.location = window.self.location;
        }

        // Disable right-click context menu in production
        if (window.location.hostname !== 'localhost') {
            document.addEventListener('contextmenu', e => e.preventDefault());
        }

        // Prevent drag and drop of external content
        document.addEventListener('dragover', e => e.preventDefault());
        document.addEventListener('drop', e => e.preventDefault());

        // Monitor for suspicious activity
        this.setupSecurityMonitoring();
    }

    /**
     * Sanitize HTML content to prevent XSS
     */
    sanitizeHTML(input) {
        if (typeof input !== 'string') {
            return '';
        }

        // Create a temporary div to parse HTML
        const temp = document.createElement('div');
        temp.textContent = input;
        
        // Additional sanitization rules
        let sanitized = temp.innerHTML;
        
        // Remove dangerous patterns
        const dangerousPatterns = [
            /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
            /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
            /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
            /<link\b[^>]*>/gi,
            /<meta\b[^>]*>/gi,
            /javascript:/gi,
            /vbscript:/gi,
            /data:text\/html/gi,
            /on\w+\s*=/gi
        ];

        dangerousPatterns.forEach(pattern => {
            sanitized = sanitized.replace(pattern, '');
        });

        return sanitized;
    }

    /**
     * Sanitize text content
     */
    sanitizeText(input) {
        if (typeof input !== 'string') {
            return '';
        }

        return input
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    }

    /**
     * Validate and sanitize form input
     */
    sanitizeFormInput(input, type = 'text') {
        if (typeof input !== 'string') {
            return '';
        }

        let sanitized = input.trim();

        switch (type) {
            case 'username':
                // Allow only alphanumeric characters, underscore, and hyphen
                sanitized = sanitized.replace(/[^a-zA-Z0-9_-]/g, '');
                break;
            
            case 'password':
                // Remove null bytes and control characters
                sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
                break;
            
            case 'email':
                // Basic email sanitization
                sanitized = sanitized.toLowerCase().replace(/[^a-z0-9@._-]/g, '');
                break;
            
            case 'filename':
                // Safe filename characters only
                sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '');
                break;
            
            case 'number':
                // Numbers only
                sanitized = sanitized.replace(/[^0-9.-]/g, '');
                break;
            
            default:
                // General text sanitization
                sanitized = this.sanitizeText(sanitized);
        }

        return sanitized;
    }

    /**
     * Validate file upload
     */
    validateFileUpload(file, allowedTypes = [], maxSize = 4 * 1024 * 1024) {
        const errors = [];

        if (!file) {
            errors.push('No file selected');
            return { valid: false, errors };
        }

        // Check file size
        if (file.size > maxSize) {
            errors.push(`File size exceeds ${this.formatFileSize(maxSize)} limit`);
        }

        // Check file type
        if (allowedTypes.length > 0) {
            const fileExtension = file.name.split('.').pop().toLowerCase();
            if (!allowedTypes.includes(fileExtension)) {
                errors.push(`File type .${fileExtension} is not allowed`);
            }
        }

        // Check for suspicious file names
        const suspiciousPatterns = [
            /\.exe$/i,
            /\.bat$/i,
            /\.cmd$/i,
            /\.scr$/i,
            /\.pif$/i,
            /\.com$/i,
            /\.jar$/i,
            /\.php$/i,
            /\.asp$/i,
            /\.jsp$/i
        ];

        if (suspiciousPatterns.some(pattern => pattern.test(file.name))) {
            errors.push('File type is not allowed for security reasons');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Setup security monitoring
     */
    setupSecurityMonitoring() {
        // Monitor for suspicious DOM modifications
        if (window.MutationObserver) {
            const observer = new MutationObserver(mutations => {
                mutations.forEach(mutation => {
                    if (mutation.type === 'childList') {
                        mutation.addedNodes.forEach(node => {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                this.scanElementForThreats(node);
                            }
                        });
                    }
                });
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }

        // Monitor for suspicious console activity
        this.monitorConsole();
    }

    /**
     * Scan element for security threats
     */
    scanElementForThreats(element) {
        // Check for suspicious attributes
        const suspiciousAttributes = ['onload', 'onerror', 'onclick', 'onmouseover'];
        
        suspiciousAttributes.forEach(attr => {
            if (element.hasAttribute(attr)) {
                console.warn('Security: Suspicious attribute detected:', attr);
                element.removeAttribute(attr);
            }
        });

        // Check for suspicious content
        if (element.innerHTML && element.innerHTML.includes('javascript:')) {
            console.warn('Security: Suspicious content detected');
            element.innerHTML = this.sanitizeHTML(element.innerHTML);
        }
    }

    /**
     * Monitor console for suspicious activity
     */
    monitorConsole() {
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;

        console.log = (...args) => {
            this.logSecurityEvent('console.log', args);
            originalLog.apply(console, args);
        };

        console.error = (...args) => {
            this.logSecurityEvent('console.error', args);
            originalError.apply(console, args);
        };

        console.warn = (...args) => {
            this.logSecurityEvent('console.warn', args);
            originalWarn.apply(console, args);
        };
    }

    /**
     * Log security events
     */
    logSecurityEvent(type, data) {
        // In production, send to security monitoring service
        if (window.location.hostname !== 'localhost') {
            // Send to backend security log
            fetch('/api/security/log', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type,
                    data: JSON.stringify(data),
                    timestamp: new Date().toISOString(),
                    userAgent: navigator.userAgent,
                    url: window.location.href
                })
            }).catch(() => {
                // Silently fail to avoid breaking the application
            });
        }
    }

    /**
     * Format file size for display
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Generate secure random token
     */
    generateSecureToken(length = 32) {
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }
}

// Initialize security manager
const security = new SecurityManager();

// Export for use in other modules
window.SecurityManager = SecurityManager;
window.security = security;
