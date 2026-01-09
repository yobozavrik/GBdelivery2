import { config } from './config.js';

const FALLBACK_ERROR_SIGNATURES = [
    'webhook "POST deliverygb" is not registered',
    'webhook "POST receipt-scan" is not registered'
];

const sanitizeMalformedJson = (text) => {
    if (typeof text !== 'string') {
        return text;
    }

    let sanitized = text;

    sanitized = sanitized.replace(/"items"\s*:\s*,/g, '"items": [],');
    sanitized = sanitized.replace(/"recognizedItems"\s*:\s*,/g, '"recognizedItems": [],');

    return sanitized;
};

const parseJsonSafely = (text) => {
    if (!text) {
        return null;
    }

    if (typeof text !== 'string') {
        return text;
    }

    const trimmed = text.trim();

    if (!trimmed) {
        return null;
    }

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

const shouldRetryWithTestWebhook = (error) => {
    if (!error || error.status !== 404) {
        return false;
    }

    const body = typeof error.body === 'string' ? error.body : '';

    if (!body) {
        return true;
    }

    try {
        const parsed = JSON.parse(body);
        const message = typeof parsed === 'string'
            ? parsed
            : [parsed?.message, parsed?.error, parsed?.body]
                .filter(Boolean)
                .join(' ');

        return FALLBACK_ERROR_SIGNATURES.some(signature => message.includes(signature))
            || message.includes('requested webhook');
    } catch (parseError) {
        return FALLBACK_ERROR_SIGNATURES.some(signature => body.includes(signature))
            || body.includes('requested webhook');
    }
};

const postJsonToWebhook = async (url, payload) => {
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
            const error = new Error(`HTTP ${response.status}`);
            error.status = response.status;
            error.body = text;
            error.url = url;
            throw error;
        }

        return parseJsonSafely(text);
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            const abortError = new Error('Request timed out');
            abortError.status = 408;
            throw abortError;
        }
        throw error;
    }
};

const postFormDataToWebhook = async (url, formData, timeout = 45000) => {
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
            const error = new Error(`HTTP ${response.status}`);
            error.status = response.status;
            error.body = text;
            error.url = url;
            throw error;
        }

        return parseJsonSafely(text);
    } catch (error) {
        clearTimeout(timeoutId);

        if (error.name === 'AbortError') {
            const abortError = new Error('Request timed out');
            abortError.status = 408;
            throw abortError;
        }

        throw error;
    }
};

const sendFormDataWithFallback = async (formDataFactory, primaryUrl, fallbackUrl = null) => {
    const urlsToTry = [primaryUrl].filter(Boolean);

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
        } catch (error) {
            lastError = error;

            const canRetry = index === 0
                && fallbackUrl
                && fallbackUrl !== primaryUrl
                && (error.status === 404 || shouldRetryWithTestWebhook(error));

            if (!canRetry) {
                break;
            }

            console.warn('n8n вебхук недоступний, використовую резервний URL:', fallbackUrl, error);
        }
    }

    throw lastError;
};

const sendWithFallback = async (payload) => {
    const shouldAllowFallback = !config.isTestMode && config.N8N_WEBHOOK_URL !== config.testWebhookUrl;
    const urlsToTry = [config.N8N_WEBHOOK_URL];

    if (shouldAllowFallback) {
        urlsToTry.push(config.testWebhookUrl);
    }

    let lastError = null;

    for (let index = 0; index < urlsToTry.length; index += 1) {
        const url = urlsToTry[index];

        try {
            if (index > 0) {
                console.warn('Retrying with backup webhook URL:', url);
            }
            return await postJsonToWebhook(url, payload);
        } catch (error) {
            lastError = error;

            const canRetry = index === 0 && shouldAllowFallback && shouldRetryWithTestWebhook(error);
            if (!canRetry) {
                break;
            }
        }
    }

    throw lastError;
};

class SecureApiClient {
    static async sendPurchase(data) {
        // Photo is already Base64 encoded in the data object
        const payload = { ...data };

        try {
            return await sendWithFallback(payload);
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    static async scanReceipt(imageFile, metadata = {}) {
        if (!imageFile) {
            throw new Error('Не вибрано фото для розпізнавання');
        }

        const primaryUrl = config.isTestMode
            ? config.receiptTestWebhookUrl
            : config.receiptProductionWebhookUrl;

        const fallbackUrl = config.isTestMode
            ? null
            : config.receiptTestWebhookUrl;

        const normalizedMetadata = {
            ...metadata,
            mode: config.isTestMode ? 'test' : 'production',
        };

        const formDataFactory = () => {
            const formData = new FormData();
            const fileName = imageFile.name
                || `receipt-${Date.now()}.${(imageFile.type || 'image/jpeg').split('/')[1] || 'jpg'}`;

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

    static async sendUnloadingBatch(storeName, items) {
        const totalAmount = items.reduce((sum, item) => sum + item.totalAmount, 0);
        const totalItems = items.length;

        const payload = {
            type: 'Відвантаження',
            storeName,
            totalItems,
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

        try {
            return await sendWithFallback(payload);
        } catch (error) {
            console.error('Batch API Error:', error);
            throw error;
        }
    }

    static async sendPurchaseBatch(locationName, items) {
        const totalAmount = items.reduce((sum, item) => sum + item.totalAmount, 0);
        const totalItems = items.length;

        const payload = {
            type: 'Закупка',
            locationName,
            totalItems,
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

        try {
            return await sendWithFallback(payload);
        } catch (error) {
            console.error('Purchase Batch API Error:', error);
            throw error;
        }
    }

    static async sendUnloadingBatchWithPDF(storeName, items, pdfBlob) {
        if (!this.validateInput(storeName) || !Array.isArray(items) || items.length === 0) {
            throw new Error('Неправильні дані для відправки');
        }

        if (!pdfBlob || !(pdfBlob instanceof Blob)) {
            throw new Error('PDF файл відсутній або невалідний');
        }

        const webhookUrl = config.N8N_WEBHOOK_URL;
        if (!webhookUrl) {
            throw new Error('URL вебхука не налаштовано');
        }

        // Конвертируем PDF в base64
        const pdfBase64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result.split(',')[1]; // Убираем префикс data:...;base64,
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(pdfBlob);
        });

        const submittedAt = new Date();
        const totalAmount = items.reduce((sum, item) => sum + (Number(item.totalAmount) || 0), 0);
        const totalWeight = items.reduce((sum, item) => {
            if (item.unit === 'kg') {
                return sum + (Number(item.quantity) || 0);
            }
            return sum;
        }, 0);

        // Формат имени файла
        const day = String(submittedAt.getDate()).padStart(2, '0');
        const month = String(submittedAt.getMonth() + 1).padStart(2, '0');
        const year = submittedAt.getFullYear();
        const hours = String(submittedAt.getHours()).padStart(2, '0');
        const minutes = String(submittedAt.getMinutes()).padStart(2, '0');
        const pdfFileName = `Відвантаження_${storeName}_${day}-${month}-${year}_${hours}-${minutes}.pdf`;

        const payload = {
            type: 'Відвантаження',
            storeName,
            date: submittedAt.toLocaleDateString('uk-UA'),
            time: submittedAt.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }),
            totalItems: items.length,
            totalAmount: Number(totalAmount.toFixed(2)),
            totalWeight: Number(totalWeight.toFixed(2)),
            items: items.map(item => ({
                productName: item.productName,
                quantity: Number(item.quantity),
                unit: item.unit,
                source: item.source || 'purchase',
                pricePerUnit: Number(item.pricePerUnit),
                totalAmount: Number(item.totalAmount),
                timestamp: item.timestamp
            })),
            submittedAt: submittedAt.toISOString(),
            pdfBase64: pdfBase64,
            pdfFileName: pdfFileName
        };

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 секунд для PDF

            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal,
                mode: 'cors'
            });

            clearTimeout(timeoutId);

            const text = await response.text();

            if (!response.ok) {
                const error = new Error(`HTTP ${response.status}`);
                error.status = response.status;
                error.body = text;
                throw error;
            }

            return parseJsonSafely(text);
        } catch (error) {
            if (error.name === 'AbortError') {
                const abortError = new Error('Request timed out (PDF upload)');
                abortError.status = 408;
                throw abortError;
            }
            console.error('Batch with PDF API Error:', error);
            throw error;
        }
    }

    static async generateAISummary(historyText) {
        const url = config.isTestMode
            ? config.aiSummaryTestWebhookUrl
            : config.aiSummaryProductionWebhookUrl;

        if (!url) {
            throw new Error('AI API not configured');
        }

        const prompt = `Проаналізуй денний звіт закупівель та створи структурований підсумок українською мовою:\n\n${historyText}\n\nВключи: загальну суму витрат, кількість операцій, топ-3 товари, рекомендації.`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 секунд таймаут

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                mode: 'cors',
                body: JSON.stringify({
                    type: 'ai_summary',
                    prompt: prompt,
                    historyText: historyText,
                    timestamp: new Date().toISOString()
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`AI API request failed with status ${response.status}`);
            }

            const responseText = await response.text();

            if (!responseText || responseText.trim() === '') {
                throw new Error('AI API повернув порожню відповідь');
            }

            let result;
            try {
                result = JSON.parse(responseText);
            } catch (e) {
                // Якщо це не JSON, повертаємо як текст (n8n може повертати просто рядок)
                return responseText;
            }

            // result could be an object with a message/text field
            return (typeof result === 'object' && result !== null)
                ? (result.text || result.message || JSON.stringify(result))
                : result;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('AI Аналіз зайняв занадто багато часу (таймаут)');
            }
            console.error('AI Summary error:', error);
            throw error;
        }
    }
}

export { SecureApiClient };
