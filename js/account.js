// account.js – полная рабочая версия

// ==================== ОСНОВНАЯ ЗАГРУЗКА ====================
async function loadAccount() {
    try {
        const resp = await fetch('/auth/check', { credentials: 'include' });
        const data = await resp.json();

        if (!data.authenticated) {
            showAuthWidget();
            return;
        }

        const user = data.user_info;

        // Детальное заполнение user-info
        const userUsernameEl = document.getElementById('user-username');
        const useridEl = document.getElementById('user-id');
        const userStatusEl = document.getElementById('user-status');

        if (userUsernameEl) userUsernameEl.textContent = `@${user.username || user.user_id}`;
        if (useridEl) useridEl.textContent = `Telegram ID: ${user.user_id}`;

        // Статус подписки
        const statusSpan = document.querySelector('.status');
        const expiresAt = user.expires_at ? new Date(user.expires_at) : null;
        const now = new Date();
        const isActive = user.has_subscription && expiresAt && expiresAt > now;

        if (statusSpan) {
            statusSpan.textContent = isActive ? 'Активна' : 'Неактивна';
            statusSpan.className = isActive ? 'status active' : 'status expired';
        }

        // Статус в user-info
        if (userStatusEl) {
            if (isActive && expiresAt) {
                const daysLeft = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
                userStatusEl.innerHTML = `<span class="status-badge active">✅ Подписка активна</span>`;
            } else {
                userStatusEl.innerHTML = `<span class="status-badge expired">⚠️ Нет активной подписки</span>`;
            }
        }

        // Оставшиеся дни
        let daysLeft = 0;
        if (isActive && expiresAt) {
            daysLeft = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
        }

        // Даты
        const startDateSpan = document.getElementById('start-date');
        const expireDateSpan = document.getElementById('expire-date');
        const daysLeftSpan = document.getElementById('days-left');

        if (startDateSpan) startDateSpan.textContent = user.start_date ? new Date(user.start_date).toLocaleDateString('ru-RU') : 'не указана';
        if (expireDateSpan) expireDateSpan.textContent = expiresAt ? expiresAt.toLocaleDateString('ru-RU') : 'не активна';
        if (daysLeftSpan) daysLeftSpan.textContent = daysLeft > 0 ? daysLeft : 0;

        // Загружаем информацию о тарифе для быстрого продления
        await loadQuickRenewal();

        // VPN-ссылка
        if (user.vpn_link && !document.querySelector('.vpn-block')) {
            addVpnBlock(user.vpn_link);
        }

        // Кнопка выхода
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.onclick = async () => {
                await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
                window.location.reload();
            };
        }
    } catch (err) {
        console.error(err);
        const content = document.querySelector('.account-content');
        if (content) content.innerHTML = '<p style="color:red;">Ошибка загрузки</p>';
    }
}

// ==================== БЫСТРОЕ ПРОДЛЕНИЕ ====================
async function loadQuickRenewal() {
    try {
        // Загружаем все товары из API
        const productsResp = await fetch('/api/products');
        const products = await productsResp.json();
        
        if (!products || products.length === 0) return;
        
        // Берем самый популярный тариф (id=3 - 6 месяцев) или первый
        const plan = products.find(p => p.id === 3) || products[0];
        
        const planNameEl = document.getElementById('renewal-plan-name');
        const planPriceEl = document.getElementById('renewal-plan-price');
        const renewalBtn = document.getElementById('renewal-btn');
        
        if (planNameEl) planNameEl.textContent = plan.name;
        if (planPriceEl) planPriceEl.textContent = `${plan.price_rub}₽`;
        
        if (renewalBtn) {
            // Убираем старые обработчики
            const newBtn = renewalBtn.cloneNode(true);
            renewalBtn.parentNode.replaceChild(newBtn, renewalBtn);
            
            newBtn.onclick = async () => {
                newBtn.disabled = true;
                newBtn.textContent = 'Добавляем...';
                
                try {
                    const addResp = await fetch('/api/cart', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ product_id: plan.id, quantity: 1 })
                    });
                    
                    if (addResp.ok) {
                        window.location.href = '/checkout.html';
                    } else {
                        showNotification('Ошибка добавления тарифа в корзину', 'error');
                        newBtn.disabled = false;
                        newBtn.textContent = 'Продлить сейчас';
                    }
                } catch (err) {
                    console.error(err);
                    showNotification('Ошибка добавления тарифа в корзину', 'error');
                    newBtn.disabled = false;
                    newBtn.textContent = 'Продлить сейчас';
                }
            };
        }
    } catch (err) {
        console.error('Error loading quick renewal:', err);
    }
}

// ==================== VPN БЛОК ====================
function addVpnBlock(vpnLink) {
    const accountContent = document.querySelector('.account-content');
    if (!accountContent) return;
    
    const vpnBlock = document.createElement('div');
    vpnBlock.className = 'subscription-card vpn-block';
    vpnBlock.innerHTML = `
        <h3>VPN-конфигурация</h3>
        <div class="vpn-link-container">
            <code class="vpn-link-text">${vpnLink}</code>
            <button class="copy-icon-btn" title="Копировать">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
            </button>
        </div>
    `;
    accountContent.appendChild(vpnBlock);
    
    vpnBlock.querySelector('.copy-icon-btn').addEventListener('click', () => {
        navigator.clipboard.writeText(vpnLink);
        const btn = vpnBlock.querySelector('.copy-icon-btn');
        btn.style.color = '#4CAF50';
        setTimeout(() => btn.style.color = '', 1000);
        showNotification('VPN ссылка скопирована', 'success');
    });
}

// ==================== УВЕДОМЛЕНИЯ ====================
function showNotification(message, type = 'success') {
    const existing = document.querySelector('.custom-notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.className = 'custom-notification';
    notification.textContent = message;
    
    let bgColor = '#4CAF50';
    if (type === 'error') bgColor = '#f44336';
    if (type === 'info') bgColor = '#2196F3';
    
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${bgColor};
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        z-index: 10001;
        font-size: 14px;
        animation: fadeInOut 2s ease;
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 2000);
}

// ==================== АВТОРИЗАЦИЯ ====================
function showAuthWidget() {
    const accountContent = document.querySelector('.account-content');
    const sidebar = document.querySelector('.account-sidebar');
    if (accountContent) {
        accountContent.innerHTML = `
            <div style="text-align:center;padding:40px;">
                <p>Войдите через Telegram</p>
                <div id="telegram-login-widget"></div>
                <div id="auth-status" style="margin-top:10px;">Нажмите для входа</div>
            </div>
        `;
        if (sidebar) sidebar.style.display = 'none';
        initTelegramWidget();
    }
}

function initTelegramWidget() {
    const botUsername = 'vepon_bot';
    window.onTelegramAuth = (user) => {
        fetch('/auth/telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(user)
        }).finally(() => {
            window.location.reload();
        });
    };
    const widgetDiv = document.getElementById('telegram-login-widget');
    if (widgetDiv) {
        const script = document.createElement('script');
        script.src = 'https://telegram.org/js/telegram-widget.js?22';
        script.setAttribute('data-telegram-login', botUsername);
        script.setAttribute('data-size', 'large');
        script.setAttribute('data-radius', '8');
        script.setAttribute('data-onauth', 'onTelegramAuth(user)');
        script.setAttribute('data-request-access', 'write');
        widgetDiv.appendChild(script);
    }
}

// Запуск
document.addEventListener('DOMContentLoaded', loadAccount);