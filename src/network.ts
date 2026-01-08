import { config } from './config.js';

interface ApiError extends Error {
    status?: number;
    body?: string;
    url?: string;
}

const FALLBACK_ERROR_SIGNATURES = [
    'webhook "POST deliverygb" is not registered',
    'webhook "POST receipt-scan" is not registered'
];

const sanitizeMalformedJson = (text: string): string => {
    let sanitized = text;
    sanitized = sanitized.replace(/"items"\s*:\s*,/g, '"items": [],');
    sanitized = sanitized.replace(/"recognizedItems"\s*:\s*,/g, '"recognizedItems": [],');
    return sanitized;
};

const parseJsonSafely = (text: string | null): any => {
    if (!text) return null;

    const trimmed = text.trim();
    if (!trimmed) return null;

    try {
        return JSON.parse(trimmed);
    } catch (error) {
        console.warn('Failed to parse JSON response:', error);
    }

    const sanitized = sanitizeMalformedJson(trimmed);
    if (sanitized !== trimmed) {
        try {
            return JSON.parse(sanitized);
        } catch (secondError) {
            console.warn('Failed to parse sanitized JSON response:', secondError);
        }
    }

    return trimmed;
};

const shouldRetryWithTestWebhook = (error: ApiError): boolean => {
    if (!error || error.status !== 404) return false;

    const body = error.body || '';
    if (!body) return true;

    try {
        const parsed = JSON.parse(body);
        const message = typeof parsed === 'string'
            ? parsed
            : [parsed?.message, parsed?.error, parsed?.body].filter(Boolean).join(' ');

        return FALLBACK_ERROR_SIGNATURES.some(signature => message.includes(signature))
            || message.includes('requested webhook');
    } catch (parseError) {
        return FALLBACK_ERROR_SIGNATURES.some(signature => body.includes(signature))
            || body.includes('requested webhook');
    }
};

const postJsonToWebhook = async (url: string, payload: any): Promise<any> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
            mode: 'cors'
        });

        const text = await response.text();
        clearTimeout(timeoutId);

        if (!response.ok) {
            const error = new Error(`HTTP ${response.status}`) as ApiError;
            error.status = response.status;
            error.body = text;
            error.url = url;
            throw error;
        }

        return parseJsonSafely(text);
    } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            const abortError = new Error('Request timed out') as ApiError;
            abortError.status = 408;
            throw abortError;
        }
        throw error;
    }
};

const postFormDataToWebhook = async (url: string, formData: FormData, timeout: number = 45000): Promise<any> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            method: 'POST',
            body: formData,
            signal: controller.signal,
            mode: 'cors'
        });

        const text = await response.text();
        clearTimeout(timeoutId);

        if (!response.ok) {
            const error = new Error(`HTTP ${response.status}`) as ApiError;
            error.status = response.status;
            error.body = text;
            error.url = url;
            throw error;
        }

        return parseJsonSafely(text);
    } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            const abortError = new Error('Request timed out') as ApiError;
            abortError.status = 408;
            throw abortError;
        }
        throw error;
    }
};

const sendFormDataWithFallback = async (formDataFactory: () => FormData, primaryUrl: string, fallbackUrl: string | null = null): Promise<{ payload: any, urlUsed: string }> => {
    const urlsToTry = [primaryUrl].filter(Boolean) as string[];
    if (fallbackUrl && fallbackUrl !== primaryUrl) {
        urlsToTry.push(fallbackUrl);
    }

    let lastError = null;
    for (let index = 0; index < urlsToTry.length; index += 1) {
        const url = urlsToTry[index];
        try {
            console.log('📡 Відправка чека на n8n вебхук:', url);
            const payload = await postFormDataToWebhook(url, formDataFactory());
            console.log('✅ Отримано відповідь від n8n вебхука:', url);
            return { payload, urlUsed: url };
        } catch (error: any) {
            lastError = error;
            const canRetry = index === 0 && fallbackUrl && fallbackUrl !== primaryUrl && (error.status === 404 || shouldRetryWithTestWebhook(error));
            if (!canRetry) break;
            console.warn('n8n вебхук недоступний, використовую резервний URL:', fallbackUrl, error);
        }
    }
    throw lastError;
};

const sendWithFallback = async (payload: any): Promise<any> => {
    const shouldAllowFallback = !config.isTestMode && config.N8N_WEBHOOK_URL !== config.testWebhookUrl;
    const urlsToTry = [config.N8N_WEBHOOK_URL];
    if (shouldAllowFallback && config.testWebhookUrl) {
        urlsToTry.push(config.testWebhookUrl);
    }

    let lastError = null;
    for (let index = 0; index < urlsToTry.length; index += 1) {
        const url = urlsToTry[index];
        if (!url) continue;
        try {
            if (index > 0) console.warn('Retrying with backup webhook URL:', url);
            return await postJsonToWebhook(url, payload);
        } catch (error: any) {
            lastError = error;
            const canRetry = index === 0 && shouldAllowFallback && shouldRetryWithTestWebhook(error);
            if (!canRetry) break;
        }
    }
    throw lastError;
};

export class SecureApiClient {
    static async sendPurchase(data: any): Promise<any> {
        const payload = { ...data };
        try {
            return await sendWithFallback(payload);
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    static async scanReceipt(imageFile: File, metadata: any = {}): Promise<{ payload: any, urlUsed: string }> {
        if (!imageFile) throw new Error('Не вибрано фото для розпізнавання');

        const primaryUrl = config.isTestMode ? config.receiptTestWebhookUrl : config.receiptProductionWebhookUrl;
        const fallbackUrl = config.isTestMode ? null : config.receiptTestWebhookUrl;

        const normalizedMetadata = {
            ...metadata,
            mode: config.isTestMode ? 'test' : 'production',
        };

        const formDataFactory = () => {
            const formData = new FormData();
            const fileName = imageFile.name || `receipt-${Date.now()}.jpg`;
            formData.append('file', imageFile, fileName);
            formData.append('metadata', JSON.stringify(normalizedMetadata));
            return formData;
        };

        try {
            return await sendFormDataWithFallback(formDataFactory, primaryUrl, fallbackUrl);
        } catch (error) {
            console.error('Receipt scan API error:', error);
            throw error;
        }
    }

    static async sendUnloadingBatch(storeName: string, items: any[]): Promise<any> {
        const totalAmount = items.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
        const payload = {
            type: 'Відвантаження',
            storeName,
            totalItems: items.length,
            totalAmount: Number(totalAmount.toFixed(2)),
            items: items.map(item => ({
                productName: item.productName,
                quantity: item.quantity,
                unit: item.unit,
                pricePerUnit: item.pricePerUnit,
                totalAmount: item.totalAmount,
                timestamp: item.timestamp,
                source: item.source || 'purchase',
                photo: item.photo || null,
                photoFilename: item.photoFilename || null
            })),
            createdAt: new Date().toISOString()
        };
        return await sendWithFallback(payload);
    }

    static async sendPurchaseBatch(locationName: string, items: any[]): Promise<any> {
        const totalAmount = items.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
        const payload = {
            type: 'Закупка',
            locationName,
            totalItems: items.length,
            totalAmount: Number(totalAmount.toFixed(2)),
            items: items.map(item => ({
                productName: item.productName,
                quantity: item.quantity,
                unit: item.unit,
                pricePerUnit: item.pricePerUnit,
                totalAmount: item.totalAmount,
                timestamp: item.timestamp,
                photo: item.photo || null,
                photoFilename: item.photoFilename || null
            })),
            createdAt: new Date().toISOString()
        };
        return await sendWithFallback(payload);
    }

    static async sendUnloadingBatchWithPDF(storeName: string, items: any[], pdfBlob: Blob): Promise<any> {
        if (!storeName || !Array.isArray(items) || items.length === 0) throw new Error('Неправильні дані для відправки');
        if (!pdfBlob || !(pdfBlob instanceof Blob)) throw new Error('PDF файл відсутній або невалідний');

        const webhookUrl = config.N8N_WEBHOOK_URL;
        if (!webhookUrl) throw new Error('URL вебхука не налаштовано');

        const pdfBase64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const res = reader.result as string;
                resolve(res.split(',')[1]);
            };
            reader.onerror = reject;
            reader.readAsDataURL(pdfBlob);
        });

        const totalAmount = items.reduce((sum, item) => sum + (Number(item.totalAmount) || 0), 0);
        const totalWeight = items.reduce((sum, item) => item.unit === 'kg' ? sum + (Number(item.quantity) || 0) : sum, 0);

        const now = new Date();
        const pdfFileName = `Відвантаження_${storeName}_${now.toISOString().replace(/[:.]/g, '-')}.pdf`;

        const payload = {
            type: 'Відвантаження',
            storeName,
            totalItems: items.length,
            totalAmount: Number(totalAmount.toFixed(2)),
            totalWeight: Number(totalWeight.toFixed(2)),
            items: items.map(item => ({
                productName: item.productName,
                quantity: Number(item.quantity),
                unit: item.unit,
                pricePerUnit: Number(item.pricePerUnit),
                totalAmount: Number(item.totalAmount),
                timestamp: item.timestamp
            })),
            submittedAt: now.toISOString(),
            pdfBase64,
            pdfFileName
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal,
                mode: 'cors'
            });
            clearTimeout(timeoutId);
            const text = await response.text();
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${text}`);
            return parseJsonSafely(text);
        } catch (error: any) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    static async generateAISummary(historyText: string): Promise<string> {
        if (!config.GEMINI_API_URL) throw new Error('AI API not configured');
        const prompt = `Проаналізуй звіти за день:\n\n${historyText}\n\nЗроби короткий підсумок українською.`;
        try {
            const response = await fetch(config.GEMINI_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });
            if (!response.ok) throw new Error('AI request failed');
            const data = await response.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Не вдалося згенерувати підсумок';
        } catch (error) {
            console.error('AI Summary error:', error);
            throw error;
        }
    }
}
