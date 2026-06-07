from flask import Flask, request, jsonify, make_response, send_from_directory, redirect
from flask_cors import CORS
import logging
import telegram_auth
import db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

BOT_TOKEN = None
BOT_USERNAME = None

def init_server(bot_token, bot_username):
    global BOT_TOKEN, BOT_USERNAME
    BOT_TOKEN = bot_token
    BOT_USERNAME = bot_username
    telegram_auth.init_auth(bot_token, bot_username)
    logger.info("Auth server initialized")


@app.route('/auth/telegram', methods=['POST', 'GET'])
def telegram_auth_endpoint():
    try:
        # Если данные пришли через GET (перенаправление от виджета)
        if request.method == 'GET':
            auth_data = request.args.to_dict()
        else:
            auth_data = request.json
            if not auth_data:
                return jsonify({'success': False, 'error': 'No auth data provided'}), 400

        # Проверка данных
        if not auth_data or 'id' not in auth_data or 'auth_date' not in auth_data or 'hash' not in auth_data:
            return jsonify({'success': False, 'error': 'Missing required fields'}), 400

        user_id = telegram_auth.check_telegram_auth(auth_data)
        if not user_id:
            return jsonify({'success': False, 'error': 'Invalid auth data'}), 401

        telegram_auth.create_or_update_user_from_auth(auth_data)
        user_info = telegram_auth.get_user_info(user_id)

        # Устанавливаем cookie и перенаправляем обратно на страницу оформления заказа
        response = redirect('/checkout.html')
        response.set_cookie('user_id', str(user_id), max_age=30 * 24 * 60 * 60, secure=True, httponly=False,
                            samesite='Lax')
        return response

    except Exception as e:
        logger.error(f"Error in telegram auth endpoint: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/auth/check', methods=['GET'])
def check_auth():
    user_id = request.cookies.get('user_id')
    if not user_id:
        return jsonify({'authenticated': False})
    try:
        user_id = int(user_id)
        user_info = telegram_auth.get_user_info(user_id)
        if user_info:
            return jsonify({'authenticated': True, 'user_id': user_id, 'user_info': user_info})
        else:
            return jsonify({'authenticated': False})
    except Exception as e:
        logger.error(f"Error checking auth: {e}")
        return jsonify({'authenticated': False})

@app.route('/auth/logout', methods=['POST'])
def logout():
    response = jsonify({'success': True})
    response.delete_cookie('user_id')
    return response

@app.route('/auth/subscription', methods=['GET'])
def get_subscription_info():
    user_id = request.cookies.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    try:
        user_id = int(user_id)
        user_info = telegram_auth.get_user_info(user_id)
        if not user_info:
            return jsonify({'error': 'User not found'}), 404

        # Подключаемся к shop.db для получения информации о последнем заказе
        shop_db_path = '/root/site-vepon/shop.db'
        import sqlite3
        conn = sqlite3.connect(shop_db_path)
        cursor = conn.cursor()

        # Получаем последний оплаченный заказ пользователя
        cursor.execute("""
            SELECT id, total_amount FROM orders
            WHERE user_id = ? AND status = 'paid'
            ORDER BY created_at DESC LIMIT 1
        """, (user_id,))
        order = cursor.fetchone()

        if not order:
            conn.close()
            return jsonify({'error': 'No paid orders found'}), 404

        order_id, total_amount = order

        # Получаем товар из заказа
        cursor.execute("""
            SELECT product_id, days, price FROM order_items
            WHERE order_id = ?
        """, (order_id,))
        order_item = cursor.fetchone()

        if not order_item:
            conn.close()
            return jsonify({'error': 'No order items found'}), 404

        product_id, days, price = order_item

        # Получаем информацию о товаре
        cursor.execute("""
            SELECT name, days, price_rub FROM products WHERE id = ?
        """, (product_id,))
        product = cursor.fetchone()

        conn.close()

        if not product:
            return jsonify({'error': 'Product not found'}), 404

        product_name, product_days, product_price = product

        # Формируем plan_id для маппинга
        if product_days == 30:
            plan_id = "1month"
        elif product_days == 90:
            plan_id = "3month"
        elif product_days == 180:
            plan_id = "6month"
        elif product_days == 400:
            plan_id = "12month"
        else:
            plan_id = "custom"

        return jsonify({
            'plan_name': product_name,
            'plan_price': f"{product_price}₽",
            'plan_id': plan_id,
            'days': product_days,
            'product_id': product_id
        })
    except Exception as e:
        logger.error(f"Error getting subscription info: {e}")
        return jsonify({'error': str(e)}), 500

# ---- Статика ----
@app.route('/')
def index():
    return send_from_directory('/root/site-vepon', 'index.html')

@app.route('/<path:path>')
def static_files(path):
    # Отдаём все остальные запросы как статические файлы (css, js, img, etc.)
    return send_from_directory('/root/site-vepon', path)

if __name__ == '__main__':
    config = db.get_config()
    bot_token = config.get('bot_token')
    bot_username = config.get('bot_username', 'vepon_bot')
    init_server(bot_token, bot_username)
    # Запускаем на порту 8080, чтобы соответствовать туннелю
    app.run(host='0.0.0.0', port=8080, debug=False)