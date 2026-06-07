#!/usr/bin/env python3
import json
import sqlite3
from flask import Flask, request, jsonify
from datetime import datetime, timedelta
import wireguard
import db

app = Flask(__name__)
DB_PATH = '/root/awg-docker-bot/awg/clients.db'

# Конфиг сервера
SERVER_ENDPOINT = "YOUR_SERVER_IP"
SERVER_PUBKEY = "YOUR_WG_PUBKEY"

wireguard.set_server_pubkey(SERVER_PUBKEY)


@app.route('/api/vpn/create', methods=['POST'])
def create_vpn_client():
    """Создает VPN конфиг для пользователя"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        username = data.get('username', f'user_{user_id}')
        days = data.get('days', 30)

        if not user_id:
            return jsonify({'error': 'user_id required'}), 400

        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()

        c.execute("SELECT vpn_link, expires_at FROM clients WHERE user_id = ?", (user_id,))
        existing = c.fetchone()

        if existing and existing[0]:
            current_expires = datetime.fromisoformat(existing[1])
            new_expires = current_expires + timedelta(days=days)
            c.execute("UPDATE clients SET expires_at = ? WHERE user_id = ?", (new_expires.isoformat(), user_id))
            conn.commit()
            conn.close()
            return jsonify({
                'success': True,
                'exists': True,
                'vpn_link': existing[0],
                'expires_at': new_expires.isoformat()
            })

        vpn_link, private_key, client_ip, public_key = wireguard.create_client(username, SERVER_ENDPOINT)

        if not vpn_link:
            return jsonify({'error': 'Failed to create VPN client'}), 500

        expires_at = (datetime.now() + timedelta(days=days)).isoformat()
        created_at = datetime.now().isoformat()

        c.execute("""
            INSERT OR REPLACE INTO clients 
            (user_id, username, private_key, vpn_link, created_at, expires_at, client_ip, public_key)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (user_id, username, private_key, vpn_link, created_at, expires_at, client_ip, public_key))

        conn.commit()
        conn.close()

        return jsonify({
            'success': True,
            'exists': False,
            'vpn_link': vpn_link,
            'client_ip': client_ip,
            'expires_at': expires_at
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/vpn/extend', methods=['POST'])
def extend_vpn_subscription():
    """Продлевает подписку существующего пользователя"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        days = data.get('days', 30)

        if not user_id:
            return jsonify({'error': 'user_id required'}), 400

        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()

        c.execute("SELECT expires_at, vpn_link FROM clients WHERE user_id = ?", (user_id,))
        client = c.fetchone()

        if not client or not client[1]:
            conn.close()
            return jsonify({'success': False, 'error': 'No VPN client found'}), 404

        current_expires = datetime.fromisoformat(client[0])
        new_expires = current_expires + timedelta(days=days)

        c.execute("UPDATE clients SET expires_at = ? WHERE user_id = ?", (new_expires.isoformat(), user_id))
        conn.commit()
        conn.close()

        return jsonify({
            'success': True,
            'vpn_link': client[1],
            'expires_at': new_expires.isoformat()
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/vpn/check', methods=['GET'])
def check_vpn_status():
    """Проверяет статус VPN пользователя"""
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'error': 'user_id required'}), 400

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT vpn_link, expires_at, client_ip FROM clients WHERE user_id = ?", (user_id,))
    client = c.fetchone()
    conn.close()

    if not client or not client[0]:
        return jsonify({'has_vpn': False})

    return jsonify({
        'has_vpn': True,
        'vpn_link': client[0],
        'expires_at': client[1],
        'client_ip': client[2]
    })

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok'})

if __name__ != '__main__':
    pass