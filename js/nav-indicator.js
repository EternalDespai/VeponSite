// Навигационный индикатор текущей страницы
class NavIndicator {
  constructor() {
    this.indicator = null;
    this.navLinks = [];
    this.currentPage = '';
    this.init();
  }

  init() {

    this.createIndicator();
    this.updateNavLinks();
    this.setCurrentPage();
    this.positionIndicator();
    this.addEventListeners();
  }

  createIndicator() {
    this.indicator = document.createElement('div');
    this.indicator.className = 'nav-indicator';
    this.indicator.innerHTML = `
      <div class="nav-indicator-glass"></div>
    `;
    document.querySelector('.nav-links').appendChild(this.indicator);
  }

  updateNavLinks() {
    this.navLinks = Array.from(document.querySelectorAll('.nav-links a'));
  }

  setCurrentPage() {
    const currentPath = window.location.pathname;
    const currentFile = currentPath.split('/').pop() || 'index.html';
    
    // Определяем текущую страницу (по умолчанию "О сервисе")
    if (currentFile === 'index.html' || currentFile === '') {
      this.currentPage = 'О сервисе';
    } else if (currentFile === 'catalog.html') {
      this.currentPage = 'Тарифы';
    } else if (currentFile === 'instructions.html') {
      this.currentPage = 'Инструкции';
    } else if (currentFile === 'account.html') {
      // Проверяем есть ли ссылка "Профиль" в навигации
      const profileLink = this.navLinks.find(link => 
        link.textContent.trim() === 'Профиль'
      );
      
      if (profileLink) {
        this.currentPage = 'Профиль';
      } else {
        // Если ссылки нет, показываем "О сервисе"
        this.currentPage = 'О сервисе';
      }
    } else {
      this.currentPage = 'О сервисе';
    }
  }

  positionIndicator() {
    if (!this.currentPage) return;

    const activeLink = this.navLinks.find(link => 
      link.textContent.trim() === this.currentPage
    );

    if (activeLink) {
      const linkRect = activeLink.getBoundingClientRect();
      const navRect = activeLink.parentElement.getBoundingClientRect();
      
      // Позиционируем индикатор относительно навигации
      const left = linkRect.left - navRect.left - 10;
      const width = linkRect.width + 20;
      
      this.indicator.style.left = `${left}px`;
      this.indicator.style.width = `${width}px`;
      
      this.indicator.style.opacity = '1';
      this.indicator.style.transform = 'translateY(-5px)';
    }
  }

  addEventListeners() {
    // Обновляем при изменении размера окна
    window.addEventListener('resize', () => {
      this.positionIndicator();
    });

    // Обновляем при загрузке страницы
    document.addEventListener('DOMContentLoaded', () => {
      this.updateNavLinks();
      this.setCurrentPage();
      this.positionIndicator();
    });

    // Добавляем hover эффекты
    this.navLinks.forEach(link => {
      link.addEventListener('mouseenter', () => {
        this.hoverLink(link);
      });
      
      link.addEventListener('mouseleave', () => {
        this.positionIndicator();
      });
    });
  }

  hoverLink(link) {
    const linkRect = link.getBoundingClientRect();
    const navRect = link.parentElement.getBoundingClientRect();
    
    const left = linkRect.left - navRect.left - 10;
    const width = linkRect.width + 20;
    
    this.indicator.style.left = `${left}px`;
    this.indicator.style.width = `${width}px`;
  }
}

// Инициализация
let navIndicator;
document.addEventListener('DOMContentLoaded', () => {
  navIndicator = new NavIndicator();
});
