// ==================== ЗАГРУЗКА ИНФОРМАЦИИ О ПОЛЬЗОВАТЕЛЕ ====================
async function loadUserInfo() {
    try {
        const response = await fetch('/auth/check', { credentials: 'include' });
        const data = await response.json();
        
        if (!data.authenticated) return null;
        
        const user = data.user_info;
        const expiresAt = user.expires_at ? new Date(user.expires_at) : null;
        const now = new Date();
        const isActive = user.has_subscription && expiresAt && expiresAt > now;
        
        let statusHtml = '';
        if (isActive && expiresAt) {
            const daysLeft = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
            statusHtml = `<span class="status-badge active">✅ Подписка активна, осталось ${daysLeft} дн. (до ${expiresAt.toLocaleDateString('ru-RU')})</span>`;
        } else {
            statusHtml = `<span class="status-badge expired">⚠️ Нет активной подписки</span>`;
        }
        
        return {
            username: user.username || user.user_id,
            userId: user.user_id,
            statusHtml: statusHtml
        };
    } catch (error) {
        console.error('Error loading user info:', error);
        return null;
    }
}

// ==================== ЗАГРУЗКА ЗАКАЗОВ ====================
async function loadOrders() {
    try {
        const response = await fetch('/api/orders', {
            credentials: 'include'
        });
        
        if (!response.ok) {
            console.error('Orders response not ok:', response.status);
            return [];
        }
        
        const orders = await response.json();
        console.log('Orders loaded:', orders.length);
        return orders;
    } catch (error) {
        console.error('Error loading orders:', error);
        return [];
    }
}

// ==================== ЗАГРУЗКА ДЕТАЛЕЙ ЗАКАЗА ====================
async function loadOrderItems(orderId) {
    try {
        const response = await fetch(`/api/orders/${orderId}/items`, {
            credentials: 'include'
        });
        if (response.ok) {
            const items = await response.json();
            return items.map(item => `${item.name} x${item.quantity}`).join(', ');
        }
        return '—';
    } catch (e) {
        console.error('Error loading order items:', e);
        return '—';
    }
}

// ==================== ФОРМАТИРОВАНИЕ ДАТЫ ====================
function formatDateTime(dateString) {
    if (!dateString) return '—';
    try {
        const date = new Date(dateString);
        return date.toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return dateString;
    }
}

// ==================== ОТОБРАЖЕНИЕ СТАТУСА ====================
function getStatusBadge(status) {
    switch (status) {
        case 'paid':
            return '<span class="status paid">✅ Оплачен</span>';
        case 'pending':
            return '<span class="status pending">⏳ Ожидает оплаты</span>';
        case 'failed':
            return '<span class="status failed">❌ Ошибка</span>';
        default:
            return '<span class="status">' + status + '</span>';
    }
}

// ==================== ОСНОВНАЯ ФУНКЦИЯ ====================
async function renderAccountHistory() {
    console.log('renderAccountHistory started');
    
    const userInfoDiv = document.getElementById('user-info');
    const ordersTableBody = document.getElementById('orders-table-body');
    const noOrdersMessage = document.getElementById('no-orders-message');
    const ordersContainer = document.getElementById('orders-container');
    
    // Загружаем и отображаем информацию о пользователе
    const userInfo = await loadUserInfo();
    
    if (userInfoDiv) {
        if (userInfo) {
            userInfoDiv.innerHTML = `
                <div class="user-info-card">
                    <h3>@${userInfo.username}</h3>
                    <p>Telegram ID: ${userInfo.userId}</p>
                    <div>${userInfo.statusHtml}</div>
                </div>
            `;
        } else {
            userInfoDiv.innerHTML = `
                <div class="user-info-card" style="text-align: center;">
                    <p style="color: #ff5722;">⚠️ Вы не авторизованы</p>
                    <p style="color: #888; font-size: 12px; margin-top: 8px;">Войдите через Telegram</p>
                    <div style="margin-top: 15px;">
                        <script async src="https://telegram.org/js/telegram-widget.js?22"
                                data-telegram-login="VePoN_bot"
                                data-size="large"
                                data-radius="8"
                                data-auth-url="https://vepon.ru/auth/telegram"
                                data-request-access="write">
                        </script>
                    </div>
                </div>
            `;
        }
    }
    
    // Загружаем заказы
    const orders = await loadOrders();
    console.log('Orders count:', orders.length);
    
    if (!orders || orders.length === 0) {
        if (noOrdersMessage) noOrdersMessage.style.display = 'block';
        if (ordersTableBody) ordersTableBody.innerHTML = '';
        return;
    }
    
    if (noOrdersMessage) noOrdersMessage.style.display = 'none';
    
    // Строим HTML заказов
    let ordersHtml = '';
    
    for (const order of orders) {
        const itemsText = await loadOrderItems(order.order_id);
        
        ordersHtml += `
            <div class="order-card">
                <div class="order-header">
                    <div class="order-id">${order.order_id}</div>
                    <div class="order-status">${getStatusBadge(order.status)}</div>
                </div>
                <div class="order-details">
                    <div class="order-date">
                        📅 ${formatDateTime(order.created_at)}
                    </div>
                    <div class="order-items">
                        <strong>Товары:</strong> ${itemsText}
                    </div>
                    <div class="order-total">
                        💰 Сумма: <strong>${order.total_rub}₽</strong>
                    </div>
                    ${order.paid_at ? `<div class="order-paid">✅ Оплачен: ${formatDateTime(order.paid_at)}</div>` : ''}
                </div>
            </div>
        `;
    }
    
    if (ordersTableBody) {
        ordersTableBody.innerHTML = ordersHtml;
    }
    
    if (ordersContainer) ordersContainer.style.display = 'block';
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing account history');
    renderAccountHistory();
});