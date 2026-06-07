document.addEventListener('DOMContentLoaded', function() {
  // 1. Аккордеон для FAQ
  const faqItems = document.querySelectorAll('.faq-item');
  
  faqItems.forEach(item => {
    item.addEventListener('click', function(e) {
      // Закрываем все другие ответы
      faqItems.forEach(otherItem => {
        if (otherItem !== item) {
          otherItem.classList.remove('active');
        }
      });
      
      // Переключаем текущий ответ
      item.classList.toggle('active');
    });
  });

  // 2. Плавное появление элементов FAQ при загрузке страницы
  const animateElements = document.querySelectorAll('.faq-item, .support-contacts, .contact-item');
  
  animateElements.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  });

  animateElements.forEach((el, index) => {
    setTimeout(() => {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }, index * 80); // элемент появляется через 0.08 секунды
  });

  const contactItems = document.querySelectorAll('.contact-item');
  contactItems.forEach(item => {
    item.addEventListener('mouseenter', () => {
      item.style.transform = 'translateX(8px)';
      item.style.transition = 'transform 0.2s ease';
    });
    item.addEventListener('mouseleave', () => {
      item.style.transform = 'translateX(0)';
    });
  });
});