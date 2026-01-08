import { AppState, DraftManager, SecureStorageManager, InventoryManager } from '../state.js';
import { ToastManager, AppUIAdapter, SkeletonLoader, AnimationManager } from '../ui.js';
import { ABTestManager } from '../ab-testing.js';
import { SecureApiClient } from '../network.js';
import { config } from '../config.js';

export class UnloadingController {
    private appState: AppState;
    // private appUI: AppUIAdapter; // Unused
    private toastManager: ToastManager;
    private abTestManager: ABTestManager;

    constructor(appState: AppState, _appUI: AppUIAdapter, toastManager: ToastManager, abTestManager: ABTestManager) {
        this.appState = appState;
        // this.appUI = appUI;
        this.toastManager = toastManager;
        this.abTestManager = abTestManager;
    }

    async startUnloading() {
        this.appState.setScreen('drafts-list', { isUnloading: true, isDelivery: false });
        this.appState.selectedStore = null;
        await this.showDraftsList();
    }

    setupStoreSelection() {
        const grid = document.getElementById('storesGrid');
        if (!grid) return;

        grid.innerHTML = '';
        const stores = config.unloadingLocations.filter(loc => loc !== 'Інше');

        stores.forEach(store => {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'store-card glassmorphism';
            card.setAttribute('data-store', store);

            const icon = document.createElement('i');
            icon.setAttribute('data-lucide', 'store');
            icon.className = 'store-icon';

            const label = document.createElement('span');
            label.className = 'store-label';
            label.textContent = store;

            card.appendChild(icon);
            card.appendChild(label);
            card.onclick = async () => await this.selectStore(store);

            grid.appendChild(card);
        });

        if (typeof (window as any).lucide !== 'undefined') {
            (window as any).lucide.createIcons();
        }
    }

    async selectStore(storeName: string) {
        this.appState.selectedStore = storeName;
        const draft = await DraftManager.getDraft(storeName);

        if (draft.items.length > 0) {
            await this.showDraftView(storeName);
        } else {
            this.appState.setScreen('purchase-form');
            if ((window as any).setupPurchaseForm) (window as any).setupPurchaseForm();
        }
    }

    async showDraftsList() {
        const container = document.getElementById('draftsList');
        const emptyState = document.getElementById('draftsEmpty');
        const summary = document.getElementById('draftsListSummary');

        if (!container || !emptyState || !summary) return;

        const variant = this.abTestManager.getVariant('list-optimization');
        const useOptimizedRender = variant === 'variantB';

        emptyState.style.display = 'none';
        SkeletonLoader.showDraftsSkeleton(container, 3);
        summary.textContent = 'Завантаження...';

        const drafts = await DraftManager.getAllDraftsArray();

        this.abTestManager.trackEvent('list-optimization', 'list-rendered', {
            itemCount: drafts.length,
            variant,
            optimized: useOptimizedRender
        });

        if (drafts.length === 0) {
            emptyState.style.display = 'block';
            container.style.display = 'none';
            summary.textContent = 'Немає чернеток';
            return;
        }

        emptyState.style.display = 'none';
        container.style.display = 'flex';
        summary.textContent = `Всього чернеток: ${drafts.length}`;

        if (useOptimizedRender && drafts.length > 10) {
            try {
                const { OptimizedDraftsRenderer } = await import('../optimized-list.ts');
                const renderer = new OptimizedDraftsRenderer(container, { pageSize: 10 });

                const rendererData = drafts.map(draft => ({
                    ...draft,
                    onView: (e: Event) => {
                        e.stopPropagation();
                        this.showDraftView(draft.storeName);
                    },
                    onDelete: (e: Event) => {
                        e.stopPropagation();
                        this.deleteDraft(draft.storeName);
                    }
                }));

                renderer.setData(rendererData);
                return;
            } catch (error) {
                console.error('Failed to use optimized renderer, falling back:', error);
            }
        }

        container.innerHTML = '';
        const fragment = document.createDocumentFragment();

        drafts.forEach(draft => {
            const card = this.createDraftCard(draft);
            fragment.appendChild(card);
        });

        container.appendChild(fragment);
        AnimationManager.animateListItems(container);
        if (typeof (window as any).lucide !== 'undefined') {
            (window as any).lucide.createIcons();
        }
    }

    createDraftCard(draft: any) {
        const card = document.createElement('div');
        card.className = 'draft-card glassmorphism';

        const info = document.createElement('div');
        info.className = 'draft-card-info';

        const storeName = document.createElement('div');
        storeName.className = 'draft-card-store';
        storeName.textContent = draft.storeName;

        const count = document.createElement('div');
        count.className = 'draft-card-count';
        count.textContent = `${draft.itemCount} ${draft.itemCount === 1 ? 'товар' : draft.itemCount < 5 ? 'товари' : 'товарів'}`;

        info.appendChild(storeName);
        info.appendChild(count);

        const actions = document.createElement('div');
        actions.className = 'draft-card-actions';

        const viewBtn = document.createElement('button');
        viewBtn.className = 'btn-view';
        viewBtn.textContent = 'Переглянути';
        viewBtn.type = 'button';
        viewBtn.onclick = (e) => {
            e.stopPropagation();
            this.showDraftView(draft.storeName);
        };

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-delete';
        deleteBtn.textContent = 'Видалити';
        deleteBtn.type = 'button';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            this.deleteDraft(draft.storeName);
        };

        actions.appendChild(viewBtn);
        actions.appendChild(deleteBtn);

        card.appendChild(info);
        card.appendChild(actions);
        card.onclick = () => this.showDraftView(draft.storeName);

        return card;
    }

    async showDraftView(storeName: string) {
        this.appState.selectedStore = storeName;
        this.appState.setScreen('draft-view');

        const title = document.getElementById('draftViewTitle');
        const summary = document.getElementById('draftViewSummary');
        const container = document.getElementById('draftItems');
        const emptyState = document.getElementById('draftItemsEmpty');
        const submitBtn = document.getElementById('submitDraftBtn') as HTMLButtonElement;
        const submitBtnText = document.getElementById('submitDraftBtnText');

        if (!title || !summary || !container || !emptyState) return;

        title.textContent = storeName;

        emptyState.style.display = 'none';
        SkeletonLoader.showDraftItemsSkeleton(container, 5);
        summary.textContent = 'Завантаження...';

        const draft = await DraftManager.getDraft(storeName);

        const itemCount = draft.items.length;
        summary.textContent = `${itemCount} ${itemCount === 1 ? 'товар' : itemCount < 5 ? 'товари' : 'товарів'}`;

        if (submitBtnText) submitBtnText.textContent = `Відправити всі (${itemCount})`;
        if (submitBtn) submitBtn.disabled = itemCount === 0;

        container.innerHTML = '';

        if (itemCount === 0) {
            emptyState.style.display = 'block';
            container.style.display = 'none';
            return;
        }

        emptyState.style.display = 'none';
        container.style.display = 'flex';

        const fragment = document.createDocumentFragment();
        draft.items.forEach((item: any) => {
            const itemDiv = this.createDraftItemElement(storeName, item);
            fragment.appendChild(itemDiv);
        });

        container.appendChild(fragment);
        AnimationManager.animateListItems(container);
        if (typeof (window as any).lucide !== 'undefined') (window as any).lucide.createIcons();
    }

    createDraftItemElement(storeName: string, item: any) {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'draft-item glassmorphism';

        const info = document.createElement('div');
        info.className = 'draft-item-info';

        if (item.photo) {
            const photoPreview = document.createElement('img');
            photoPreview.className = 'draft-item-photo';
            photoPreview.src = item.photo;
            photoPreview.alt = 'Фото товару';
            info.appendChild(photoPreview);
        }

        const textInfo = document.createElement('div');
        textInfo.className = 'draft-item-text-info';

        const name = document.createElement('div');
        name.className = 'draft-item-name';
        name.textContent = item.productName;

        const unitLabel = item.unit; // Default
        const details = document.createElement('div');
        details.className = 'draft-item-details';
        details.textContent = `${item.quantity} ${unitLabel} • ${item.totalAmount.toFixed(2)} ₴`;

        textInfo.appendChild(name);
        textInfo.appendChild(details);
        info.appendChild(textInfo);

        const actions = document.createElement('div');
        actions.className = 'draft-item-actions';

        const viewBtn = document.createElement('button');
        viewBtn.className = 'draft-item-view';
        viewBtn.type = 'button';
        viewBtn.innerHTML = '<i data-lucide="eye"></i>';
        viewBtn.onclick = (e) => {
            e.stopPropagation();
            if ((window as any).showItemViewModal) (window as any).showItemViewModal(storeName, item);
        };

        const editBtn = document.createElement('button');
        editBtn.className = 'draft-item-edit';
        editBtn.type = 'button';
        editBtn.innerHTML = '<i data-lucide="edit"></i>';
        editBtn.onclick = (e) => {
            e.stopPropagation();
            if ((window as any).editDraftItem) (window as any).editDraftItem(storeName, item);
        };

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'draft-item-delete';
        deleteBtn.type = 'button';
        deleteBtn.innerHTML = '<i data-lucide="trash-2"></i>';
        deleteBtn.onclick = async (e) => {
            e.stopPropagation();
            await this.removeItemFromDraft(storeName, item.id);
        };

        actions.appendChild(viewBtn);
        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);

        itemDiv.appendChild(info);
        itemDiv.appendChild(actions);

        return itemDiv;
    }

    async submitDraft() {
        const storeName = this.appState.selectedStore;
        if (!storeName) return;

        const { generateUnloadingReport } = await import('../pdf.ts');

        const draft = await DraftManager.getDraft(storeName);
        if (draft.items.length === 0) {
            this.toastManager.show('Чернетка порожня', 'error');
            return;
        }

        const submitBtn = document.getElementById('submitDraftBtn') as HTMLButtonElement;
        const submitBtnText = document.getElementById('submitDraftBtnText');

        if (!submitBtn) return;

        const originalText = submitBtnText?.textContent || 'Відправити всі';

        submitBtn.disabled = true;
        if (submitBtnText) submitBtnText.textContent = 'Генеруємо звіт...';

        let pdfResult: any;
        try {
            const submissionTimestamp = new Date();
            const totalAmount = this.calculateTotalAmount(draft.items);
            const totalWeight = this.calculateTotalWeight(draft.items);

            const pdfData = {
                storeName,
                items: draft.items,
                submittedAt: submissionTimestamp,
                totalWeight,
                summary: `Відвантаження ${draft.items.length} позицій на суму ${totalAmount.toFixed(2)} ₴.`
            };

            const variant = this.abTestManager.getVariant('pdf-optimization');
            if (variant === 'variantB') {
                const { generatePDFOptimized } = await import('../pdf-cache.ts');
                pdfResult = await generatePDFOptimized(pdfData, { download: false });
            } else {
                pdfResult = await generateUnloadingReport(pdfData, { download: false });
            }

        } catch (pdfError) {
            console.error('PDF generation error:', pdfError);
            submitBtn.disabled = false;
            if (submitBtnText) submitBtnText.textContent = originalText;
            if ((window as any).showPdfErrorModal) (window as any).showPdfErrorModal(pdfError);
            return;
        }

        submitBtn.disabled = false;
        if (submitBtnText) submitBtnText.textContent = originalText;

        const now = new Date();
        const confirmed = await (window as any).showPdfPreviewModal({
            storeName,
            items: draft.items,
            date: now.toLocaleDateString('uk-UA'),
            time: now.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }),
            totalAmount: this.calculateTotalAmount(draft.items),
            totalWeight: this.calculateTotalWeight(draft.items),
            pdfBlob: pdfResult.blob
        });

        if (!confirmed) {
            this.toastManager.show('Відправку скасовано', 'info');
            return;
        }

        submitBtn.disabled = true;
        if (submitBtnText) submitBtnText.textContent = 'Відправляємо...';

        try {
            await SecureApiClient.sendUnloadingBatch(storeName, draft.items);

            for (const item of draft.items) {
                await SecureStorageManager.addToHistory(item);
                if (item.source === 'purchase') {
                    await InventoryManager.removeStock(item.productName, item.quantity, item.unit);
                }
            }

            if ((window as any).refreshOperationsSummaryIfVisible) (window as any).refreshOperationsSummaryIfVisible();
            await (window as any).downloadPdfFile(pdfResult.blob, pdfResult.fileName);
            await DraftManager.deleteDraft(storeName);

            this.toastManager.show(`Відправлено ${draft.items.length} товарів. PDF збережено`, 'success');

            this.appState.setScreen('drafts-list');
            await this.showDraftsList();

        } catch (serverError) {
            console.error('Server submit error:', serverError);
            await (window as any).downloadPdfFile(pdfResult.blob, pdfResult.fileName);
            this.toastManager.show('Помилка відправки. PDF збережено локально.', 'error');
        } finally {
            submitBtn.disabled = false;
            if (submitBtnText) submitBtnText.textContent = originalText;
        }
    }

    calculateTotalAmount(items: any[]): number {
        return items.reduce((sum, item) => sum + (Number(item.totalAmount) || 0), 0);
    }

    calculateTotalWeight(items: any[]): number {
        return items.reduce((sum, item) => {
            // Assume weight is in kg if unit is kg, else 0 for weight based count
            if (item.unit === 'кг' || item.unit === 'kg') {
                return sum + (Number(item.quantity) || 0);
            }
            return sum;
        }, 0);
    }

    async removeItemFromDraft(storeName: string, itemId: string) {
        if (!confirm('Видалити товар з чернетки?')) return;
        await DraftManager.removeItemFromDraft(storeName, itemId);
        this.toastManager.show('Товар видалено', 'success');

        const draft = await DraftManager.getDraft(storeName);
        if (draft.items.length === 0) {
            this.appState.setScreen('drafts-list');
            await this.showDraftsList();
        } else {
            await this.showDraftView(storeName);
        }
    }

    async deleteDraft(storeName: string) {
        if (!confirm(`Видалити всю чернетку "${storeName}"?`)) return;
        await DraftManager.deleteDraft(storeName);
        this.toastManager.show('Чернетку видалено', 'success');
        await this.showDraftsList();
    }
}
