# Vepon VPN - Веб-сайт VPN сервиса

Полноценный веб-сайт для продажи VPN подписок с интеграцией Telegram бота и AmneziaWG.

## Обзор

Проект состоит из двух частей:
- **site-vepon** - Frontend и API для веб-сайта (Node.js + Express)
- **awg** - Backend для Telegram авторизации и управления VPN клиентами (Python + Gunicorn)

## Структура проекта

### site-vepon (основной проект)
```
site-vepon/
├── index.html              # Главная страница
├── catalog.html            # Тарифы
├── account.html            # Личный кабинет
├── cart.html               # Корзина
├── checkout.html           # Оформление заказа
├── payment.html            # Страница оплаты
├── payment-result.html     # Результат оплаты
├── support.html            # FAQ и поддержка
├── instructions.html       # Инструкции по настройке
├── account-history.html    # История заказов
├── plan.html               # Страница плана
├── assets/
│   └── logo.png           # Логотип
├── js/
│   ├── main.js            # Основной скрипт
│   ├── account.js         # Личный кабинет
│   ├── account-history.js # История заказов
│   ├── faq.js             # FAQ
│   └── nav-indicator.js   # Навигация
├── api/
│   ├── server.js          # Express API сервер
│   ├── package.json       # Зависимости Node.js
│   └── package-lock.json
└── shop.db                # База данных SQLite
```

### awg (backend зависимость)
```
awg/
├── api_server.py          # API для управления VPN клиентами
├── auth_server.py         # Сервер Telegram авторизации
├── telegram_auth.py       # Модуль Telegram аутентификации
├── wsgi.py                # WSGI конфигурация
└── clients.db             # База данных клиентов VPN
```

## Технологии

### Frontend
- HTML5
- CSS3
- Vanilla JavaScript

### Backend (site-vepon)
- Node.js
- Express.js
- SQLite3
- Cookie-parser

### Backend (awg)
- Python 3
- Gunicorn
- AmneziaWG
- Telegram Bot API

## Конфигурация

### API сервер (site-vepon/api/server.js)
- Порт: 3000 (по умолчанию)
- База данных: `/root/awg-docker-bot/awg/clients.db`

### Auth сервер (awg/auth_server.py)
- Порт: 8080
- Telegram Bot: требуется настройка BOT_TOKEN
- Статические файлы: `/root/site-vepon`

### VPN API сервер (awg/api_server.py)
- WireGuard endpoint: `YOUR_VPS_IP`
- База данных: `/root/awg-docker-bot/awg/clients.db`

## API эндпоинты

### site-vepon API (Express)
- `GET /api/products` - Получить список товаров
- `POST /api/cart` - Добавить товар в корзину
- `GET /api/cart` - Получить корзину пользователя
- `DELETE /api/cart/:id` - Удалить товар из корзины
- `POST /api/orders` - Создать заказ
- `GET /api/orders` - Получить заказы пользователя

### awg API (Gunicorn)
- `POST /api/vpn/create` - Создать VPN-конфигурацию клиента
- `POST /api/vpn/extend` - Продлить подписку
- `GET /api/vpn/check` - Проверить статус VPN
- `POST /auth/telegram` - Telegram авторизация
- `GET /auth/check` - Проверить авторизацию
- `GET /auth/subscription` - Получить информацию о подписке

## Тарифы

- 30 дней - 180₽
- 90 дней - 425₽
- 180 дней - 850₽
- 400 дней - 1600₽

## Безопасность

- Telegram авторизация с проверкой hash
- HTTP-only cookies для сессий
- Валидация данных на сервере

## Примечания

- Проект требует одновременной работы обоих серверов (site-vepon и awg)
- Для полноценной работы необходим настроенный рабочий Telegram Bot для выдачи конфигураций
- Нобходим настроенный на сервере протокол AmneziaWG для работы VPN
- База данных SQLite используется для хранения заказов и клиентов
- AmneziaWG используется для предоставления VPN доступа
- Telegram бот @vepon_bot используется для авторизации

## Поддержка

- Telegram бот: @vepon_bot
- Telegram канал: @vepon_news

