/**
 * PDF Generation Cache
 * Кешування шрифтів та оптимізація генерації PDF
 * A/B Test 5: PDF Optimization
 */

import { IndexedDBManager } from './state.js';

class PDFCacheManager {
    private cacheKey: string;
    private fallbackFontUrl: string;

    constructor() {
        this.cacheKey = 'pdf_font_cache_v1';
        this.fallbackFontUrl = 'https://cdn.jsdelivr.net/npm/@fontsource/roboto@4.5.8/files/roboto-cyrillic-400-normal.woff';
    }

    /**
     * Завантажити шрифт (з кешу якщо можливо)
     */
    async loadFontBytes(): Promise<Uint8Array> {
        const cached = await this.getCachedFont();
        if (cached) {
            console.log('✅ Font loaded from cache');
            return cached;
        }

        console.log('📥 Loading font from network...');
        const fontBytes = await this.fetchFontFromNetwork();
        await this.cacheFont(fontBytes);

        return fontBytes;
    }

    /**
     * Отримати шрифт з IndexedDB кешу
     */
    async getCachedFont(): Promise<Uint8Array | null> {
        try {
            const data = await IndexedDBManager.get('cache', this.cacheKey);
            if (data && data.fontBytes) {
                const uint8Array = new Uint8Array(data.fontBytes);
                return uint8Array;
            }
        } catch (error) {
            console.warn('Failed to load cached font:', error);
        }
        return null;
    }

    /**
     * Завантажити шрифт з мережі
     */
    async fetchFontFromNetwork(): Promise<Uint8Array> {
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
    async cacheFont(fontBytes: Uint8Array): Promise<void> {
        try {
            const data = {
                key: this.cacheKey,
                fontBytes: Array.from(fontBytes),
                cachedAt: Date.now(),
                version: 1
            };

            await IndexedDBManager.put('cache', data);

            console.log('✅ Font cached successfully');
        } catch (error) {
            console.error('Failed to cache font:', error);
        }
    }

    /**
     * Очистити кеш
     */
    async clearCache(): Promise<void> {
        try {
            await IndexedDBManager.delete('cache', this.cacheKey);
            console.log('🧹 Font cache cleared');
        } catch (error) {
            console.error('Failed to clear cache:', error);
        }
    }

    /**
     * Отримати статистику кешу
     */
    async getCacheStats(): Promise<{ cached: boolean; version?: number; ageInMs?: number; ageInMinutes?: number; sizeInMB?: string; cachedAt?: Date }> {
        try {
            const data = await IndexedDBManager.get('cache', this.cacheKey);
            if (!data) {
                return { cached: false };
            }

            const age = Date.now() - data.cachedAt;
            const sizeInMB = data.fontBytes ? (data.fontBytes.length / 1024 / 1024).toFixed(2) : '0';

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
export async function generatePDFOptimized(batchData: any, options: any = {}): Promise<any> {
    const startTime = performance.now();
    const abTestManager = (window as any).abTestManager;
    const useCaching = abTestManager?.getVariant('pdf-optimization') === 'variantB';

    console.log('📄 Starting PDF generation (optimized:', useCaching, ')');

    try {
        if (useCaching) {
            await pdfCacheManager.loadFontBytes();
        } else {
            await pdfCacheManager.fetchFontFromNetwork();
        }

        const fontBytesLoadTime = performance.now() - startTime;
        console.log(`📥 Font loaded in ${Math.round(fontBytesLoadTime)}ms (cached: ${useCaching})`);

        const generationStartTime = performance.now();
        const { generateUnloadingReport } = await import('./pdf.js');
        const result = await generateUnloadingReport(batchData, options);

        const totalTime = performance.now() - startTime;
        const generationTime = performance.now() - generationStartTime;

        console.log('✅ PDF generated successfully');

        if (abTestManager) {
            abTestManager.trackEvent('pdf-optimization', 'pdf-generated', {
                totalTime: Math.round(totalTime),
                fontLoadTime: Math.round(fontBytesLoadTime),
                generationTime: Math.round(generationTime),
                sizeInKB: Math.round(result.blob.size / 1024),
                variant: useCaching ? 'cached' : 'no-cache'
            });
        }

        return result;
    } catch (error: any) {
        console.error('PDF generation failed:', error);

        if (abTestManager) {
            abTestManager.trackEvent('pdf-optimization', 'pdf-generation-failed', {
                error: error.message
            });
        }

        throw error;
    }
}

/**
 * Benchmark PDF generation performance
 */
export async function benchmarkPDFGeneration(batchData: any): Promise<{ iterations: number; averageDuration: number; results: any[] }> {
    const iterations = 3;
    const results: any[] = [];

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

    const avgDuration = results.length > 0
        ? results.reduce((sum, r) => sum + r.duration, 0) / results.length
        : 0;

    return {
        iterations,
        averageDuration: Math.round(avgDuration),
        results
    };
}

