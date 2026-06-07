# ERD — Vepon VPN Service

## Overview

Vepon VPN использует единую базу данных **clients.db**, которая хранит информацию о пользователях, VPN-устройствах, магазине, заказах и платежах.

Такой подход позволяет избежать дублирования информации и объединяет весь функционал проекта в одной базе данных.

---

# Database Structure

```
clients.db
│
├── clients
├── devices
├── shop_products
├── shop_carts
├── shop_orders
├── shop_order_items
├── sbp_payments
├── user_consents
└── waiting
```

---

# Entity Relationship Diagram

```mermaid
erDiagram

    clients {
        INTEGER user_id PK
        TEXT username
        TEXT private_key
        TEXT public_key
        TEXT vpn_link
        TEXT client_ip
        TEXT created_at
        TEXT expires_at
        INTEGER trial_used
        TEXT trial_expires
        TEXT trial_started
    }

    devices {
        INTEGER id PK
        INTEGER user_id FK
        TEXT device_name
        TEXT vpn_link
        TEXT client_ip
        TEXT public_key
        TEXT created_at
    }

    shop_products {
        INTEGER id PK
        TEXT name
        INTEGER days
        INTEGER price_rub
        INTEGER stars
        INTEGER is_active
    }

    shop_carts {
        INTEGER id PK
        INTEGER user_id FK
        INTEGER product_id FK
        INTEGER quantity
        TEXT created_at
        TEXT updated_at
    }

    shop_orders {
        INTEGER id PK
        TEXT order_id UK
        INTEGER user_id FK
        INTEGER total_rub
        TEXT status
        TEXT payment_method
        TEXT created_at
        TEXT paid_at
    }

    shop_order_items {
        INTEGER id PK
        TEXT order_id FK
        INTEGER product_id FK
        INTEGER quantity
        INTEGER price_rub
    }

    sbp_payments {
        TEXT order_id PK
        INTEGER user_id FK
        TEXT payment_id
        INTEGER stars_amount
        TEXT rub_amount
        INTEGER days
        TEXT status
        TEXT created_at
        TEXT paid_at
    }

    user_consents {
        INTEGER user_id PK
        TEXT accepted_at
    }

    waiting {
        INTEGER user_id PK
        TEXT action
    }

    clients ||--o{ devices : owns
    clients ||--o{ shop_carts : has
    clients ||--o{ shop_orders : creates
    clients ||--|| user_consents : accepts
    clients ||--o{ sbp_payments : makes

    shop_products ||--o{ shop_carts : contains
    shop_products ||--o{ shop_order_items : purchased

    shop_orders ||--o{ shop_order_items : includes
    shop_orders ||--|| sbp_payments : payment
```

---

# Tables

## clients

Основная таблица пользователей VPN.

| Field         | Description               |
| ------------- | ------------------------- |
| user_id       | Telegram ID (Primary Key) |
| username      | Telegram username         |
| private_key   | WireGuard private key     |
| public_key    | WireGuard public key      |
| vpn_link      | VPN configuration link    |
| client_ip     | Assigned VPN IP           |
| created_at    | Registration date         |
| expires_at    | Subscription expiration   |
| trial_used    | Trial already activated   |
| trial_started | Trial start date          |
| trial_expires | Trial expiration date     |

---

## devices

Дополнительные устройства пользователя.

Каждый пользователь может иметь несколько VPN-устройств с собственной конфигурацией.

| Field       | Description          |
| ----------- | -------------------- |
| id          | Primary Key          |
| user_id     | Client reference     |
| device_name | Device name          |
| vpn_link    | Device configuration |
| client_ip   | VPN IP               |
| public_key  | WireGuard public key |
| created_at  | Creation date        |

---

## shop_products

Каталог доступных VPN-подписок.

| Field     | Description           |
| --------- | --------------------- |
| id        | Product ID            |
| name      | Product name          |
| days      | Subscription duration |
| price_rub | Price in RUB          |
| stars     | Telegram Stars price  |
| is_active | Availability          |

---

## shop_carts

Корзина пользователя перед оформлением заказа.

| Field      | Description |
| ---------- | ----------- |
| user_id    | Client ID   |
| product_id | Product ID  |
| quantity   | Quantity    |
| created_at | Created     |
| updated_at | Updated     |

---

## shop_orders

История заказов.

| Field          | Description             |
| -------------- | ----------------------- |
| order_id       | Public order identifier |
| user_id        | Client ID               |
| total_rub      | Total amount            |
| status         | pending / paid          |
| payment_method | Payment method          |
| created_at     | Order creation          |
| paid_at        | Payment date            |

---

## shop_order_items

Товары, входящие в заказ.

| Field      | Description       |
| ---------- | ----------------- |
| order_id   | Order reference   |
| product_id | Product reference |
| quantity   | Quantity          |
| price_rub  | Price at purchase |

---

## sbp_payments

Информация о платежах.

| Field        | Description                 |
| ------------ | --------------------------- |
| order_id     | Payment order               |
| user_id      | Client                      |
| payment_id   | External payment ID         |
| stars_amount | Telegram Stars amount       |
| rub_amount   | Amount in RUB               |
| days         | Purchased subscription days |
| status       | Payment status              |
| created_at   | Creation time               |
| paid_at      | Payment confirmation        |

---

## user_consents

Фиксация согласия пользователя с условиями использования сервиса.

| Field       | Description          |
| ----------- | -------------------- |
| user_id     | Client ID            |
| accepted_at | Acceptance timestamp |

---

## waiting

Временная служебная таблица, используемая ботом для хранения текущего состояния пользователя во время выполнения сценариев.

| Field   | Description    |
| ------- | -------------- |
| user_id | Client ID      |
| action  | Current action |

---

# Business Logic

1. Пользователь авторизуется через Telegram.
2. При первом запуске создается запись в **clients**.
3. Пользователь принимает условия использования (**user_consents**).
4. Выбирает подписку (**shop_products**) и добавляет ее в корзину (**shop_carts**).
5. После оформления создается запись в **shop_orders** и **shop_order_items**.
6. При успешной оплате информация сохраняется в **sbp_payments**.
7. VPN-подписка создается или продлевается, обновляется поле **expires_at**, а при необходимости создаются дополнительные записи в **devices**.

---

# Design Principles

* Единая база данных SQLite (`clients.db`)
* Отсутствие дублирования данных
* Централизованное хранение пользователей и VPN-конфигураций
* Поддержка нескольких устройств для одного пользователя
* Интеграция магазина и платежной системы в будущем
* Простые связи между сущностями и удобная масштабируемость
