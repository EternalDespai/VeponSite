import hashlib
import logging
import hmac
from datetime import datetime, timezone
import db

logger = logging.getLogger(__name__)

BOT_TOKEN = "YOUR_BOT_TOKEN"
TELEGRAM_LOGIN_BOT_USERNAME = "YOUR_BOT_USERNAME"


def init_auth(bot_token, bot_username):
    global BOT_TOKEN, TELEGRAM_LOGIN_BOT_USERNAME
    BOT_TOKEN = bot_token
    TELEGRAM_LOGIN_BOT_USERNAME = bot_username


def check_telegram_auth(auth_data):
    if not auth_data:
        return None
    required_fields = ['id', 'auth_date', 'hash']
    for field in required_fields:
        if field not in auth_data:
            logger.error(f"Missing required field: {field}")
            return None
    try:
        auth_date = int(auth_data['auth_date'])
        # Используем UTC для сравнения
        current_time = int(datetime.now(timezone.utc).timestamp())
        if current_time - auth_date > 86400:
            logger.error("Auth data is too old")
            return None
    except (ValueError, TypeError):
        logger.error("Invalid auth_date format")
        return None
    if not check_hash(auth_data):
        logger.error("Hash check failed")
        return None
    user_id = int(auth_data['id'])
    logger.info(f"Telegram auth successful for user_id: {user_id}")
    return user_id


def check_hash(auth_data):
    if 'hash' not in auth_data:
        return False
    if not BOT_TOKEN:
        logger.error("BOT_TOKEN is not initialized")
        return False

    received_hash = auth_data['hash']

    data_check_dict = {}
    for key, value in auth_data.items():
        if key != 'hash':
            data_check_dict[key] = str(value)

    sorted_keys = sorted(data_check_dict.keys())
    data_check_string = '\n'.join([f"{key}={data_check_dict[key]}" for key in sorted_keys])
    secret_key = hashlib.sha256(BOT_TOKEN.encode('utf-8')).digest()
    computed_hash = hmac.new(secret_key, data_check_string.encode('utf-8'), hashlib.sha256).hexdigest()

    logger.info(f"Data check string: {data_check_string}")
    logger.info(f"Received hash: {received_hash}")
    logger.info(f"Computed hash: {computed_hash}")

    return computed_hash == received_hash


def create_or_update_user_from_auth(auth_data):
    user_id = int(auth_data['id'])
    username = auth_data.get('username', '')
    first_name = auth_data.get('first_name', '')
    last_name = auth_data.get('last_name', '')
    full_name = f"{first_name} {last_name}".strip() if first_name or last_name else username
    existing_client = db.get_client(user_id)
    if existing_client:
        logger.info(f"User {user_id} already exists in database")
        return user_id
    try:
        db.save_client(
            user_id=user_id,
            username=username or full_name,
            private_key=None,
            vpn_link=None,
            client_ip=None,
            expires_days=0
        )
        logger.info(f"Created new user {user_id} ({username or full_name}) from Telegram auth")
        return user_id
    except Exception as e:
        logger.error(f"Error creating user from auth: {e}")
        return None


def get_user_info(user_id):
    client = db.get_client(user_id)
    if not client:
        return None

    # client: (user_id, username, private_key, vpn_link, created_at, expires_at, client_ip, public_key, trial_used, trial_expires, trial_started)
    has_subscription = False
    if client[5]:  # expires_at
        expires_at = datetime.fromisoformat(client[5])
        if expires_at.tzinfo is not None:
            expires_at = expires_at.replace(tzinfo=None)
        has_subscription = expires_at > datetime.now()

    return {
        'user_id': client[0],
        'username': client[1],
        'vpn_link': client[3],
        'expires_at': client[5],
        'start_date': client[4],
        'trial_used': client[8] if len(client) > 8 else 0,
        'trial_expires': client[9] if len(client) > 9 else None,
        'has_subscription': has_subscription
    }