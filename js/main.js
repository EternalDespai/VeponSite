// ==================== API БАЗОВЫЕ ФУНКЦИИ ====================
const API_BASE = '/api';

async function apiRequest(endpoint, options = {}) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        credentials: 'include'
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'API error');
    }
    return response.json();
}

// ==================== КОРЗИНА ====================
async function loadCart() {
    try {
        const cart = await apiRequest('/cart');
        return cart;
    } catch (error) {
        console.error('Error loading cart:', error);
        return { items: [], total: 0 };
    }
}

async function addToCart(productId, quantity = 1) {
    try {
        console.log('Adding to cart:', productId, quantity);
        
        // Сначала очищаем корзину
        await clearCart();
        
        // Затем добавляем новый товар
        const result = await apiRequest('/cart', {
            method: 'POST',
            body: JSON.stringify({ product_id: productId, quantity })
        });
        console.log('Add to cart result:', result);
        return true;
    } catch (error) {
        console.error('Error adding to cart:', error);
        return false;
    }
}

async function removeFromCart(itemId) {
    try {
        await apiRequest(`/cart/${itemId}`, { method: 'DELETE' });
        return true;
    } catch (error) {
        console.error('Error removing from cart:', error);
        return false;
    }
}

async function clearCart() {
    try {
        await apiRequest('/cart', { method: 'DELETE' });
        return true;
    } catch (error) {
        console.error('Error clearing cart:', error);
        return false;
    }
}

// ==================== ЗАКАЗЫ ====================
async function createOrder() {
    try {
        const order = await apiRequest('/orders', { method: 'POST' });
        return order;
    } catch (error) {
        console.error('Error creating order:', error);
        return null;
    }
}

async function getOrders() {
    try {
        const orders = await apiRequest('/orders');
        return orders;
    } catch (error) {
        console.error('Error loading orders:', error);
        return [];
    }
}

async function simulatePayment(orderId, paymentMethod = 'card') {
    try {
        const result = await apiRequest(`/payments/${orderId}`, {
            method: 'POST',
            body: JSON.stringify({ paymentMethod })
        });
        return result;
    } catch (error) {
        console.error('Error processing payment:', error);
        return null;
    }
}

// ==================== ТОВАРЫ ====================
async function loadProducts() {
    try {
        const products = await apiRequest('/products');
        return products;
    } catch (error) {
        console.error('Error loading products:', error);
        return [];
    }
}

// ==================== ОТОБРАЖЕНИЕ КОРЗИНЫ ====================
async function renderCart() {
    const cartItemsContainer = document.getElementById('cart-items');
    const cartSummary = document.getElementById('cart-summary');
    
    if (!cartItemsContainer) return;
    
    const cart = await loadCart();
    
    if (!cart.items || cart.items.length === 0) {
        cartItemsContainer.innerHTML = `
            <div class="cart-empty">
                <p>🛒 Корзина пуста</p>
                <a href="catalog.html" class="btn primary">Перейти к тарифам</a>
            </div>
        `;
        if (cartSummary) cartSummary.style.display = 'none';
        return;
    }
    
    // Берем только первый товар
    const item = cart.items[0];
    const itemTotal = item.price_rub * item.quantity;
    const total = itemTotal;
    
    cartItemsContainer.innerHTML = `
        <table class="cart-table">
            <thead>
                <tr>
                    <th>Тариф</th>
                    <th>Срок</th>
                    <th>Цена</th>
                    <th>Сумма</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                <tr data-item-id="${item.id}">
                    <td><strong>${item.name}</strong></td>
                    <td>${item.days} дней</td>
                    <td>${item.price_rub}₽</td>
                    <td>${itemTotal}₽</td>
                    <td><button class="remove-btn" data-id="${item.id}">✕ Удалить</button></td>
                </tr>
            </tbody>
        </table>
    `;
    
    if (cartSummary) {
        cartSummary.style.display = 'block';
        document.getElementById('summary-price').textContent = `${total}₽`;
        document.getElementById('total-price').textContent = `${total}₽`;
    }
    
    // Добавляем обработчик удаления
    document.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const itemId = btn.dataset.id;
            await removeFromCart(itemId);
            renderCart();
            updateCartCount();
        });
    });
}

// ==================== ОБНОВЛЕНИЕ СЧЕТЧИКА КОРЗИНЫ ====================
async function updateCartCount() {
    const cart = await loadCart();
    const count = cart.items ? cart.items.reduce((s, i) => s + i.quantity, 0) : 0;
    document.querySelectorAll('.cart-count').forEach(el => {
        el.textContent = count;
    });
}

// ==================== ПРОВЕРКА АВТОРИЗАЦИИ (ДЛЯ ОФОРМЛЕНИЯ) ====================
async function checkAuth() {
    try {
        const response = await fetch('/auth/check', {
            credentials: 'include'
        });
        const data = await response.json();
        return data.authenticated === true;
    } catch (error) {
        console.error('Auth check error:', error);
        return false;
    }
}

// ==================== ОФОРМЛЕНИЕ ЗАКАЗА ====================
async function renderCheckout() {
    const checkoutItemsContainer = document.getElementById('checkout-items');
    const checkoutTotal = document.getElementById('checkout-total');
    
    if (!checkoutItemsContainer) return;
    
    const cart = await loadCart();
    
    if (!cart.items || cart.items.length === 0) {
        window.location.href = '/cart.html';
        return;
    }
    
    // Берем только первый товар
    const item = cart.items[0];
    const total = item.price_rub * item.quantity;
    
    checkoutItemsContainer.innerHTML = `
        <div class="checkout-item">
            <span>${item.name} (${item.days} дней)</span>
            <span>${total}₽</span>
        </div>
    `;
    
    if (checkoutTotal) checkoutTotal.textContent = `${total}₽`;
}

async function submitOrder() {
    // Проверяем авторизацию
    const isAuth = await checkAuth();
    
    if (!isAuth) {
        const authWarning = document.getElementById('auth-warning');
        if (authWarning) {
            authWarning.style.display = 'block';
        }
        // Прокручиваем к предупреждению
        authWarning.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }
    
    const order = await createOrder();
    if (order && order.orderId) {
        window.location.href = `/payment.html?orderId=${order.orderId}&total=${order.total}`;
    } else {
        alert('Ошибка создания заказа. Попробуйте позже.');
    }
}

// ==================== ПРОВЕРКА АВТОРИЗАЦИИ ====================
async function isUserAuthenticated() {
    try {
        const response = await fetch('/auth/check', {
            credentials: 'include'
        });
        const data = await response.json();
        return data.authenticated === true;
    } catch (error) {
        return false;
    }
}

// Простая функция добавления с проверкой
async function addToCartWithAuth(productId, productName, btn) {
    const isAuth = await isUserAuthenticated();
    
    if (!isAuth) {
        showAuthModal(productId, productName);
        return false;
    }
    
    // Проверяем, не добавлен ли уже этот товар
    const cart = await loadCart();
    const alreadyInCart = cart.items && cart.items.some(item => item.product_id === productId);
    
    if (alreadyInCart) {
        showNotification(`${productName} уже в корзине`, 'info');
        btn.disabled = false;
        btn.textContent = 'Купить';
        return true;
    }
    
    const success = await addToCart(productId, 1);
    if (success) {
        btn.textContent = '✓';
        setTimeout(() => {
            btn.textContent = 'Купить';
            btn.disabled = false;
        }, 1500);
        updateCartCount();
    } else {
        btn.disabled = false;
        alert('Ошибка добавления');
    }
    return success;
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
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

// Показываем модальное окно с авторизацией
function showAuthModal(productId, productName) {
    // Сохраняем товар для добавления после авторизации
    if (productId && productName) {
        localStorage.setItem('pending_product', JSON.stringify({
            id: productId,
            name: productName,
            timestamp: Date.now()
        }));
    }
    
    // Создаем модальное окно
    const modal = document.createElement('div');
    modal.id = 'auth-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    `;
    
    modal.innerHTML = `
        <div style="background: #202024; padding: 30px; border-radius: 20px; max-width: 400px; text-align: center;">
            <h3 style="margin-bottom: 20px;">🔐 Требуется авторизация</h3>
            <p style="color: #ffffff; margin-bottom: 20px;">Для добавления товара в корзину необходимо войти через Telegram</p>
            <div id="telegram-widget-container"></div>
            <button id="close-modal" style="margin-top: 20px; background: none; border: 1px solid #ffffff; color: #ffffff; padding: 8px 20px; border-radius: 8px; cursor: pointer;">Закрыть</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Загружаем виджет
    const widgetContainer = modal.querySelector('#telegram-widget-container');
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', 'VePoN_bot');
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '8');
    script.setAttribute('data-auth-url', 'https://vepon.ru/auth/telegram');
    script.setAttribute('data-request-access', 'write');
    widgetContainer.appendChild(script);
    
    // Закрытие модалки
    modal.querySelector('#close-modal').onclick = () => {
        modal.remove();
    };
    
    // Проверяем авторизацию каждые 2 секунды
    const interval = setInterval(async () => {
        const isAuth = await isUserAuthenticated();
        if (isAuth) {
            clearInterval(interval);
            modal.remove();
            // Добавляем товар после авторизации
            const success = await addToCart(productId, 1);
            if (success) {
                updateCartCount();
                showNotification(`${productName} добавлен в корзину!`, 'success');
                // Обновляем кнопку если она еще существует
                const btns = document.querySelectorAll(`.btn-buy[data-id="${productId}"]`);
                btns.forEach(btn => {
                    btn.textContent = '✓ Добавлено!';
                    setTimeout(() => {
                        btn.textContent = 'Купить';
                        btn.disabled = false;
                    }, 1500);
                });
            }
        }
    }, 2000);
    
    // Останавливаем проверку через 5 минут
    setTimeout(() => clearInterval(interval), 300000);
}

// ==================== ОПЛАТА ====================
async function processPayment() {
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('orderId');
    const total = urlParams.get('total');
    
    if (!orderId) {
        window.location.href = '/cart.html';
        return;
    }
    
    const orderIdSpan = document.getElementById('order-id');
    const paymentAmountSpan = document.getElementById('payment-amount');
    
    if (orderIdSpan) orderIdSpan.textContent = orderId;
    if (paymentAmountSpan) paymentAmountSpan.textContent = `${total}₽`;
    
    const payBtn = document.getElementById('pay-button');
    if (payBtn) {
        payBtn.addEventListener('click', async () => {
            payBtn.disabled = true;
            payBtn.textContent = 'Обработка...';
            
            const result = await simulatePayment(orderId, 'card');
            if (result && result.success) {
                window.location.href = '/payment-success.html';
            } else {
                alert('Ошибка оплаты. Попробуйте позже.');
                payBtn.disabled = false;
                payBtn.textContent = 'Оплатить';
            }
        });
    }
}

// ==================== КАТАЛОГ ====================
// ==================== КАТАЛОГ ====================
async function renderCatalog() {
    const plansGrid = document.getElementById('plansGrid');
    if (!plansGrid) return;
    
    // Показываем скелетон (лоадер)
    plansGrid.innerHTML = `
        <div class="skeleton-card" style="background: rgba(255,255,255,0.05); border-radius: 15px; height: 350px;"></div>
        <div class="skeleton-card" style="background: rgba(255,255,255,0.05); border-radius: 15px; height: 350px;"></div>
        <div class="skeleton-card" style="background: rgba(255,255,255,0.05); border-radius: 15px; height: 350px;"></div>
        <div class="skeleton-card" style="background: rgba(255,255,255,0.05); border-radius: 15px; height: 350px;"></div>
    `;
    
    // Загружаем товары из API
    const products = await loadProducts();
    
    let displayProducts = products;

    if (displayProducts.length === 0) {
        plansGrid.innerHTML = '<p style="text-align:center;">Нет доступных тарифов</p>';
        return;
    }
    
    // Генерируем HTML карточек (без пробного тарифа)
    plansGrid.innerHTML = displayProducts.map(product => {
        const isPopular = product.id === 3;
        
        return `
            <div class="tariff ${isPopular ? 'popular' : ''}" data-product-id="${product.id}">
                ${isPopular ? '<span class="popular-badge">POPULAR</span>' : ''}
                <div class="tariff-content">
                    <h3>${escapeHtml(product.name)}</h3>
                    <p class="price">${product.price_rub}₽</p>
                    <p class="duration">${product.days} дней</p>
                    <ul class="features">
                        <li>✓ Полный доступ</li>
                        <li>✓ Все серверы</li>
                        <li>✓ Без ограничений скорости</li>
                        ${product.id >= 2 ? '<li>✓ Приоритетная поддержка</li>' : ''}
                        ${product.id >= 3 ? '<li>✓ Экономия до 35%</li>' : ''}
                    </ul>
                </div>
                <button class="btn primary btn-buy" data-product-id="${product.id}" data-product-name="${escapeHtml(product.name)}">Купить</button>
            </div>
        `;
    }).join('');
    
    // Добавляем обработчики для кнопок
    document.querySelectorAll('.btn-buy').forEach(btn => {
        btn.removeEventListener('click', handleBuyClick);
        btn.addEventListener('click', handleBuyClick);
    });
}

// Обработчик для обычной покупки
async function handleBuyClick(e) {
    const btn = e.currentTarget;
    const productId = parseInt(btn.dataset.productId);
    const productName = btn.dataset.productName;
    
    if (!productId) return;
    
    btn.disabled = true;
    btn.textContent = '⏳';
    
    await addToCartWithAuth(productId, productName, btn);
    
    btn.disabled = false;
    if (btn.textContent === '⏳') {
        btn.textContent = 'Купить';
    }
}

// Функция для экранирования HTML
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ==================== ПРОВЕРКА ОТЛОЖЕННОГО ТОВАРА ====================
async function checkPendingProduct() {
    
    // Проверяем отложенный обычный товар
    const pending = localStorage.getItem('pending_product');
    if (!pending) return false;
    
    const data = JSON.parse(pending);
    if (Date.now() - data.timestamp > 10 * 60 * 1000) {
        localStorage.removeItem('pending_product');
        return false;
    }
    
    const isAuth = await isUserAuthenticated();
    if (isAuth) {
        localStorage.removeItem('pending_product');
        const success = await addToCart(data.id, 1);
        if (success) {
            updateCartCount();
            showNotification(`${data.name} добавлен в корзину!`, 'success');
            // Обновляем кнопку, если она есть на странице
            const btns = document.querySelectorAll(`.btn-buy[data-product-id="${data.id}"]`);
            btns.forEach(btn => {
                btn.textContent = '✓';
                setTimeout(() => {
                    if (btn.textContent === '✓') btn.textContent = 'Купить';
                    btn.disabled = false;
                }, 1500);
            });
        }
        return true;
    }
    return false;
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', async () => {
    const path = window.location.pathname;
    
    updateCartCount();
    
    // Проверяем, есть ли товар, который ждал авторизации (только на каталоге)
    if (path.includes('catalog.html')) {
        await checkPendingProduct();
        renderCatalog();
    } else if (path.includes('cart.html')) {
        renderCart();
    } else if (path.includes('checkout.html')) {
        renderCheckout();
        const submitBtn = document.getElementById('submit-order');
        if (submitBtn) {
            submitBtn.addEventListener('click', submitOrder);
        }
    } else if (path.includes('payment.html')) {
        processPayment();
    }
});