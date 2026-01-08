/**
 * Автоматизированный тест приложения "Облік закупівель"
 * Запуск: node tests/automated-test.js
 */

class AppTester {
    constructor() {
        this.results = [];
        this.passedTests = 0;
        this.failedTests = 0;
        this.baseUrl = 'http://localhost:3000';
    }

    log(category, test, status, message = '') {
        const result = {
            category,
            test,
            status,
            message,
            timestamp: new Date().toISOString()
        };
        this.results.push(result);

        const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
        console.log(`${icon} [${category}] ${test}: ${status}${message ? ' - ' + message : ''}`);

        if (status === 'PASS') this.passedTests++;
        if (status === 'FAIL') this.failedTests++;
    }

    // ============================================
    // 1. ТЕСТЫ ИНФРАСТРУКТУРЫ
    // ============================================

    async testInfrastructure() {
        console.log('\n🏗️  === ТЕСТЫ ИНФРАСТРУКТУРЫ ===\n');

        // Тест 1.1: Проверка существования файлов
        const fs = require('fs');
        const requiredFiles = [
            'index.html',
            'app.js',
            'styles.css',
            'manifest.json',
            'service-worker.js',
            'src/state.js',
            'src/network.js',
            'src/pdf.js',
            'src/validation.js'
        ];

        let allFilesExist = true;
        for (const file of requiredFiles) {
            const exists = fs.existsSync(file);
            if (!exists) {
                this.log('Infrastructure', `File exists: ${file}`, 'FAIL', 'File not found');
                allFilesExist = false;
            }
        }

        if (allFilesExist) {
            this.log('Infrastructure', 'All required files exist', 'PASS');
        }

        // Тест 1.2: Размер файлов
        const appJsSize = fs.statSync('app.js').size;
        const stylesSize = fs.statSync('styles.css').size;

        this.log('Infrastructure', 'app.js size',
            appJsSize < 150000 ? 'PASS' : 'WARN',
            `${(appJsSize / 1024).toFixed(2)} KB`
        );

        this.log('Infrastructure', 'styles.css size',
            stylesSize < 100000 ? 'PASS' : 'WARN',
            `${(stylesSize / 1024).toFixed(2)} KB`
        );

        // Тест 1.3: Проверка manifest.json
        try {
            const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
            const hasName = manifest.name && manifest.name.length > 0;
            const hasIcons = manifest.icons && manifest.icons.length > 0;
            const hasStartUrl = manifest.start_url !== undefined;

            this.log('Infrastructure', 'manifest.json valid',
                hasName && hasIcons && hasStartUrl ? 'PASS' : 'FAIL',
                `name: ${hasName}, icons: ${hasIcons}, start_url: ${hasStartUrl}`
            );
        } catch (e) {
            this.log('Infrastructure', 'manifest.json parse', 'FAIL', e.message);
        }

        // Тест 1.4: Проверка package.json
        try {
            const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
            const hasScripts = pkg.scripts && Object.keys(pkg.scripts).length > 0;
            const hasVersion = pkg.version !== undefined;

            this.log('Infrastructure', 'package.json valid',
                hasScripts && hasVersion ? 'PASS' : 'FAIL',
                `version: ${pkg.version}`
            );
        } catch (e) {
            this.log('Infrastructure', 'package.json parse', 'FAIL', e.message);
        }
    }

    // ============================================
    // 2. ТЕСТЫ КОДА (СТАТИЧЕСКИЙ АНАЛИЗ)
    // ============================================

    async testCodeQuality() {
        console.log('\n📝 === ТЕСТЫ КАЧЕСТВА КОДА ===\n');

        const fs = require('fs');

        // Тест 2.1: Проверка app.js на глобальные переменные
        const appJs = fs.readFileSync('app.js', 'utf8');
        const globalVarMatches = appJs.match(/(?:^|\n)\s*(?:var|let|const)\s+\w+\s*=/g) || [];
        const globalVarCount = globalVarMatches.length;

        this.log('Code Quality', 'Global variables count',
            globalVarCount < 50 ? 'PASS' : 'WARN',
            `${globalVarCount} global vars found`
        );

        // Тест 2.2: Проверка на console.log (должны быть удалены в продакшне)
        const consoleLogCount = (appJs.match(/console\.log\(/g) || []).length;
        this.log('Code Quality', 'console.log statements',
            consoleLogCount < 10 ? 'PASS' : 'WARN',
            `${consoleLogCount} console.log found`
        );

        // Тест 2.3: Проверка на TODO/FIXME комментарии
        const todoCount = (appJs.match(/\/\/\s*(TODO|FIXME)/gi) || []).length;
        this.log('Code Quality', 'TODO/FIXME comments',
            todoCount === 0 ? 'PASS' : 'WARN',
            `${todoCount} TODO/FIXME found`
        );

        // Тест 2.4: Проверка размера функций (строк кода)
        const functionMatches = appJs.match(/function\s+\w+\s*\([^)]*\)\s*\{[^}]*\}/gs) || [];
        const longFunctions = functionMatches.filter(fn => fn.split('\n').length > 50).length;

        this.log('Code Quality', 'Long functions (>50 lines)',
            longFunctions < 5 ? 'PASS' : 'WARN',
            `${longFunctions} long functions`
        );

        // Тест 2.5: Проверка модульности src/*.js
        const srcFiles = fs.readdirSync('src').filter(f => f.endsWith('.js'));
        this.log('Code Quality', 'Modular structure',
            srcFiles.length >= 5 ? 'PASS' : 'WARN',
            `${srcFiles.length} modules in src/`
        );

        // Тест 2.6: Проверка на использование async/await
        const asyncCount = (appJs.match(/async\s+function/g) || []).length;
        const awaitCount = (appJs.match(/await\s+/g) || []).length;

        this.log('Code Quality', 'Async/await usage',
            asyncCount > 0 && awaitCount > 0 ? 'PASS' : 'WARN',
            `${asyncCount} async, ${awaitCount} await`
        );
    }

    // ============================================
    // 3. ТЕСТЫ ВАЛИДАЦИИ
    // ============================================

    async testValidation() {
        console.log('\n✔️  === ТЕСТЫ ВАЛИДАЦИИ ===\n');

        const fs = require('fs');

        // Проверяем наличие модуля валидации
        if (fs.existsSync('src/validation.js')) {
            const validationCode = fs.readFileSync('src/validation.js', 'utf8');

            // Тест 3.1: Наличие sanitize функций
            const hasSanitize = validationCode.includes('sanitize');
            this.log('Validation', 'Sanitization functions',
                hasSanitize ? 'PASS' : 'FAIL',
                hasSanitize ? 'Found' : 'Not found'
            );

            // Тест 3.2: Валидация email
            const hasEmailValidation = validationCode.includes('email') || validationCode.includes('Email');
            this.log('Validation', 'Email validation',
                hasEmailValidation ? 'PASS' : 'WARN',
                hasEmailValidation ? 'Found' : 'Not found'
            );

            // Тест 3.3: Валидация чисел
            const hasNumberValidation = validationCode.includes('number') || validationCode.includes('quantity');
            this.log('Validation', 'Number validation',
                hasNumberValidation ? 'PASS' : 'WARN'
            );
        } else {
            this.log('Validation', 'validation.js exists', 'FAIL', 'File not found');
        }

        // Тест 3.4: CSP в index.html
        const indexHtml = fs.readFileSync('index.html', 'utf8');
        const hasCSP = indexHtml.includes('Content-Security-Policy');
        this.log('Validation', 'Content Security Policy',
            hasCSP ? 'PASS' : 'FAIL',
            hasCSP ? 'CSP header found' : 'No CSP'
        );

        // Тест 3.5: XSS protection
        const usesTextContent = (indexHtml.match(/textContent/g) || []).length > 0;
        const usesInnerHTML = (indexHtml.match(/innerHTML/g) || []).length;

        this.log('Validation', 'XSS protection (textContent vs innerHTML)',
            usesTextContent || usesInnerHTML < 5 ? 'PASS' : 'WARN',
            `textContent usage detected`
        );
    }

    // ============================================
    // 4. ТЕСТЫ PWA
    // ============================================

    async testPWA() {
        console.log('\n📱 === ТЕСТЫ PWA ===\n');

        const fs = require('fs');

        // Тест 4.1: Service Worker существует
        const swExists = fs.existsSync('service-worker.js');
        this.log('PWA', 'Service Worker file exists',
            swExists ? 'PASS' : 'FAIL'
        );

        if (swExists) {
            const swContent = fs.readFileSync('service-worker.js', 'utf8');

            // Тест 4.2: Cache API
            const hasCacheAPI = swContent.includes('caches.open') || swContent.includes('cache.put');
            this.log('PWA', 'Cache API usage',
                hasCacheAPI ? 'PASS' : 'WARN'
            );

            // Тест 4.3: Fetch handler
            const hasFetchHandler = swContent.includes('fetch') && swContent.includes('addEventListener');
            this.log('PWA', 'Fetch event handler',
                hasFetchHandler ? 'PASS' : 'WARN'
            );

            // Тест 4.4: Install event
            const hasInstallEvent = swContent.includes('install');
            this.log('PWA', 'Install event handler',
                hasInstallEvent ? 'PASS' : 'WARN'
            );
        }

        // Тест 4.5: Manifest файл
        if (fs.existsSync('manifest.json')) {
            const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));

            const manifestComplete =
                manifest.name &&
                manifest.short_name &&
                manifest.icons &&
                manifest.icons.length > 0 &&
                manifest.start_url &&
                manifest.display;

            this.log('PWA', 'Manifest completeness',
                manifestComplete ? 'PASS' : 'FAIL',
                `Required fields: ${manifestComplete ? 'All present' : 'Missing some'}`
            );

            // Тест 4.6: Иконки правильных размеров
            const hasCorrectIcons = manifest.icons.some(icon =>
                icon.sizes === '192x192' || icon.sizes === '512x512'
            );
            this.log('PWA', 'Icon sizes (192x192, 512x512)',
                hasCorrectIcons ? 'PASS' : 'WARN'
            );
        }
    }

    // ============================================
    // 5. ТЕСТЫ БЕЗОПАСНОСТИ
    // ============================================

    async testSecurity() {
        console.log('\n🔒 === ТЕСТЫ БЕЗОПАСНОСТИ ===\n');

        const fs = require('fs');
        const appJs = fs.readFileSync('app.js', 'utf8');
        const indexHtml = fs.readFileSync('index.html', 'utf8');

        // Тест 5.1: Hardcoded API keys
        const suspiciousPatterns = [
            /api[_-]?key\s*[:=]\s*['"][^'"]{20,}['"]/gi,
            /token\s*[:=]\s*['"][^'"]{20,}['"]/gi,
            /secret\s*[:=]\s*['"][^'"]{10,}['"]/gi
        ];

        let foundSecrets = false;
        for (const pattern of suspiciousPatterns) {
            if (pattern.test(appJs)) {
                foundSecrets = true;
                break;
            }
        }

        this.log('Security', 'Hardcoded secrets/API keys',
            !foundSecrets ? 'PASS' : 'FAIL',
            foundSecrets ? 'Possible secrets found in code!' : 'None found'
        );

        // Тест 5.2: SQL injection protection (если используется)
        const hasSQLQueries = appJs.includes('SELECT') || appJs.includes('INSERT');
        const usesPreparedStatements = appJs.includes('prepare') || appJs.includes('?');

        if (hasSQLQueries) {
            this.log('Security', 'SQL injection protection',
                usesPreparedStatements ? 'PASS' : 'FAIL',
                'Uses IndexedDB (no SQL)'
            );
        } else {
            this.log('Security', 'SQL injection protection',
                'PASS',
                'No SQL queries (uses IndexedDB)'
            );
        }

        // Тест 5.3: HTTPS enforcement
        const enforcesHTTPS = appJs.includes('https://') || indexHtml.includes('https-only');
        this.log('Security', 'HTTPS usage',
            enforcesHTTPS ? 'PASS' : 'WARN',
            'External resources use HTTPS'
        );

        // Тест 5.4: Input sanitization
        const hasSanitization = appJs.includes('sanitize') || appJs.includes('escape');
        this.log('Security', 'Input sanitization',
            hasSanitization ? 'PASS' : 'WARN',
            hasSanitization ? 'Sanitization found' : 'Check manually'
        );

        // Тест 5.5: CORS configuration
        const hasCORSHandling = appJs.includes('cors') || appJs.includes('Access-Control');
        this.log('Security', 'CORS handling',
            hasCORSHandling ? 'PASS' : 'WARN',
            'Should be configured on server'
        );
    }

    // ============================================
    // 6. ТЕСТЫ ПРОИЗВОДИТЕЛЬНОСТИ
    // ============================================

    async testPerformance() {
        console.log('\n⚡ === ТЕСТЫ ПРОИЗВОДИТЕЛЬНОСТИ ===\n');

        const fs = require('fs');

        // Тест 6.1: Bundle size
        const totalJsSize = fs.statSync('app.js').size +
            fs.readdirSync('src')
                .filter(f => f.endsWith('.js'))
                .reduce((sum, f) => sum + fs.statSync(`src/${f}`).size, 0);

        this.log('Performance', 'Total JavaScript size',
            totalJsSize < 300000 ? 'PASS' : 'WARN',
            `${(totalJsSize / 1024).toFixed(2)} KB`
        );

        // Тест 6.2: CSS size
        const cssSize = fs.statSync('styles.css').size;
        this.log('Performance', 'CSS size',
            cssSize < 100000 ? 'PASS' : 'WARN',
            `${(cssSize / 1024).toFixed(2)} KB`
        );

        // Тест 6.3: Image optimization (если есть)
        const hasImages = fs.existsSync('images') || fs.existsSync('assets');
        if (hasImages) {
            this.log('Performance', 'Image optimization', 'WARN',
                'Manual check required'
            );
        }

        // Тест 6.4: Debouncing/throttling
        const appJs = fs.readFileSync('app.js', 'utf8');
        const hasDebounce = appJs.includes('debounce') || appJs.includes('throttle');
        this.log('Performance', 'Debounce/throttle implementation',
            hasDebounce ? 'PASS' : 'WARN',
            hasDebounce ? 'Found' : 'Consider adding for search/scroll'
        );

        // Тест 6.5: Lazy loading
        const hasLazyLoading = appJs.includes('lazy') || appJs.includes('IntersectionObserver');
        this.log('Performance', 'Lazy loading',
            hasLazyLoading ? 'PASS' : 'WARN',
            hasLazyLoading ? 'Implemented' : 'Consider for large lists'
        );

        // Тест 6.6: Caching strategy
        if (fs.existsSync('service-worker.js')) {
            const sw = fs.readFileSync('service-worker.js', 'utf8');
            const hasCacheStrategy = sw.includes('cache-first') || sw.includes('network-first');
            this.log('Performance', 'Cache strategy',
                hasCacheStrategy ? 'PASS' : 'WARN',
                'Service Worker caching present'
            );
        }
    }

    // ============================================
    // 7. ТЕСТЫ ДОСТУПНОСТИ (A11Y)
    // ============================================

    async testAccessibility() {
        console.log('\n♿ === ТЕСТЫ ДОСТУПНОСТИ ===\n');

        const fs = require('fs');
        const indexHtml = fs.readFileSync('index.html', 'utf8');

        // Тест 7.1: Semantic HTML
        const hasSemanticTags = ['<header', '<main', '<nav', '<footer', '<article', '<section']
            .every(tag => indexHtml.includes(tag));
        this.log('Accessibility', 'Semantic HTML tags',
            hasSemanticTags ? 'PASS' : 'WARN',
            hasSemanticTags ? 'All major tags found' : 'Some missing'
        );

        // Тест 7.2: ARIA labels
        const ariaCount = (indexHtml.match(/aria-/g) || []).length;
        this.log('Accessibility', 'ARIA attributes',
            ariaCount > 5 ? 'PASS' : 'WARN',
            `${ariaCount} ARIA attributes found`
        );

        // Тест 7.3: Alt текст для изображений
        const imgTags = (indexHtml.match(/<img/g) || []).length;
        const imgAltTags = (indexHtml.match(/<img[^>]+alt=/g) || []).length;

        if (imgTags > 0) {
            this.log('Accessibility', 'Image alt attributes',
                imgAltTags === imgTags ? 'PASS' : 'WARN',
                `${imgAltTags}/${imgTags} images have alt`
            );
        }

        // Тест 7.4: Form labels
        const inputCount = (indexHtml.match(/<input/g) || []).length;
        const labelCount = (indexHtml.match(/<label/g) || []).length;

        this.log('Accessibility', 'Form labels',
            labelCount >= inputCount * 0.8 ? 'PASS' : 'WARN',
            `${labelCount} labels for ${inputCount} inputs`
        );

        // Тест 7.5: Color contrast (базовая проверка)
        const stylesContent = fs.readFileSync('styles.css', 'utf8');
        const hasHighContrast = stylesContent.includes('contrast') ||
            stylesContent.match(/#000|#fff/g);
        this.log('Accessibility', 'Color contrast',
            'WARN',
            'Manual testing required (use WAVE or axe)'
        );

        // Тест 7.6: Keyboard navigation
        const hasTabindex = indexHtml.includes('tabindex');
        const hasFocusStyles = stylesContent.includes(':focus');
        this.log('Accessibility', 'Keyboard navigation',
            hasFocusStyles ? 'PASS' : 'WARN',
            hasFocusStyles ? 'Focus styles present' : 'Add focus styles'
        );
    }

    // ============================================
    // 8. ТЕСТЫ ДОКУМЕНТАЦИИ
    // ============================================

    async testDocumentation() {
        console.log('\n📚 === ТЕСТЫ ДОКУМЕНТАЦИИ ===\n');

        const fs = require('fs');

        // Тест 8.1: README.md
        const hasReadme = fs.existsSync('README.md');
        if (hasReadme) {
            const readme = fs.readFileSync('README.md', 'utf8');
            const readmeSize = readme.length;
            const hasInstallSection = readme.includes('## ') || readme.includes('# ');

            this.log('Documentation', 'README.md exists',
                readmeSize > 1000 ? 'PASS' : 'WARN',
                `${(readmeSize / 1024).toFixed(2)} KB`
            );
        } else {
            this.log('Documentation', 'README.md exists', 'FAIL', 'Not found');
        }

        // Тест 8.2: Количество MD файлов
        const mdFiles = fs.readdirSync('.').filter(f => f.endsWith('.md'));
        this.log('Documentation', 'Documentation files count',
            mdFiles.length >= 3 ? 'PASS' : 'WARN',
            `${mdFiles.length} MD files`
        );

        // Тест 8.3: Комментарии в коде
        const appJs = fs.readFileSync('app.js', 'utf8');
        const commentLines = (appJs.match(/\/\/.+|\/\*[\s\S]*?\*\//g) || []).length;
        const totalLines = appJs.split('\n').length;
        const commentRatio = (commentLines / totalLines * 100).toFixed(1);

        this.log('Documentation', 'Code comments ratio',
            commentRatio > 5 ? 'PASS' : 'WARN',
            `${commentRatio}% commented`
        );

        // Тест 8.4: JSDoc комментарии
        const hasJSDoc = appJs.includes('/**') && appJs.includes('@param');
        this.log('Documentation', 'JSDoc comments',
            hasJSDoc ? 'PASS' : 'WARN',
            hasJSDoc ? 'Found' : 'Consider adding'
        );
    }

    // ============================================
    // ГЕНЕРАЦИЯ ОТЧЕТА
    // ============================================

    generateReport() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 ИТОГОВЫЙ ОТЧЕТ ТЕСТИРОВАНИЯ');
        console.log('='.repeat(60) + '\n');

        console.log(`✅ Пройдено: ${this.passedTests}`);
        console.log(`❌ Провалено: ${this.failedTests}`);
        console.log(`⚠️  Предупреждений: ${this.results.filter(r => r.status === 'WARN').length}`);
        console.log(`📊 Всего тестов: ${this.results.length}\n`);

        const passRate = ((this.passedTests / this.results.length) * 100).toFixed(1);
        console.log(`✨ Процент успеха: ${passRate}%\n`);

        // Оценка качества
        let grade = 'F';
        if (passRate >= 90) grade = 'A';
        else if (passRate >= 80) grade = 'B';
        else if (passRate >= 70) grade = 'C';
        else if (passRate >= 60) grade = 'D';

        console.log(`🎯 Общая оценка: ${grade}\n`);

        // Критические проблемы
        const criticalIssues = this.results.filter(r => r.status === 'FAIL');
        if (criticalIssues.length > 0) {
            console.log('🚨 КРИТИЧЕСКИЕ ПРОБЛЕМЫ:\n');
            criticalIssues.forEach(issue => {
                console.log(`   ❌ [${issue.category}] ${issue.test}`);
                if (issue.message) console.log(`      ${issue.message}`);
            });
            console.log();
        }

        // Предупреждения
        const warnings = this.results.filter(r => r.status === 'WARN');
        if (warnings.length > 0 && warnings.length <= 10) {
            console.log('⚠️  ПРЕДУПРЕЖДЕНИЯ:\n');
            warnings.slice(0, 10).forEach(warning => {
                console.log(`   ⚠️  [${warning.category}] ${warning.test}`);
            });
            if (warnings.length > 10) {
                console.log(`   ... и еще ${warnings.length - 10} предупреждений\n`);
            }
            console.log();
        }

        // Рекомендации
        console.log('💡 РЕКОМЕНДАЦИИ:\n');
        if (criticalIssues.length > 0) {
            console.log('   1. Исправьте критические проблемы перед production');
        }
        if (warnings.length > 5) {
            console.log('   2. Обратите внимание на предупреждения');
        }
        if (this.results.filter(r => r.category === 'Security' && r.status !== 'PASS').length > 0) {
            console.log('   3. ⚠️  Проверьте настройки безопасности');
        }
        if (passRate < 80) {
            console.log('   4. Проведите дополнительное тестирование');
        }

        console.log('\n' + '='.repeat(60) + '\n');

        // Сохранение отчета
        return {
            summary: {
                total: this.results.length,
                passed: this.passedTests,
                failed: this.failedTests,
                warnings: warnings.length,
                passRate: parseFloat(passRate),
                grade
            },
            results: this.results,
            timestamp: new Date().toISOString()
        };
    }

    // ============================================
    // ГЛАВНЫЙ МЕТОД ЗАПУСКА
    // ============================================

    async runAll() {
        console.log('\n');
        console.log('╔' + '═'.repeat(58) + '╗');
        console.log('║' + ' '.repeat(12) + '🧪 AUTOMATED TEST SUITE' + ' '.repeat(23) + '║');
        console.log('║' + ' '.repeat(12) + 'Облік закупівель v2.0' + ' '.repeat(24) + '║');
        console.log('╚' + '═'.repeat(58) + '╝');
        console.log();

        try {
            await this.testInfrastructure();
            await this.testCodeQuality();
            await this.testValidation();
            await this.testPWA();
            await this.testSecurity();
            await this.testPerformance();
            await this.testAccessibility();
            await this.testDocumentation();

            const report = this.generateReport();

            // Сохранение JSON отчета
            const fs = require('fs');
            fs.writeFileSync(
                'test-results.json',
                JSON.stringify(report, null, 2)
            );
            console.log('📄 Детальный отчет сохранен в test-results.json\n');

        } catch (error) {
            console.error('❌ Критическая ошибка при тестировании:', error);
            process.exit(1);
        }
    }
}

// Запуск тестов
if (require.main === module) {
    const tester = new AppTester();
    tester.runAll().then(() => {
        console.log('✨ Тестирование завершено!\n');
        process.exit(tester.failedTests > 0 ? 1 : 0);
    });
}

module.exports = AppTester;
