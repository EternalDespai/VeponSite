// ==================== АВТОРИЗАЦИЯ ====================
async function checkAuth() {
    try {
        const response = await fetch('/auth/check', {
            credentials: 'include'
        });
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Auth check error:', error);
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
            if (response.status === 401) {
                return { error: 'unauthorized' };
            }
            throw new Error('Failed to load orders');
        }
        const orders = await response.json();
        return orders;
    } catch (error) {
        console.error('Error loading orders:', error);
        return [];
    }
}

// ==================== ФОРМАТИРОВАНИЕ ДАТЫ ====================
function formatDate(dateString) {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function formatDateTime(dateString) {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
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
    // Проверяем авторизацию
    const auth = await checkAuth();
    const userInfoDiv = document.getElementById('user-info');
    const ordersTableBody = document.getElementById('orders-table-body');
    const noOrdersMessage = document.getElementById('no-orders-message');
    const ordersContainer = document.getElementById('orders-container');
    
    if (!auth || !auth.authenticated) {
        // Пользователь не авторизован
        if (userInfoDiv) {
            userInfoDiv.innerHTML = `
                <div style="text-align: center; padding: 30px;">
                    <p style="color: #ff5722;">⚠️ Вы не авторизованы</p>
                    <p style="color: #888; font-size: 14px; margin-top: 10px;">Для просмотра истории заказов необходимо войти через Telegram</p>
                    <div style="margin-top: 20px;">
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
        if (ordersContainer) ordersContainer.style.display = 'none';
        return;
    }
    
    // Показываем информацию о пользователе
    if (userInfoDiv && auth.user_info) {
        userInfoDiv.innerHTML = `
            <div class="user-info-card">
                <h3>${auth.user_info.username || 'Пользователь'}</h3>
                <p style="color: #888; font-size: 14px;">Telegram ID: ${auth.user_id}</p>
                ${auth.user_info.has_subscription ? 
                    `<p style="color: #4CAF50; font-size: 13px;">✅ Подписка активна</p>` : 
                    `<p style="color: #ff5722; font-size: 13px;">⚠️ Нет активной подписки</p>`
                }
            </div>
        `;
    }
    
    // Загружаем заказы
    const orders = await loadOrders();
    
    if (orders.error === 'unauthorized') {
        if (userInfoDiv) {
            userInfoDiv.innerHTML = `
                <div style="text-align: center; padding: 30px;">
                    <p>⚠️ Сессия истекла</p>
                    <a href="checkout.html" class="btn primary">Войти заново</a>
                </div>
            `;
        }
        return;
    }
    
    if (!orders || orders.length === 0) {
        if (noOrdersMessage) noOrdersMessage.style.display = 'block';
        if (ordersTableBody) ordersTableBody.innerHTML = '';
        return;
    }
    
    if (noOrdersMessage) noOrdersMessage.style.display = 'none';
    
    // Загружаем детали заказов (товары)
    let ordersHtml = '';
    
    for (const order of orders) {
        // Получаем товары для заказа
        let itemsHtml = '';
        try {
            const itemsResponse = await fetch(`/api/orders/${order.order_id}/items`, {
                credentials: 'include'
            });
            if (itemsResponse.ok) {
                const items = await itemsResponse.json();
                itemsHtml = items.map(item => 
                    `<div class="order-item">${item.name} x${item.quantity}</div>`
                ).join('');
            } else {
                itemsHtml = '<div class="order-item">—</div>';
            }
        } catch (e) {
            itemsHtml = '<div class="order-item">—</div>';
        }
        
        ordersHtml += `
            <div class="order-card">
                <div class="order-header">
                    <div class="order-id">Заказ #${order.order_id}</div>
                    <div class="order-status">${getStatusBadge(order.status)}</div>
                </div>
                <div class="order-details">
                    <div class="order-date">
                        📅 ${formatDateTime(order.created_at)}
                    </div>
                    <div class="order-items">
                        <strong>Товары:</strong>
                        ${itemsHtml}
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
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', () => {
    renderAccountHistory();
});