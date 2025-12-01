/**
 * Simple notification system for user feedback
 */

function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(n => n.remove());

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    // Add icon based on type
    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
    notification.innerHTML = `<span class="notification-icon">${icon}</span><span class="notification-message">${message}</span>`;

    // Add to body
    document.body.appendChild(notification);

    // Trigger animation
    setTimeout(() => notification.classList.add('show'), 10);

    // Auto remove after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add notification styles to the page
const notificationStyles = `
<style>
.notification {
    position: fixed;
    top: 80px;
    right: 20px;
    background: white;
    padding: 15px 20px;
    border-radius: 8px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
    display: flex;
    align-items: center;
    gap: 12px;
    opacity: 0;
    transform: translateX(400px);
    transition: all 0.3s ease;
    z-index: 10000;
    min-width: 280px;
    max-width: 400px;
    border-left: 4px solid #6366f1;
}

.notification.show {
    opacity: 1;
    transform: translateX(0);
}

.notification-icon {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    flex-shrink: 0;
    font-size: 14px;
}

.notification-message {
    flex: 1;
    font-size: 0.9rem;
    color: #1e293b;
}

.notification-success {
    border-left-color: #10b981;
}

.notification-success .notification-icon {
    background: #d1fae5;
    color: #10b981;
}

.notification-error {
    border-left-color: #ef4444;
}

.notification-error .notification-icon {
    background: #fee2e2;
    color: #ef4444;
}

.notification-info {
    border-left-color: #6366f1;
}

.notification-info .notification-icon {
    background: #e0e7ff;
    color: #6366f1;
}
</style>
`;

// Inject styles when script loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        document.head.insertAdjacentHTML('beforeend', notificationStyles);
    });
} else {
    document.head.insertAdjacentHTML('beforeend', notificationStyles);
}
