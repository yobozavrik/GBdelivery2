import { AppState, PurchaseDraftManager, SecureStorageManager, InventoryManager } from '../state.js';
import { ToastManager, AppUIAdapter, SkeletonLoader, AnimationManager } from '../ui.js';
import { ABTestManager } from '../ab-testing.js';
import { SecureApiClient } from '../network.js';

export class PurchaseController {
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

    async startPurchase() {
        this.appState.setScreen('purchase-drafts-list', { isUnloading: false, isDelivery: false });
        this.appState.selectedStore = null;
        await this.showPurchaseDraftsList();
    }

    async showPurchaseDraftsList() {
        const container = document.getElementById('purchaseDraftsList');
        const emptyState = document.getElementById('purchaseDraftsEmpty');
        const summary = document.getElementById('purchaseDraftsListSummary');

        if (!container || !emptyState || !summary) return;

        const variant = this.abTestManager.getVariant('list-optimization');
        const useOptimizedRender = variant === 'variantB';

        emptyState.style.display = 'none';
        SkeletonLoader.showDraftsSkeleton(container, 3);
        summary.textContent = 'Завантаження...';

        const drafts = await PurchaseDraftManager.getAllDraftsArray();

        this.abTestManager.trackEvent('list-optimization', 'purchase-list-rendered', {
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
                    storeName: draft.locationName,
                    onView: (e: Event) => {
                        e.stopPropagation();
                        this.showPurchaseDraftView(draft.locationName);
                    },
                    onDelete: (e: Event) => {
                        e.stopPropagation();
                        this.deletePurchaseDraft(draft.locationName);
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

        const locationName = document.createElement('div');
        locationName.className = 'draft-card-store';
        locationName.textContent = draft.locationName;

        const count = document.createElement('div');
        count.className = 'draft-card-count';
        count.textContent = `${draft.itemCount} ${draft.itemCount === 1 ? 'товар' : draft.itemCount < 5 ? 'товари' : 'товарів'}`;

        info.appendChild(locationName);
        info.appendChild(count);

        const actions = document.createElement('div');
        actions.className = 'draft-card-actions';

        const viewBtn = document.createElement('button');
        viewBtn.className = 'btn-view';
        viewBtn.textContent = 'Переглянути';
        viewBtn.type = 'button';
        viewBtn.onclick = (e) => {
            e.stopPropagation();
            this.showPurchaseDraftView(draft.locationName);
        };

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-delete';
        deleteBtn.textContent = 'Видалити';
        deleteBtn.type = 'button';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            this.deletePurchaseDraft(draft.locationName);
        };

        actions.appendChild(viewBtn);
        actions.appendChild(deleteBtn);

        card.appendChild(info);
        card.appendChild(actions);
        card.onclick = () => this.showPurchaseDraftView(draft.locationName);

        return card;
    }

    async showPurchaseDraftView(locationName: string) {
        this.appState.selectedStore = locationName;
        this.appState.setScreen('purchase-draft-view');

        const title = document.getElementById('purchaseDraftViewTitle');
        const summary = document.getElementById('purchaseDraftViewSummary');
        const container = document.getElementById('purchaseDraftItems');
        const emptyState = document.getElementById('purchaseDraftItemsEmpty');
        const submitBtn = document.getElementById('submitPurchaseDraftBtn') as HTMLButtonElement;
        const submitBtnText = document.getElementById('submitPurchaseDraftBtnText');

        if (!title || !summary || !container || !emptyState) return;

        title.textContent = locationName;

        emptyState.style.display = 'none';
        SkeletonLoader.showDraftItemsSkeleton(container, 5);
        summary.textContent = 'Завантаження...';

        const draft = await PurchaseDraftManager.getDraft(locationName);

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
            const itemDiv = this.createDraftItemElement(locationName, item);
            fragment.appendChild(itemDiv);
        });

        container.appendChild(fragment);
        AnimationManager.animateListItems(container);
        if (typeof (window as any).lucide !== 'undefined') (window as any).lucide.createIcons();
    }

    createDraftItemElement(locationName: string, item: any) {
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
            if ((window as any).showItemViewModal) (window as any).showItemViewModal(locationName, item);
        };

        const editBtn = document.createElement('button');
        editBtn.className = 'draft-item-edit';
        editBtn.type = 'button';
        editBtn.innerHTML = '<i data-lucide="edit"></i>';
        editBtn.onclick = (e) => {
            e.stopPropagation();
            if ((window as any).editDraftItem) (window as any).editDraftItem(locationName, item);
        };

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'draft-item-delete';
        deleteBtn.type = 'button';
        deleteBtn.innerHTML = '<i data-lucide="trash-2"></i>';
        deleteBtn.onclick = async (e) => {
            e.stopPropagation();
            await this.removeItemFromPurchaseDraft(locationName, item.id);
        };

        actions.appendChild(viewBtn);
        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);

        itemDiv.appendChild(info);
        itemDiv.appendChild(actions);

        return itemDiv;
    }

    async selectPurchaseLocation(locationName: string) {
        this.appState.selectedStore = locationName;

        if (locationName === 'Метро') {
            this.appState.setScreen('metro-method-selection');
            return;
        }

        const draft = await PurchaseDraftManager.getDraft(locationName);
        if (draft.items.length > 0) {
            await this.showPurchaseDraftView(locationName);
        } else {
            this.appState.setScreen('purchase-form');
            this.appState.isUnloading = false;
            this.appState.isDelivery = false;
            if ((window as any).setupPurchaseForm) (window as any).setupPurchaseForm();
        }
    }

    addItemToPurchaseDraft() {
        this.appState.setScreen('purchase-form');
        this.appState.isUnloading = false;
        this.appState.isDelivery = false;
        if ((window as any).setupPurchaseForm) (window as any).setupPurchaseForm();
    }

    async submitPurchaseDraft() {
        const locationName = this.appState.selectedStore;
        if (!locationName) return;

        const draft = await PurchaseDraftManager.getDraft(locationName);
        if (draft.items.length === 0) {
            this.toastManager.show('Чернетка порожня', 'error');
            return;
        }

        const submitBtn = document.getElementById('submitPurchaseDraftBtn') as HTMLButtonElement;
        const submitBtnText = document.getElementById('submitPurchaseDraftBtnText');

        if (!submitBtn) return;

        const originalText = submitBtnText?.textContent || 'Відправити всі';

        submitBtn.disabled = true;
        if (submitBtnText) submitBtnText.textContent = 'Відправка...';

        try {
            await SecureApiClient.sendPurchaseBatch(locationName, draft.items);

            for (const item of draft.items) {
                await SecureStorageManager.addToHistory(item);
                await InventoryManager.addStock(item.productName, item.quantity, item.unit);
            }

            if ((window as any).refreshOperationsSummaryIfVisible) (window as any).refreshOperationsSummaryIfVisible();

            this.toastManager.show(`Відправлено ${draft.items.length} товарів`, 'success');
            await PurchaseDraftManager.deleteDraft(locationName);

            this.appState.setScreen('purchase-drafts-list');
            await this.showPurchaseDraftsList();

        } catch (error) {
            console.error('Submit purchase draft error:', error);
            this.toastManager.show('Помилка відправки. Спробуйте ще раз.', 'error');
        } finally {
            submitBtn.disabled = false;
            if (submitBtnText) submitBtnText.textContent = originalText;
        }
    }

    async removeItemFromPurchaseDraft(locationName: string, itemId: string) {
        if (!confirm('Видалити товар з чернетки?')) return;
        await PurchaseDraftManager.removeItemFromDraft(locationName, itemId);
        this.toastManager.show('Товар видалено', 'success');

        const draft = await PurchaseDraftManager.getDraft(locationName);
        if (draft.items.length === 0) {
            this.appState.setScreen('purchase-drafts-list');
            await this.showPurchaseDraftsList();
        } else {
            await this.showPurchaseDraftView(locationName);
        }
    }

    async deletePurchaseDraft(locationName: string) {
        if (!confirm(`Видалити всю чернетку "${locationName}"?`)) return;
        await PurchaseDraftManager.deleteDraft(locationName);
        this.toastManager.show('Чернетку видалено', 'success');
        await this.showPurchaseDraftsList();
    }
}
