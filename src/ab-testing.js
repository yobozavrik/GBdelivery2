/**
 * A/B Testing Module
 * Підтримка A/B тестування для оптимізації продуктивності та UX
 */

class ABTestManager {
    constructor() {
        this.tests = new Map();
        this.results = new Map();
        this.activeTests = new Set();
        this.analytics = [];
    }

    /**
     * Реєстрація нового A/B тесту
     * @param {string} testName - Назва тесту
     * @param {Object} config - Конфігурація тесту
     * @param {number} config.split - Відсоток користувачів для варіанту B (0-100)
     * @param {string} config.variantA - Код варіанту A
     * @param {string} config.variantB - Код варіанту B
     */
    registerTest(testName, config) {
        if (this.tests.has(testName)) {
            console.warn(`Test ${testName} already registered`);
            return;
        }

        const testConfig = {
            name: testName,
            split: config.split || 50,
            variantA: config.variantA || 'control',
            variantB: config.variantB || 'variant',
            active: config.active !== false,
            metadata: config.metadata || {}
        };

        this.tests.set(testName, testConfig);

        if (testConfig.active) {
            this.activateTest(testName);
        }

        console.log(`✅ Test registered: ${testName}`);
    }

    /**
     * Активація тесту
     */
    activateTest(testName) {
        const testConfig = this.tests.get(testName);
        if (!testConfig) {
            console.error(`Test ${testName} not found`);
            return null;
        }

        // Генеруємо унікальний ID для користувача (якщо не існує)
        let userId = localStorage.getItem(`ab_user_id`);
        if (!userId) {
            userId = this.generateUserId();
            localStorage.setItem('ab_user_id', userId);
        }

        // Детерміністичне привласнення варіанту
        const variant = this.getVariant(testName, userId);

        // Зберігаємо рішення
        const testResult = {
            testName,
            variant,
            userId,
            timestamp: Date.now(),
            config: testConfig
        };

        this.results.set(testName, testResult);
        this.activeTests.add(testName);

        console.log(`🧪 Test ${testName} activated: variant=${variant}`);

        return testResult;
    }

    /**
     * Отримати активний варіант для тесту
     */
    getVariant(testName, userId = null) {
        const result = this.results.get(testName);
        if (result) {
            return result.variant;
        }

        if (!userId) {
            userId = localStorage.getItem('ab_user_id') || this.generateUserId();
        }

        const testConfig = this.tests.get(testName);
        if (!testConfig) {
            return 'control'; // Default to control
        }

        // Детерміністичний hash для стабільності привласнення
        const hash = this.hashCode(`${testName}-${userId}`);
        const threshold = (testConfig.split / 100) * 1000000;
        const variant = hash < threshold ? 'variantB' : 'variantA';

        return variant;
    }

    /**
     * Перевірка, чи активний тест
     */
    isTestActive(testName) {
        return this.activeTests.has(testName);
    }

    /**
     * Відстеження події для аналітики
     */
    trackEvent(testName, eventName, data = {}) {
        const result = this.results.get(testName);
        if (!result) {
            return;
        }

        const event = {
            testName,
            variant: result.variant,
            eventName,
            data,
            timestamp: Date.now(),
            userId: result.userId
        };

        this.analytics.push(event);

        // Локально зберігаємо аналітику
        const stored = JSON.parse(localStorage.getItem('ab_analytics') || '[]');
        stored.push(event);
        localStorage.setItem('ab_analytics', JSON.stringify(stored.slice(-1000))); // Keep last 1000 events

        console.log(`📊 Event tracked: ${testName}.${eventName} (${result.variant})`, data);
    }

    /**
     * Отримати статистику тесту
     */
    getTestStats(testName) {
        const events = this.analytics.filter(e => e.testName === testName);
        const grouped = {};

        events.forEach(event => {
            if (!grouped[event.variant]) {
                grouped[event.variant] = {};
            }
            if (!grouped[event.variant][event.eventName]) {
                grouped[event.variant][event.eventName] = 0;
            }
            grouped[event.variant][event.eventName]++;
        });

        return {
            testName,
            totalEvents: events.length,
            byVariant: grouped
        };
    }

    /**
     * Допоміжні методи
     */
    generateUserId() {
        return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
    }

    /**
     * Export аналітики для зовнішнього аналізу
     */
    exportAnalytics() {
        const analytics = JSON.parse(localStorage.getItem('ab_analytics') || '[]');

        // TODO: Відправка на сервер або в Google Analytics
        // await this.sendToServer(analytics);

        return analytics;
    }

    /**
     * Очистити аналітику
     */
    clearAnalytics() {
        localStorage.removeItem('ab_analytics');
        this.analytics = [];
        console.log('🧹 Analytics cleared');
    }
}

// Singleton instance
const abTestManager = new ABTestManager();

/**
 * Тест 1: Оптимізація форми введення товару
 */
export function initFormOptimizationTest() {
    abTestManager.registerTest('form-optimization', {
        split: 50, // 50% користувачів отримають варіант B
        variantA: 'single-page-form',
        variantB: 'wizard-form',
        active: false,
        metadata: {
            description: 'Тест крокової форми vs одної великої форми',
            hypothesis: 'Крокова форма зменшить час заповнення на 30%'
        }
    });

    return abTestManager;
}

/**
 * Тест 2: Оптимізація списків чернеток
 */
export function initListOptimizationTest() {
    abTestManager.registerTest('list-optimization', {
        split: 30, // 30% користувачів отримають варіант B
        variantA: 'load-all',
        variantB: 'pagination',
        active: false,
        metadata: {
            description: 'Тест pagination vs завантаження всіх елементів',
            hypothesis: 'Pagination зменшить час завантаження на 50%'
        }
    });

    return abTestManager;
}

/**
 * Тест 3: AI розпізнавання
 */
export function initAIScanOptimizationTest() {
    abTestManager.registerTest('ai-scan-optimization', {
        split: 40,
        variantA: 'single-processing',
        variantB: 'batch-processing',
        active: false,
        metadata: {
            description: 'Тест batch processing для AI розпізнавання',
            hypothesis: 'Batch processing покращить точність на 15%'
        }
    });

    return abTestManager;
}

/**
 * Тест 4: Навігація
 */
export function initNavigationOptimizationTest() {
    abTestManager.registerTest('navigation-optimization', {
        split: 50,
        variantA: 'default-nav',
        variantB: 'enhanced-nav',
        active: false,
        metadata: {
            description: 'Тест покращеної навігації з breadcrumbs',
            hypothesis: 'Pокращена навігація зменшить кількість кліків на 25%'
        }
    });

    return abTestManager;
}

/**
 * Тест 5: PDF генерація
 */
export function initPDFOptimizationTest() {
    abTestManager.registerTest('pdf-optimization', {
        split: 30,
        variantA: 'full-regeneration',
        variantB: 'cached-generation',
        active: false,
        metadata: {
            description: 'Тест кешування шрифтів для PDF',
            hypothesis: 'Кешування зменшить час генерації на 40%'
        }
    });

    return abTestManager;
}

/**
 * Ініціалізація всіх тестів
 */
export function initAllABTests() {
    initFormOptimizationTest();
    initListOptimizationTest();
    initAIScanOptimizationTest();
    initNavigationOptimizationTest();
    initPDFOptimizationTest();

    console.log('🎯 All A/B tests initialized');
    return abTestManager;
}

export { abTestManager };

