/**
 * PDF Generation Cache
 * Кешування шрифтів та оптимізація генерації PDF
 * A/B Test 5: PDF Optimization
 */

class PDFCacheManager {
    constructor() {
        this.cacheKey = 'pdf_font_cache_v1';
        this.cachedFontBytes = null;
        this.fallbackFontUrl = 'https://cdn.jsdelivr.net/npm/@fontsource/roboto@4.5.8/files/roboto-cyrillic-400-normal.woff';
    }

    /**
     * Завантажити шрифт (з кешу якщо можливо)
     */
    async loadFontBytes() {
        // Спробувати завантажити з кешу
        const cached = await this.getCachedFont();
        if (cached) {
            console.log('✅ Font loaded from cache');
            return cached;
        }

        // Завантажити з мережі
        console.log('📥 Loading font from network...');
        const fontBytes = await this.fetchFontFromNetwork();

        // Зберегти в кеш
        await this.cacheFont(fontBytes);

        return fontBytes;
    }

    /**
     * Отримати шрифт з IndexedDB кешу
     */
    async getCachedFont() {
        try {
            const data = await IndexedDBManager.get('cache', this.cacheKey);
            if (data && data.fontBytes) {
                this.cachedFontBytes = data.fontBytes;
                return new Uint8Array(data.fontBytes);
            }
        } catch (error) {
            console.warn('Failed to load cached font:', error);
        }
        return null;
    }

    /**
     * Завантажити шрифт з мережі
     */
    async fetchFontFromNetwork() {
        const response = await fetch(this.fallbackFontUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        return new Uint8Array(arrayBuffer);
    }

    /**
     * Зберегти шрифт в IndexedDB кеш
     */
    async cacheFont(fontBytes) {
        try {
            const data = {
                key: this.cacheKey,
                fontBytes: Array.from(fontBytes), // Convert to regular array for storage
                cachedAt: Date.now(),
                version: 1
            };

            await IndexedDBManager.put('cache', data);
            this.cachedFontBytes = fontBytes;
            
            console.log('✅ Font cached successfully');
        } catch (error) {
            console.error('Failed to cache font:', error);
        }
    }

    /**
     * Очистити кеш
     */
    async clearCache() {
        try {
            await IndexedDBManager.delete('cache', this.cacheKey);
            this.cachedFontBytes = null;
            console.log('🧹 Font cache cleared');
        } catch (error) {
            console.error('Failed to clear cache:', error);
        }
    }

    /**
     * Отримати статистику кешу
     */
    async getCacheStats() {
        try {
            const data = await IndexedDBManager.get('cache', this.cacheKey);
            if (!data) {
                return { cached: false };
            }

            const age = Date.now() - data.cachedAt;
            const sizeInMB = data.fontBytes ? (data.fontBytes.length / 1024 / 1024).toFixed(2) : 0;

            return {
                cached: true,
                version: data.version,
                ageInMs: age,
                ageInMinutes: Math.round(age / 60000),
                sizeInMB,
                cachedAt: new Date(data.cachedAt)
            };
        } catch (error) {
            console.error('Failed to get cache stats:', error);
            return { cached: false };
        }
    }
}

// Singleton instance
export const pdfCacheManager = new PDFCacheManager();

/**
 * Оптимізована генерація PDF (з кешуванням)
 */
export async function generatePDFOptimized(batchData, options = {}) {
    const startTime = performance.now();
    const useCaching = window.abTestManager?.getVariant('pdf-optimization') === 'variantB';

    console.log('📄 Starting PDF generation (optimized:', useCaching, ')');

    try {
        // Load font from cache if available
        let fontBytes;
        if (useCaching) {
            fontBytes = await pdfCacheManager.loadFontBytes();
        } else {
            // Load without cache (control variant)
            fontBytes = await pdfCacheManager.fetchFontFromNetwork();
        }

        const fontBytesLoadTime = performance.now() - startTime;
        console.log(`📥 Font loaded in ${Math.round(fontBytesLoadTime)}ms (cached: ${useCaching})`);

        // Continue with PDF generation using fontBytes
        // This is a placeholder - actual generation is in src/pdf.js
        const generationStartTime = performance.now();
        
        // Import and use the PDF generation function
        const { generateUnloadingReport } = await import('./pdf.js');
        const result = await generateUnloadingReport(batchData, options);
        
        const totalTime = performance.now() - startTime;
        const generationTime = performance.now() - generationStartTime;

        console.log('✅ PDF generated successfully');
        console.log(`⏱️ Total time: ${Math.round(totalTime)}ms`);
        console.log(`   - Font loading: ${Math.round(fontBytesLoadTime)}ms`);
        console.log(`   - Generation: ${Math.round(generationTime)}ms`);

        // Track performance metrics
        if (window.abTestManager) {
            window.abTestManager.trackEvent('pdf-optimization', 'pdf-generated', {
                totalTime: Math.round(totalTime),
                fontLoadTime: Math.round(fontBytesLoadTime),
                generationTime: Math.round(generationTime),
                sizeInKB: Math.round(result.blob.size / 1024),
                variant: useCaching ? 'cached' : 'no-cache'
            });
        }

        return result;
    } catch (error) {
        console.error('PDF generation failed:', error);
        
        if (window.abTestManager) {
            window.abTestManager.trackEvent('pdf-optimization', 'pdf-generation-failed', {
                error: error.message
            });
        }

        throw error;
    }
}

/**
 * Benchmark PDF generation performance
 */
export async function benchmarkPDFGeneration(batchData) {
    const iterations = 3;
    const results = [];

    console.log('🏁 Starting PDF generation benchmark...');

    for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        
        try {
            await generatePDFOptimized(batchData);
            const duration = performance.now() - startTime;
            results.push({ iteration: i + 1, duration: Math.round(duration) });
        } catch (error) {
            console.error(`Benchmark iteration ${i + 1} failed:`, error);
        }
    }

    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;

    console.log('📊 Benchmark results:');
    console.log(`   Average duration: ${Math.round(avgDuration)}ms`);
    console.log(results);

    return {
        iterations,
        averageDuration: Math.round(avgDuration),
        results
    };
}

