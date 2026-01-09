# 📦 Облік закупівель "Галя Балувана"

> PWA-додаток для обліку закупівель, відвантаження та доставок із підтримкою офлайн-режиму та AI-звітів.

## 📚 Зміст

- [Огляд](#огляд)
- [Основні можливості](#-основні-можливості)
- [Системні вимоги](#-системні-вимоги)
- [Швидкий старт](#-швидкий-старт)
- [Скрипти](#-скрипти)
- [Використання додатку](#-використання-додатку)
- [Архітектура](#-архітектура)
- [Налаштування](#-налаштування)
- [API Endpoints](#-api-endpoints)
- [Оптимізація фото](#-оптимізація-фото)
- [Безпека](#-безпека)
- [Service Worker стратегії](#-service-worker-стратегії)
- [Усунення проблем](#-усунення-проблем)
- [Моніторинг](#-моніторинг)
- [Внесок в проект](#-внесок-в-проект)
- [Ліцензія](#-ліцензія)
- [Контакти](#-контакти)

---

## Огляд

Це односторінковий PWA-додаток для внутрішнього обліку операцій (закупки, відвантаження, доставки). Дані зберігаються локально, а при доступі до мережі синхронізуються з бекендом через webhook. Додаток підтримує AI-розпізнавання чеків і генерацію зведених звітів.

## 🌟 Основні можливості

- 📝 **Три типи операцій**: Закупки, Відвантаження, Доставки
- 🤖 **AI-розпізнавання чеків** для магазину Метро (Gemini Vision API)
- 📸 **Фото документація** з автоматичним стисненням (WebP/JPEG)
- 📊 **AI-звіти** через Google Gemini
- 📴 **Офлайн-режим** завдяки Service Worker
- 🌓 **Темна/світла тема**
- 🔒 **Безпека**: CSP, XSS-захист, валідація даних
- 💾 **Надійне зберігання** в localStorage
- 🚀 **Швидкість**: оптимізований кеш, WebP compression

---

## 🧩 Системні вимоги

- Node.js 18+ (рекомендовано LTS)
- npm 9+ або сумісний менеджер пакетів
- Сучасний браузер (Chrome/Edge/Safari/Firefox)

---

## 🚀 Швидкий старт

### 1. Встановлення

```bash
# Клонувати репозиторій
git clone https://github.com/your-repo/gala-baluvana-delivery.git

# Перейти в папку
cd gala-baluvana-delivery

# Встановити залежності
npm install
```

### 2. Локальний запуск

```bash
# Запустити dev-сервер
npm run dev

# Відкрити в браузері
# http://localhost:3000
```

### 3. Деплой на Vercel

```bash
# Встановити Vercel CLI (якщо ще немає)
npm install -g vercel

# Задеплоїти
vercel --prod
```

---

## 🧪 Скрипти

> Повний список дивіться в `package.json`.

```bash
npm run dev       # локальний запуск
npm run build     # збірка
npm run preview   # перегляд збірки
```

---

## 📱 Використання додатку

### Створення закупки

#### Звичайний режим:
1. **Натисніть** "Почати закупку"
2. **Виберіть локацію** закупки
3. **Заповніть форму:**
   - Назва товару (автозаповнення з бази)
   - Кількість
   - Одиниця виміру
   - Ціна за одиницю
   - Локація
4. **Додайте фото** (опціонально)
5. **Відправте** → Дані збережуться локально та відправляться на сервер

#### 🤖 AI-розпізнавання чеків (Метро):
1. **Натисніть** "Почати закупку"
2. **Виберіть локацію** "Метро"
3. **Оберіть метод:**
   - **"Сканувати чек"** - AI розпізнає всі товари автоматично (рекомендовано)
   - **"Ввести вручну"** - стандартна форма
4. **При скануванні чека:**
   - Зробіть чітке фото всього чека
   - Натисніть "Розпізнати чек"
   - AI розпізнає назви, кількості та ціни всіх товарів
   - Перевірте розпізнані товари (можна редагувати/видаляти)
   - Підтвердіть → всі товари додадуться до чернетки
5. **Відправте заявку** з усіма товарами

### Відвантаження / Доставка

Аналогічно закупці, але з іншими полями локацій.

### Перегляд історії

1. **Перейдіть** у вкладку "Історія"
2. **Переглядайте** всі операції
3. **Фільтруйте** за типом

### Генерація AI-звіту

1. **Натисніть** "Завершити день"
2. **AI проаналізує** всі операції за день
3. **Отримайте** структурований звіт з рекомендаціями

### Режими роботи

- **Робочий режим**: дані йдуть на `/api/delivery` (production webhook)
- **Тестовий режим**: дані йдуть на `webhook-test/delivery`

Перемикайте кнопкою в header (зеленим = робочий, червоним = тестовий).

### Стан завантаження

Поки дані завантажуються, додаток може показувати тимчасові заповнювачі (skeleton). За потреби їх можна вимкнути на рівні стилів.

---

## 🏗️ Архітектура

```
GalaBaluvanaDelivery/
├── index.html          # Головна сторінка
├── app.js              # Вся логіка застосунку
├── styles.css          # Стилі з темами
├── service-worker.js   # PWA кешування
├── manifest.json       # PWA конфігурація
├── api/
│   └── delivery.ts     # Vercel API proxy
├── package.json
└── vercel.json
```

### Основні класи

```javascript
InputValidator          // Валідація та санітизація
SecureConfig            // Налаштування (webhook, locations, products)
AppState                // Управління станом UI
SecureStorageManager    // Робота з localStorage
DraftManager            // Управління чернетками відвантаження
PurchaseDraftManager    // Управління чернетками закупок
InventoryManager        // Облік залишків товарів
ToastManager            // Сповіщення
ThemeManager            // Теми
SecureApiClient         // API запити (включно з Gemini Vision для чеків)
PhotoCompressor         // Стиснення фото
```

### Нові функції для AI-розпізнавання чеків

```javascript
// API метод для сканування чека
SecureApiClient.scanReceipt(imageFile)
  → повертає масив товарів: [{ productName, quantity, unit, pricePerUnit }]

// UI функції
showReceiptScanScreen()          // Екран фотографування чека
handleReceiptPhotoSelect()       // Обробка вибору фото
processReceipt()                 // Відправка на Gemini Vision API
showRecognizedItemsScreen()      // Перегляд розпізнаних товарів
confirmRecognizedItems()         // Підтвердження та додавання до чернетки
```

---

## 🔐 Безпека

### Content Security Policy (CSP)
```html
<meta http-equiv="Content-Security-Policy" content="
    default-src 'self';
    script-src 'self' https://unpkg.com https://cdn.jsdelivr.net;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    ...">
```

### XSS Захист
- Всі дані санітизуються через `InputValidator.sanitizeString()`
- Використання `textContent` замість `innerHTML`
- Валідація файлів (розмір, тип, розширення)

### Валідація даних
```javascript
validateProductName(name)  // 2-100 символів
validateQuantity(qty)      // 0-10000
validatePrice(price)       // 0-100000
validateLocation(loc)      // 2-100 символів
validateFile(file)         // max 10MB, image/* only
```

---

## 📊 Service Worker стратегії

| Тип запиту | Стратегія | Причина |
|------------|-----------|---------|
| HTML | Network-first | Завжди свіжий контент |
| API `/api/*` | Network-first | Актуальні дані |
| Static assets | Cache-first | Швидка загрузка |
| CDN resources | Stale-while-revalidate | Баланс швидкості/свіжості |
| POST/PUT/DELETE | Network-only | Не кешуємо мутації |

---

## 🖼️ Оптимізація фото

### PhotoCompressor
```javascript
1. Resize до 1024x1024 (якщо більше)
2. Спроба WebP (85% якість)
3. Fallback на JPEG (85% якість)
4. Результат: -30-50% розміру
```

### Приклад:
```
До:  5.2 MB (JPEG 4000x3000)
Після: 850 KB (WebP 1024x768)
Економія: 83% 🎉
```

---

## 🌐 API Endpoints

### Production (через Vercel proxy)
```
POST /api/delivery
Content-Type: multipart/form-data

data: { productName, quantity, ... }
file: [binary photo data]
```

### Test
```
POST https://n8n.dmytrotovstytskyi.online/webhook-test/deliverygb
```

### AI Summary (опціонально)
```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key={API_KEY}

{
  "contents": [{
    "parts": [{ "text": "Проаналізуй..." }]
  }]
}
```

---

## 🛠️ Налаштування

### 1. Webhook URL

**Файл:** `app.js` → `SecureConfig`

```javascript
resolveWebhookUrl() {
    const productionUrl = '/api/delivery';
    const testUrl = 'https://n8n.dmytrotovstytskyi.online/webhook-test/deliverygb';
    return this.isTestMode ? testUrl : productionUrl;
}
```

### 2. Gemini API Key

```javascript
constructor() {
    this.GEMINI_API_KEY = ''; // Вставте ваш ключ тут
    this.GEMINI_API_URL = this.GEMINI_API_KEY ? '...' : null;
}
```

Або через змінні середовища:
```bash
# .env
GEMINI_API_KEY=your_key_here
```

### 3. Локації та продукти

**Файл:** `app.js` → `SecureConfig`

```javascript
get marketLocations() {
    return [
        'Калинівський ринок',
        'Зелений ринок',
        'Метро',
        // Додайте свої локації
    ];
}

get products() {
    return [
        'Картопля',
        'Цибуля',
        'Капуста',
        // Додайте свої продукти
    ];
}
```

---

## 🐛 Усунення проблем

### Проблема: Додаток не завантажується

**Рішення:**
1. Відкрийте DevTools (F12)
2. Перевірте Console на помилки
3. Перевірте Network → статус запитів

### Проблема: Service Worker не оновлюється

**Рішення:**
```javascript
// У Console
navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(r => r.unregister());
});
location.reload();
```

### Проблема: Дані не зберігаються

**Рішення:**
1. Application → Local Storage → Перевірте наявність
2. Перевірте квоту: `navigator.storage.estimate()`
3. Очистіть кеш якщо переповнення

### Проблема: Фото не завантажується

**Рішення:**
- Переконайтесь, що розмір < 10MB
- Формат: JPEG, PNG, WebP, HEIC
- Перевірте Console на помилки compression

---

## 📈 Моніторинг

### Перевірка стану Service Worker
```javascript
navigator.serviceWorker.getRegistration().then(reg => {
    console.log('SW State:', reg?.active?.state);
    console.log('SW URL:', reg?.active?.scriptURL);
});
```

### Перевірка localStorage
```javascript
const history = localStorage.getItem('purchase_history');
console.log('History:', JSON.parse(history).length, 'items');
```

### Перевірка кешу
```javascript
caches.keys().then(names => {
    names.forEach(name => {
        caches.open(name).then(cache => {
            cache.keys().then(keys => {
                console.log(name, ':', keys.length, 'cached files');
            });
        });
    });
});
```

---

## 🤝 Внесок в проект

1. **Fork** репозиторій
2. **Створіть** гілку: `git checkout -b feature/amazing`
3. **Commit**: `git commit -m 'Add amazing feature'`
4. **Push**: `git push origin feature/amazing`
5. **Pull Request** з описом змін

---

## 📄 Ліцензія

MIT License - використовуйте вільно!

---

## 🎉 Автори

- **Оригінальний код**: [DMytro Tovstytskyi]
- **Оптимізація та рефакторинг**: [Claude Code - Anthropic]

---

## 📞 Контакти

- **Email**: support@galabaluvana.com
- **Telegram**: @gala_baluvana_bot
- **GitHub Issues**: [Issues](https://github.com/your-repo/issues)

---

**Версія**: 2.0 (повністю переписано)
**Дата**: Січень 2025
**Статус**: ✅ Production Ready
**PWA**: ✅ Installable
**Offline**: ✅ Full Support
