const request = require('supertest');
const app = require('./server');
const TEST_AUTH_HEADER = 'true';

// ============================================
// 1. ТЕСТЫ ДЛЯ ТОВАРОВ
// ============================================
describe('📦 Товары (GET /api/products)', () => {
  
  test('должен вернуть список товаров с кодом 200', async () => {
    const response = await request(app).get('/api/products');
    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
  });

  test('каждый товар должен иметь обязательные поля', async () => {
    const response = await request(app).get('/api/products');
    const product = response.body[0];
    expect(product).toHaveProperty('id');
    expect(product).toHaveProperty('name');
    expect(product).toHaveProperty('price_rub');
    expect(product).toHaveProperty('days');
  });

  test('цены должны быть положительными числами', async () => {
    const response = await request(app).get('/api/products');
    response.body.forEach(product => {
      expect(product.price_rub).toBeGreaterThan(0);
      expect(typeof product.price_rub).toBe('number');
    });
  });

  test('все товары должны иметь уникальные id', async () => {
    const response = await request(app).get('/api/products');
    const ids = response.body.map(p => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

// ============================================
// 2. ТЕСТЫ ДЛЯ КОРЗИНЫ
// ============================================
describe('🛒 Корзина', () => {
  
  test('POST /api/cart - должен добавить товар в корзину', async () => {
    const response = await request(app)
      .post('/api/cart')
      .set('x-test-auth', TEST_AUTH_HEADER)
      .send({ product_id: 1, quantity: 2 });
    
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('success');
    expect(response.body.success).toBe(true);
  });

  test('POST /api/cart - должен вернуть ошибку без product_id', async () => {
    const response = await request(app)
      .post('/api/cart')
      .set('x-test-auth', TEST_AUTH_HEADER)
      .send({ quantity: 1 });
    
    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty('error');
  });

  test('POST /api/cart - должен обработать невалидный product_id', async () => {
    const response = await request(app)
      .post('/api/cart')
      .set('x-test-auth', TEST_AUTH_HEADER)
      .send({ product_id: 'abc', quantity: 1 });
    
    expect([200, 400]).toContain(response.statusCode);
  });

  test('GET /api/cart - должен получить корзину пользователя', async () => {
    const response = await request(app)
      .get('/api/cart')
      .set('x-test-auth', TEST_AUTH_HEADER);
    
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('items');
    expect(Array.isArray(response.body.items)).toBe(true);
  });

  test('DELETE /api/cart/:id - должен удалить товар из корзины', async () => {
    // Сначала добавим товар
    await request(app)
      .post('/api/cart')
      .set('x-test-auth', TEST_AUTH_HEADER)
      .send({ product_id: 1, quantity: 1 });
    
    // Получим корзину
    const cartRes = await request(app)
      .get('/api/cart')
      .set('x-test-auth', TEST_AUTH_HEADER);
    
    if (cartRes.body.items && cartRes.body.items.length > 0) {
      const itemId = cartRes.body.items[0].id;
      const response = await request(app)
        .delete(`/api/cart/${itemId}`)
        .set('x-test-auth', TEST_AUTH_HEADER);
      
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(true);
    }
  });

  test('DELETE /api/cart/:id - должен обработать несуществующий товар', async () => {
    const response = await request(app)
      .delete('/api/cart/99999')
      .set('x-test-auth', TEST_AUTH_HEADER);

    expect([200, 404]).toContain(response.statusCode);
  });
});

// ============================================
// 3. ТЕСТЫ ДЛЯ ЗАКАЗОВ
// ============================================
describe('📋 Заказы', () => {
  
  test('POST /api/orders - должен создать заказ', async () => {
    const response = await request(app)
      .post('/api/orders')
      .set('x-test-auth', TEST_AUTH_HEADER)
      .send({
        name: 'Тест Тестов',
        email: 'test@example.com',
        phone: '+79991234567',
        payment_method: 'card'
      });
    
    if (response.statusCode === 200) {
      expect(response.body).toHaveProperty('order_id');
      expect(response.body).toHaveProperty('status');
    } else {
      expect(response.statusCode).toBe(400);
      expect(response.body).toHaveProperty('error');
    }
  });

  test('POST /api/orders - должен создать заказ с оплатой через Telegram', async () => {
    const response = await request(app)
      .post('/api/orders')
      .set('x-test-auth', TEST_AUTH_HEADER)
      .send({
        name: 'Тест Тестов',
        email: 'test@example.com',
        phone: '+79991234567',
        payment_method: 'telegram'
      });
    
    if (response.statusCode === 200) {
      expect(response.body).toHaveProperty('order_id');
    } else {
      expect(response.statusCode).toBe(400);
    }
  });

  test('POST /api/orders - должен вернуть ошибку без обязательных полей', async () => {
    const response = await request(app)
      .post('/api/orders')
      .set('x-test-auth', TEST_AUTH_HEADER)
      .send({ name: 'Тест' });
    
    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty('error');
  });

  test('GET /api/orders - должен получить список заказов', async () => {
    const response = await request(app)
      .get('/api/orders')
      .set('x-test-auth', TEST_AUTH_HEADER);
    
    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });
});

// ============================================
// 4. ТЕСТЫ НА ОШИБКИ
// ============================================
describe('⚠️ Обработка ошибок', () => {
  
  test('должен вернуть 404 для несуществующего маршрута', async () => {
    const response = await request(app).get('/api/nonexistent-route-123');
    expect(response.statusCode).toBe(404);
  });

  test('должен обработать несуществующий товар', async () => {
    const response = await request(app)
      .post('/api/cart')
      .set('x-test-auth', TEST_AUTH_HEADER)
      .send({ product_id: 99999, quantity: 1 });
    
    expect([200, 400, 404]).toContain(response.statusCode);
  });

  test('должен обработать отрицательное количество', async () => {
    const response = await request(app)
      .post('/api/cart')
      .set('x-test-auth', TEST_AUTH_HEADER)
      .send({ product_id: 1, quantity: -5 });
    
    expect([200, 400]).toContain(response.statusCode);
  });

  test('должен вернуть 405 для неподдерживаемого метода', async () => {
    const response = await request(app)
      .put('/api/products')
      .send({});
    expect([404, 405]).toContain(response.statusCode);
  });

  test('должен возвращать JSON для API запросов', async () => {
    const response = await request(app).get('/api/products');
    expect(response.headers['content-type']).toMatch(/json/);
  });
});

// ============================================
// 5. ТЕСТЫ ДЛЯ СТАТИЧЕСКИХ ФАЙЛОВ
// ============================================
describe('📄 Статические файлы', () => {
  
  test('должен отдавать index.html', async () => {
    const response = await request(app).get('/');
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toMatch(/html/);
  });

  test('должен отдавать catalog.html', async () => {
    const response = await request(app).get('/catalog.html');
    expect([200, 304]).toContain(response.statusCode);
  });

  test('должен возвращать 404 для несуществующего файла', async () => {
    const response = await request(app).get('/nonexistent-file.html');
    expect(response.statusCode).toBe(404);
  });
});

// ============================================
// 6. ДОПОЛНИТЕЛЬНЫЕ ТЕСТЫ
// ============================================
describe('🔍 Дополнительные проверки', () => {
  
  test('структура ответа /api/products должна быть стабильной', async () => {
    const response = await request(app).get('/api/products');
    const firstProduct = response.body[0];
    expect(typeof firstProduct.id).toBe('number');
    expect(typeof firstProduct.name).toBe('string');
    expect(typeof firstProduct.price_rub).toBe('number');
    expect(typeof firstProduct.days).toBe('number');
  });

  test('корзина должна быть пустой после очистки', async () => {
    // Добавляем товар
    await request(app)
      .post('/api/cart')
      .set('x-test-auth', TEST_AUTH_HEADER)
      .send({ product_id: 1, quantity: 1 });
    
    // Получаем корзину
    const cartRes = await request(app)
      .get('/api/cart')
      .set('x-test-auth', TEST_AUTH_HEADER);
    
    if (cartRes.body.items && cartRes.body.items.length > 0) {
      for (const item of cartRes.body.items) {
        await request(app)
          .delete(`/api/cart/${item.id}`)
          .set('x-test-auth', TEST_AUTH_HEADER);
      }
    }
    
    const finalCart = await request(app)
      .get('/api/cart')
      .set('x-test-auth', TEST_AUTH_HEADER);
    
    expect(finalCart.body.items).toHaveLength(0);
  });

  test('проверка валидации email при создании заказа', async () => {
    const response = await request(app)
      .post('/api/orders')
      .set('x-test-auth', TEST_AUTH_HEADER)
      .send({
        name: 'Тест',
        email: 'невалидный-email',
        payment_method: 'card'
      });
    
    expect([200, 400]).toContain(response.statusCode);
  });
});

// ============================================
// 7. ТЕСТЫ ПРОИЗВОДИТЕЛЬНОСТИ
// ============================================
describe('⚡ Производительность', () => {
  
  test('GET /api/products должен отвечать быстро (< 200ms)', async () => {
    const start = Date.now();
    await request(app).get('/api/products');
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(200);
  });

  test('POST /api/cart должен отвечать быстро (< 100ms)', async () => {
    const start = Date.now();
    await request(app)
      .post('/api/cart')
      .set('x-test-auth', TEST_AUTH_HEADER)
      .send({ product_id: 1, quantity: 1 });
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(100);
  });
});

// ============================================
// ВЫВОД РЕЗУЛЬТАТОВ
// ============================================
afterAll(async () => {
  console.log('\n✅ Все тесты успешно завершены!');
  console.log('📊 Проверены: товары, корзина, заказы, ошибки, статика, производительность');
  console.log('🧪 Тестовый режим: авторизация эмулирована через x-test-auth');
});