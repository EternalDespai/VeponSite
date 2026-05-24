// account.js – минимальная рабочая версия (будет дополняться)
async function loadAccount() {
  try {
    const resp = await fetch('/auth/check', { credentials: 'include' });
    const data = await resp.json();

    if (!data.authenticated) {
      showAuthWidget();
      return;
    }

    const user = data.user_info;

    // Заполняем пользовательскую информацию
    const userInfoH3 = document.querySelector('.user-info h3');
    const userInfoP = document.querySelector('.user-info p');
    if (userInfoH3) userInfoH3.textContent = `@${user.username || user.user_id}`;
    if (userInfoP) userInfoP.innerHTML = `Telegram ID: ${user.user_id}`;

    // Статус подписки
    const statusSpan = document.querySelector('.status');
    const hasSubscription = user.has_subscription;
    const expiresAt = user.expires_at ? new Date(user.expires_at) : null;
    const now = new Date();
    const isActive = hasSubscription && expiresAt && expiresAt > now;

    if (statusSpan) {
      statusSpan.textContent = isActive ? 'Активна' : 'Неактивна';
      statusSpan.className = isActive ? 'status active' : 'status expired';
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

    // VPN-ссылка
    if (user.vpn_link && !document.querySelector('.vpn-block')) {
      const accountContent = document.querySelector('.account-content');
      if (accountContent) {
        const vpnBlock = document.createElement('div');
        vpnBlock.className = 'subscription-card vpn-block';
        vpnBlock.innerHTML = `
          <h3>VPN-конфигурация</h3>
          <code style="display:block;word-break:break-all;">${user.vpn_link}</code>
          <button class="btn primary copy-link-btn">Копировать</button>
        `;
        accountContent.appendChild(vpnBlock);
        vpnBlock.querySelector('.copy-link-btn').addEventListener('click', () => {
          navigator.clipboard.writeText(user.vpn_link);
          alert('Ссылка скопирована');
        });
      }
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

document.addEventListener('DOMContentLoaded', loadAccount);