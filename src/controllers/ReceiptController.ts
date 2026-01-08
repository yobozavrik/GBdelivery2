import { AppState } from '../state.js';
import { ToastManager, AppUIAdapter, PhotoCompressor } from '../ui.js';
import { ABTestManager } from '../ab-testing.js';
import { SecureApiClient } from '../network.js';
import { InputValidator } from '../validation.js';

export class ReceiptController {
    private appState: AppState;
    // private appUI: AppUIAdapter; // Unused
    private toastManager: ToastManager;
    private abTestManager: ABTestManager;
    private InputValidator: typeof InputValidator;
    private SecureApiClient: typeof SecureApiClient;
    private PhotoCompressor: typeof PhotoCompressor;

    constructor(
        appState: AppState,
        _appUI: AppUIAdapter,
        toastManager: ToastManager,
        abTestManager: ABTestManager,
        inputValidator: typeof InputValidator,
        secureApiClient: typeof SecureApiClient,
        photoCompressor: typeof PhotoCompressor
    ) {
        this.appState = appState;
        // this.appUI = appUI;
        this.toastManager = toastManager;
        this.abTestManager = abTestManager;
        this.InputValidator = inputValidator;
        this.SecureApiClient = secureApiClient;
        this.PhotoCompressor = photoCompressor;
    }

    stopReceiptCameraStream() {
        if (this.appState.receiptCameraStream) {
            this.appState.receiptCameraStream.getTracks().forEach(track => track.stop());
            this.appState.setReceiptCameraStream(null);
        }

        const streamWrapper = document.getElementById('receiptCameraStreamWrapper');
        const video = document.getElementById('receiptCameraStream') as HTMLVideoElement;
        const openCameraBtn = document.getElementById('openCameraBtn');
        const placeholder = document.getElementById('receiptCameraPlaceholder');
        const preview = document.getElementById('receiptPreview');

        if (streamWrapper) streamWrapper.style.display = 'none';
        if (video) video.srcObject = null;
        if (openCameraBtn) {
            openCameraBtn.dataset.mode = 'stream';
            const label = openCameraBtn.querySelector('span');
            if (label) label.textContent = 'Зробити фото';
        }
        if (placeholder) {
            const previewVisible = preview && preview.style.display !== 'none';
            placeholder.style.display = previewVisible ? 'none' : 'flex';
        }
    }

    async openReceiptCamera() {
        const openCameraBtn = document.getElementById('openCameraBtn');
        const streamWrapper = document.getElementById('receiptCameraStreamWrapper');
        const video = document.getElementById('receiptCameraStream') as HTMLVideoElement;
        const placeholder = document.getElementById('receiptCameraPlaceholder');
        const preview = document.getElementById('receiptPreview');

        if (!openCameraBtn || !streamWrapper || !video) {
            this.toastManager.show('Камеру не знайдено. Оновіть сторінку та спробуйте знову', 'error');
            return;
        }

        if (!navigator.mediaDevices?.getUserMedia) {
            this.toastManager.show('Ваш пристрій не підтримує камеру або доступ заборонено', 'error');
            return;
        }

        const isCapturing = openCameraBtn.dataset.mode === 'capture';

        if (!isCapturing) {
            try {
                this.stopReceiptCameraStream();
                if (preview) preview.style.display = 'none';
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: { ideal: 'environment' }
                    }
                });

                this.appState.setReceiptCameraStream(stream);
                video.srcObject = stream;
                streamWrapper.style.display = 'block';
                await video.play().catch(() => { });

                openCameraBtn.dataset.mode = 'capture';
                const label = openCameraBtn.querySelector('span');
                if (label) label.textContent = 'Зробити знімок';
                if (placeholder) placeholder.style.display = 'none';
            } catch (error) {
                console.error('Receipt camera error:', error);
                this.toastManager.show('Не вдалося отримати доступ до камери', 'error');
            }
            return;
        }

        if (!video.videoWidth || !video.videoHeight) {
            this.toastManager.show('Камера ще не готова. Зачекайте та спробуйте знову', 'warning');
            return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');

        if (!context) {
            this.toastManager.show('Не вдалося обробити зображення з камери', 'error');
            this.stopReceiptCameraStream();
            return;
        }

        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        try {
            const blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob((result) => {
                    if (result) {
                        resolve(result);
                    } else {
                        reject(new Error('Не вдалося зберегти фото'));
                    }
                }, 'image/jpeg', 0.95);
            });

            const file = new File([blob], `receipt-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });
            this.appState.setReceiptPhoto(file, 'camera');
            this.applyReceiptPhotoFile(file);
        } catch (error) {
            console.error('Receipt capture error:', error);
            this.toastManager.show('Не вдалося зробити фото чека', 'error');
        } finally {
            this.stopReceiptCameraStream();
        }
    }

    showReceiptScanScreen() {
        this.stopReceiptCameraStream();
        this.appState.setScreen('receipt-scan');
        this.appState.setReceiptPhoto(null, null);

        const preview = document.getElementById('receiptPreview');
        const processBtn = document.getElementById('processReceiptBtn');
        const actions = document.getElementById('receiptCameraActions');
        const previewImage = document.getElementById('receiptPreviewImage') as HTMLImageElement;
        const placeholder = document.getElementById('receiptCameraPlaceholder');
        if (preview) preview.style.display = 'none';
        if (previewImage) previewImage.src = '';
        if (processBtn) processBtn.style.display = 'none';
        if (actions) actions.style.display = 'flex';
        if (placeholder) placeholder.style.display = 'flex';
    }

    applyReceiptPhotoFile(file: File) {
        if (!file) return false;

        if (!this.InputValidator.validateFile(file)) {
            this.toastManager.show('Файл занадто великий або непідтримуваний формат', 'error');
            return false;
        }

        this.appState.setReceiptPhoto(file, this.appState.receiptPhotoSource);

        const preview = document.getElementById('receiptPreview');
        const previewImage = document.getElementById('receiptPreviewImage') as HTMLImageElement;
        const processBtn = document.getElementById('processReceiptBtn');
        const actions = document.getElementById('receiptCameraActions');
        const placeholder = document.getElementById('receiptCameraPlaceholder');

        if (previewImage) {
            const previewUrl = URL.createObjectURL(file);
            previewImage.src = previewUrl;
            previewImage.onload = () => URL.revokeObjectURL(previewUrl);
        }

        if (preview) preview.style.display = 'block';
        if (processBtn) processBtn.style.display = 'block';
        if (actions) actions.style.display = 'flex';
        if (placeholder) placeholder.style.display = 'none';
        return true;
    }

    retakeReceiptPhoto() {
        this.appState.setReceiptPhoto(null, null);
        this.stopReceiptCameraStream();

        const preview = document.getElementById('receiptPreview');
        const processBtn = document.getElementById('processReceiptBtn');
        const actions = document.getElementById('receiptCameraActions');
        const placeholder = document.getElementById('receiptCameraPlaceholder');
        if (preview) preview.style.display = 'none';
        if (processBtn) processBtn.style.display = 'none';
        if (actions) actions.style.display = 'flex';
        if (placeholder) placeholder.style.display = 'flex';
    }

    async processReceipt() {
        const processBtn = document.getElementById('processReceiptBtn') as HTMLButtonElement;
        const scanningStatus = document.getElementById('scanningStatus');
        const receiptPreview = document.getElementById('receiptPreview');
        const statusText = scanningStatus ? scanningStatus.querySelector('p') : null;

        if (processBtn) processBtn.disabled = true;
        if (scanningStatus) scanningStatus.style.display = 'block';
        if (receiptPreview) receiptPreview.style.display = 'none';

        try {
            const originalFile = this.appState.receiptPhotoFile as File | null;
            if (!originalFile) {
                if (processBtn) processBtn.disabled = false;
                if (scanningStatus) scanningStatus.style.display = 'none';
                if (receiptPreview) receiptPreview.style.display = 'block';
                this.toastManager.show('Спочатку зробіть фото чека', 'error');
                return;
            }

            if (statusText) statusText.textContent = 'Оптимізація фото перед відправкою...';

            let fileToSend: File = originalFile;

            try {
                const compressedResult = await this.PhotoCompressor.compress(originalFile);

                if (compressedResult && compressedResult.size > 0 && compressedResult.size < originalFile.size) {
                    const originalName = originalFile.name || `receipt-${Date.now()}.jpg`;
                    const originalType = originalFile.type || 'image/jpeg';

                    const compressedFile = new File([compressedResult], originalName, {
                        type: compressedResult.type || originalType
                    });

                    fileToSend = compressedFile;
                }
            } catch (compressionError) {
                console.warn('Photo compression failed, using original file', compressionError);
            }

            if (statusText) statusText.textContent = 'AI аналізує чек...';

            const aiVariant = this.abTestManager.getVariant('ai-scan-optimization') || 'variantA';
            const metadata = {
                source: this.appState.receiptPhotoSource || 'unknown',
                originalFilename: originalFile.name || null,
                originalSize: originalFile.size,
                processedSize: fileToSend.size,
                capturedAt: new Date().toISOString(),
                devicePixelRatio: (window as any).devicePixelRatio,
                userAgent: navigator.userAgent,
                variant: aiVariant
            };

            const { payload, urlUsed } = await this.SecureApiClient.scanReceipt(fileToSend, metadata);

            let recognizedItems: any[] = [];
            const response = payload || {};
            const candidateArrays = [
                response.items,
                response.recognizedItems,
                response.data?.items,
                response.data?.recognizedItems,
                response.result?.items,
                response.result?.recognizedItems
            ];

            for (const candidate of candidateArrays) {
                if (Array.isArray(candidate) && candidate.length > 0) {
                    recognizedItems = candidate;
                    break;
                }
            }

            let normalizedItems = this.normalizeRecognizedReceiptItems(recognizedItems);

            if (!normalizedItems.length) {
                const rawText = response.rawText || response.fullText || response.ocrText || response.data?.rawText || response.result?.rawText || '';
                if (rawText) {
                    const parsedItems = this.parseMetroReceipt(rawText);
                    normalizedItems = this.normalizeRecognizedReceiptItems(parsedItems);
                }
            }

            if (normalizedItems.length) {
                this.appState.setRecognizedItems(normalizedItems);
                this.toastManager.show(`Розпізнано ${normalizedItems.length} товарів`, 'success');
                this.abTestManager.trackEvent('ai-scan-optimization', 'receipt-processed', {
                    variant: aiVariant,
                    itemCount: normalizedItems.length,
                    result: 'success',
                    source: metadata.source,
                    webhook: urlUsed
                });
            } else {
                this.appState.setRecognizedItems([]);
                this.toastManager.show('AI не зміг розпізнати товари. Спробуйте ще раз або додайте вручну.', 'warning');
                this.abTestManager.trackEvent('ai-scan-optimization', 'receipt-processed', {
                    variant: aiVariant,
                    itemCount: 0,
                    result: 'empty',
                    source: metadata.source,
                    webhook: urlUsed
                });
            }

            if ((window as any).showRecognizedItemsScreen) (window as any).showRecognizedItemsScreen();
        } catch (error: any) {
            console.error('Receipt scan error:', error);
            let errorMessage = 'Помилка розпізнавання чека';
            if (error?.status === 408 || error?.name === 'AbortError') {
                errorMessage = 'Час очікування вичерпано. Спробуйте ще раз.';
            } else if (error?.status === 413) {
                errorMessage = 'Фото занадто велике. Спробуйте зменшити розмір або якість.';
            } else if (error?.status === 404) {
                errorMessage = 'Сервіс розпізнавання тимчасово недоступний.';
            } else if (error?.message) {
                errorMessage = error.message;
            }
            this.toastManager.show(errorMessage, 'error');
            this.abTestManager.trackEvent('ai-scan-optimization', 'receipt-processed', {
                variant: this.abTestManager.getVariant('ai-scan-optimization') || 'variantA',
                itemCount: 0,
                result: 'error',
                source: this.appState.receiptPhotoSource || 'unknown',
                error: error?.message || 'unknown'
            });
        } finally {
            if (processBtn) processBtn.disabled = false;
            if (scanningStatus) scanningStatus.style.display = 'none';
            if (receiptPreview) receiptPreview.style.display = 'block';
        }
    }

    normalizeRecognizedReceiptItems(rawItems: any[]): any[] {
        if (!Array.isArray(rawItems)) return [];
        const now = new Date().toISOString();
        return rawItems.map((item) => {
            const sanitizedName = this.InputValidator.sanitizeString(item?.productName || '');
            let quantity = parseFloat(String(item?.quantity || '').replace(',', '.')) || 0;
            const lineTotal = parseFloat(String(item?.lineTotal ?? item?.totalAmount ?? '').replace(',', '.')) || 0;
            let pricePerUnit = parseFloat(String(item?.pricePerUnit || '').replace(',', '.')) || 0;

            if (pricePerUnit <= 0 && lineTotal > 0 && quantity > 0) {
                pricePerUnit = lineTotal / quantity;
            }

            let totalAmount = lineTotal > 0 ? lineTotal : pricePerUnit * quantity;

            if (!sanitizedName || sanitizedName.length < 2 || quantity <= 0) return null;

            return {
                id: (crypto as any).randomUUID ? (crypto as any).randomUUID() : Math.random().toString(36).substring(2),
                productName: sanitizedName,
                quantity: parseFloat(quantity.toFixed(3)),
                unit: this.InputValidator.sanitizeString(item?.unit || 'piece') || 'piece',
                pricePerUnit: parseFloat(pricePerUnit.toFixed(2)),
                totalAmount: parseFloat(totalAmount.toFixed(2)),
                location: 'Метро',
                timestamp: now,
                type: 'Закупка'
            };
        }).filter(Boolean);
    }

    parseMetroReceipt(rawText: string): any[] {
        const items: any[] = [];
        const lines = rawText.split('\n');
        const itemRegex = /^(?:[\d\s]+)?(.+?)\s+(\d+([.,]\d{1,3})?)\s*(?:шт|кг)\s*[*xх]\s*(\d+[.,]\d{2})\s+(\d+[.,]\d{2})$/i;
        const simplerRegex = /^(?:[\d\s]+)?(.+?)\s+(\d+([.,]\d{1,3})?)\s+(?:\d+([.,]\d{1,3})?)\s*(\d+[.,]\d{2})\s+(\d+[.,]\d{2})$/i;

        for (const line of lines) {
            const trimmedLine = line.trim();
            const match = trimmedLine.match(itemRegex) || trimmedLine.match(simplerRegex);
            if (match) {
                try {
                    const productName = match[1].trim().replace(/-\s*$/, '').trim();
                    if (productName.length < 3) continue;
                    const quantity = parseFloat(match[2].replace(',', '.'));
                    const pricePerUnit = parseFloat((match[4] || match[5]).replace(',', '.'));
                    if (quantity > 0 && pricePerUnit > 0) {
                        items.push({
                            productName,
                            quantity,
                            pricePerUnit,
                            unit: trimmedLine.toLowerCase().includes('кг') ? 'kg' : 'piece',
                        });
                    }
                } catch (e) {
                    console.warn('Could not parse line:', line, e);
                }
            }
        }
        return items;
    }
}
