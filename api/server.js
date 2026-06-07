const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors({
    origin: ['https://vepon.ru', 'http://localhost:3000', 'http://localhost:8080'],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Путь к БД
const DB_PATH = '/root/awg-docker-bot/awg/clients.db';
let db = new sqlite3.Database(DB_PATH);

// Инициализация таблиц магазина
db.serialize(() => {
    // Таблица товаров
    db.run(`CREATE TABLE IF NOT EXISTS shop_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        days INTEGER NOT NULL,
        price_rub INTEGER NOT NULL,
        stars INTEGER NOT NULL,
        is_active INTEGER DEFAULT 1
    )`);
    
    // Таблица корзины
    db.run(`CREATE TABLE IF NOT EXISTS shop_carts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, product_id)
    )`);
    
    // Таблица заказов
    db.run(`CREATE TABLE IF NOT EXISTS shop_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT UNIQUE NOT NULL,
        user_id INTEGER NOT NULL,
        total_rub INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        payment_method TEXT DEFAULT 'card',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        paid_at TEXT
    )`);
    
    // Таблица товаров в заказе
    db.run(`CREATE TABLE IF NOT EXISTS shop_order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER DEFAULT 1,
        price_rub INTEGER NOT NULL
    )`);
    
    // Вставляем товары если их нет
    db.get(`SELECT COUNT(*) as count FROM shop_products`, (err, row) => {
        if (err) return;
        if (row.count === 0) {
            const products = [
                [1, '30 дней', 30, 180, 100, 1],
                [2, '90 дней', 90, 425, 250, 1],
                [3, '180 дней', 180, 850, 500, 1],
                [4, '400 дней', 400, 1600, 1000, 1]
            ];
            const stmt = db.prepare(`INSERT INTO shop_products (id, name, days, price_rub, stars, is_active) VALUES (?, ?, ?, ?, ?, ?)`);
            for (const p of products) {
                stmt.run(p);
            }
            stmt.finalize();
            console.log('✅ Products inserted');
        }
    });
});

// Middleware для получения user_id из cookie
function getUserId(req) {
    return req.cookies?.user_id || null;
}

// ==================== API ТОВАРЫ ====================
app.get('/api/products', (req, res) => {
    db.all(`SELECT id, name, days, price_rub, stars FROM shop_products WHERE is_active = 1`, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// ==================== API КОРЗИНА ====================
app.get('/api/cart', (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
        return res.json({ items: [], total: 0 });
    }
    
    db.all(`
        SELECT c.id, p.id as product_id, p.name, p.days, p.price_rub, c.quantity
        FROM shop_carts c
        JOIN shop_products p ON c.product_id = p.id
        WHERE c.user_id = ?
    `, [userId], (err, items) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        const total = items.reduce((sum, item) => sum + item.price_rub * item.quantity, 0);
        res.json({ items, total });
    });
});

app.post('/api/cart', (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized. Please login via Telegram.' });
    }
    
    const { product_id, quantity = 1 } = req.body;
    
    if (!product_id) {
        return res.status(400).json({ error: 'product_id required' });
    }
    
    // Сначала удаляем все товары из корзины пользователя (ограничение - только 1 товар)
    db.run(`DELETE FROM shop_carts WHERE user_id = ?`, [userId], (err) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        // Затем добавляем новый товар
        db.run(`
            INSERT INTO shop_carts (user_id, product_id, quantity, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `, [userId, product_id, quantity], function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true });
        });
    });
});

app.delete('/api/cart/:itemId', (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    db.run(`DELETE FROM shop_carts WHERE id = ? AND user_id = ?`, 
        [req.params.itemId, userId], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true });
    });
});

app.delete('/api/cart', (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    db.run(`DELETE FROM shop_carts WHERE user_id = ?`, [userId], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true });
    });
});

// ==================== API ЗАКАЗЫ ====================
app.post('/api/orders', (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized. Please login via Telegram.' });
    }
    
    // Получаем корзину
    db.all(`
        SELECT p.id, p.name, p.price_rub, c.quantity, p.days
        FROM shop_carts c
        JOIN shop_products p ON c.product_id = p.id
        WHERE c.user_id = ?
    `, [userId], (err, items) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (items.length === 0) {
            return res.status(400).json({ error: 'Cart is empty' });
        }
        
        const total = items.reduce((sum, i) => sum + i.price_rub * i.quantity, 0);
        const orderId = `order_${Date.now()}_${userId}`;
        
        // Создаем заказ
        db.run(`
            INSERT INTO shop_orders (order_id, user_id, total_rub, status)
            VALUES (?, ?, ?, 'pending')
        `, [orderId, userId, total], function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            // Добавляем товары в заказ
            const stmt = db.prepare(`
                INSERT INTO shop_order_items (order_id, product_id, quantity, price_rub)
                VALUES (?, ?, ?, ?)
            `);
            for (const item of items) {
                stmt.run(orderId, item.id, item.quantity, item.price_rub);
            }
            stmt.finalize();
            
            // Очищаем корзину
            db.run(`DELETE FROM shop_carts WHERE user_id = ?`, [userId]);
            
            res.json({ orderId, total });
        });
    });
});

app.get('/api/orders', (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    db.all(`
        SELECT order_id, total_rub, status, created_at, paid_at
        FROM shop_orders
        WHERE user_id = ?
        ORDER BY created_at DESC
    `, [userId], (err, orders) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(orders);
    });
});

// ==================== API ДЕТАЛИ ЗАКАЗА ====================
app.get('/api/orders/:orderId/items', (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { orderId } = req.params;
    
    db.all(`
        SELECT oi.*, p.name, p.days
        FROM shop_order_items oi
        JOIN shop_products p ON oi.product_id = p.id
        WHERE oi.order_id = ? AND oi.order_id IN (
            SELECT order_id FROM shop_orders WHERE user_id = ?
        )
    `, [orderId, userId], (err, items) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(items);
    });
});

// ==================== ВЫЗОВ VPN API БОТА ====================
const http = require('http');

async function callBotApi(endpoint, data, method = 'POST') {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(data);
        const options = {
            hostname: '127.0.0.1',
            port: 5001,
            path: endpoint,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch(e) {
                    resolve({ success: false, error: 'Parse error' });
                }
            });
        });
        
        req.on('error', (e) => {
            console.error('Bot API error:', e);
            reject(e);
        });
        
        req.write(postData);
        req.end();
    });
}

async function callBotApiGet(endpoint) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: '127.0.0.1',
            port: 5001,
            path: endpoint,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch(e) {
                    resolve({ has_vpn: false, error: 'Parse error' });
                }
            });
        });
        
        req.on('error', (e) => {
            console.error('Bot API GET error:', e);
            reject(e);
        });
        
        req.end();
    });
}

async function createOrExtendVpn(userId, username, days) {
    // Проверяем, есть ли уже VPN у пользователя
    const hasVpn = await checkVpnExists(userId);
    
    if (hasVpn) {
        // Продлеваем подписку (бот сам обновит expires_at)
        const result = await callBotApi('/api/vpn/extend', {
            user_id: parseInt(userId),
            days: days
        });
        return result;
    } else {
        // Создаем нового клиента (бот сам установит expires_at)
        const result = await callBotApi('/api/vpn/create', {
            user_id: parseInt(userId),
            username: username,
            days: days
        });
        return result;
    }
}

async function checkVpnExists(userId) {
    try {
        const result = await callBotApiGet(`/api/vpn/check?user_id=${userId}`);
        return result.has_vpn === true;
    } catch (error) {
        console.error('Error checking VPN:', error);
        return false;
    }
}

// ==================== API ОПЛАТА ====================
app.post('/api/payments/:orderId', (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { orderId } = req.params;
    const { paymentMethod = 'card' } = req.body;
    
    // Получаем заказ
    db.get(`SELECT * FROM shop_orders WHERE order_id = ? AND user_id = ?`, 
        [orderId, userId], async (err, order) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        if (order.status === 'paid') {
            return res.json({ success: true, message: 'Already paid' });
        }
        
        // Получаем товары из заказа
        db.all(`
            SELECT oi.product_id, oi.quantity, p.days, p.name
            FROM shop_order_items oi
            JOIN shop_products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
        `, [orderId], async (err, items) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            const totalDays = items.reduce((sum, item) => sum + (item.days * item.quantity), 0);
            
            // Получаем username пользователя
            db.get(`SELECT username FROM clients WHERE user_id = ?`, [userId], async (err, userRow) => {
                const username = userRow?.username || `user_${userId}`;
                
                let vpnResult = null;
                let vpnLink = null;
                
                try {
                    // создание или продление
                    vpnResult = await createOrExtendVpn(userId, username, totalDays);
                    
                    if (vpnResult && vpnResult.success) {
                        vpnLink = vpnResult.vpn_link;
                    } else {
                        console.error('VPN operation failed:', vpnResult);
                    }
                } catch (vpnError) {
                    console.error('VPN API error:', vpnError);
                }
                
                // отмечаем заказ как оплаченный
                db.run(`
                    UPDATE shop_orders 
                    SET status = 'paid', 
                        paid_at = CURRENT_TIMESTAMP,
                        payment_method = ?
                    WHERE order_id = ?
                `, [paymentMethod, orderId], function(err) {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }
                    
                    // Если есть vpn_link и в БД его нет, обновляем (только если null)
                    if (vpnLink) {
                        db.run(`
                            UPDATE clients 
                            SET vpn_link = COALESCE(vpn_link, ?)
                            WHERE user_id = ?
                        `, [vpnLink, userId], () => {});
                    }
                    
                    res.json({ 
                        success: true, 
                        message: 'Payment successful',
                        days_added: totalDays,
                        vpn_link: vpnLink
                    });
                });
            });
        });
    });
});

// ==================== API АДМИНКА (опционально) ====================
// Проверка, является ли пользователь админом
function isAdmin(userId) {
    const ADMIN_IDS = [YOUR_TELEGRAM_ID]; 
    return ADMIN_IDS.includes(parseInt(userId));
}

// Получить все заказы (только для админа)
app.get('/api/admin/orders', (req, res) => {
    const userId = getUserId(req);
    if (!userId || !isAdmin(userId)) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    db.all(`
        SELECT o.*, c.username 
        FROM shop_orders o
        LEFT JOIN clients c ON o.user_id = c.user_id
        ORDER BY o.created_at DESC
    `, (err, orders) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(orders);
    });
});

// ==================== СТАТИКА ====================
app.use(express.static(path.join(__dirname, '..')));

// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Shop API running on port ${PORT}`);
});