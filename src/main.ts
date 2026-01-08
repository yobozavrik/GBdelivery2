import { config } from './config.ts';
import { InputValidator } from './validation.ts';
import {
    AppState,
    SecureStorageManager,
    DraftManager,
    PurchaseDraftManager,
    InventoryManager,
    IndexedDBManager
} from './state.ts';
import { SecureApiClient } from './network.ts';
import {
    SkeletonLoader,
    AnimationManager,
    ToastManager,
    ThemeManager,
    AppUIAdapter,
    PhotoCompressor
} from './ui.ts';
import { initAllABTests, abTestManager } from './ab-testing.ts';

// Import Controllers
import { PurchaseController } from './controllers/PurchaseController.ts';
import { UnloadingController } from './controllers/UnloadingController.ts';
import { ReceiptController } from './controllers/ReceiptController.ts';
import { HistoryController } from './controllers/HistoryController.ts';
import { FormController } from './controllers/FormController.ts';
import { NavigationController } from './controllers/NavigationController.ts';

// Global Instances
const appUI = new AppUIAdapter();
const appState = new AppState(appUI);
const toastManager = new ToastManager();
const currencyFormatter = new Intl.NumberFormat('uk-UA', {
    style: 'currency', currency: 'UAH', minimumFractionDigits: 2, maximumFractionDigits: 2
});

// Initialize Controllers
interface AppControllers {
    purchase: any;
    unloading: any;
    receipt: any;
    history: any;
    form: any;
    navigation?: any;
}

const controllers: AppControllers = {
    purchase: new PurchaseController(appState, appUI, toastManager, abTestManager),
    unloading: new UnloadingController(appState, appUI, toastManager, abTestManager),
    receipt: new ReceiptController(appState, appUI, toastManager, abTestManager, InputValidator, SecureApiClient, PhotoCompressor),
    history: new HistoryController(appState, appUI, toastManager, SecureStorageManager, InventoryManager, SecureApiClient, SkeletonLoader, AnimationManager, currencyFormatter, config),
    form: new FormController(appState, appUI, toastManager, InputValidator, PurchaseDraftManager, DraftManager, InventoryManager, SecureApiClient, PhotoCompressor, currencyFormatter, SecureStorageManager),
};
controllers.navigation = new NavigationController(appState, controllers as any);

// Export instances and controllers globally for index.html handlers (Legacy Bridge)
window.controllers = controllers;
window.appState = appState;
window.toastManager = toastManager;

window.handleBackButton = () => controllers.navigation?.handleBackButton();
window.switchTab = (tab: string) => controllers.navigation?.switchTab(tab);
window.startPurchase = () => controllers.purchase.startPurchase();
window.startUnloading = () => controllers.unloading.startUnloading();
window.openReceiptCamera = () => controllers.receipt.openReceiptCamera();
window.processPhotos = (files: FileList) => controllers.receipt.processPhotos(files);
window.showHistory = () => controllers.history.showHistory();
window.clearHistory = () => controllers.history.clearHistory();
window.addBatchItem = () => controllers.form.addBatchItem();
window.submitBatch = () => controllers.form.submitBatch();
window.removeBatchItem = (index: number) => controllers.form.removeBatchItem(index);
window.viewHistoryItem = (item: any) => controllers.history.viewHistoryItem(item);
window.editBatchItem = (index: number) => controllers.form.editBatchItem(index);
window.openManualEntry = () => controllers.form.openManualEntry();
window.closeModal = (id: string) => {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('active');
};
window.generateDailyReport = () => controllers.history.generateDailyReport();
window.setupPurchaseForm = () => controllers.form.setupPurchaseForm();
window.handleFormSubmit = (event: Event) => controllers.form.handleFormSubmit(event);
window.updateTotalAmount = () => controllers.form.updateTotalAmount();
window.validateProductName = () => controllers.form.validateProductName();
window.validateQuantity = () => controllers.form.validateQuantity();
window.validatePrice = () => controllers.form.validatePrice();
window.validateLocation = () => controllers.form.validateLocation();
window.addItemToPurchaseDraft = () => controllers.purchase.addItemToPurchaseDraft();
window.submitPurchaseDraft = () => controllers.purchase.submitPurchaseDraft();
window.submitDraft = () => controllers.unloading.submitDraft();
window.openNewPurchaseDraft = () => controllers.purchase.startNewPurchaseDraft?.() || appState.setScreen('purchase-location-selection');
window.showItemViewModal = (store: string, item: any) => {
    appState.setCurrentViewedItem(store, item);
    const modal = document.getElementById('itemViewModal');
    if (!modal) return;
    const nameEl = document.getElementById('itemDetailName');
    const qtyEl = document.getElementById('itemDetailQuantity');
    const totalEl = document.getElementById('itemDetailTotal');
    if (nameEl) nameEl.textContent = item.productName;
    if (qtyEl) qtyEl.textContent = `${item.quantity} ${item.unit}`;
    if (totalEl) totalEl.textContent = `${item.totalAmount.toFixed(2)} ₴`;
    modal.classList.add('visible');
    if (typeof lucide !== 'undefined') lucide.createIcons();
};
window.hideItemViewModal = () => document.getElementById('itemViewModal')?.classList.remove('visible');
window.editDraftItem = (store: string, item: any) => {
    appState.editingItemId = item.id;
    appState.selectedStore = store;
    appState.setScreen('purchase-form');
    controllers.form.setupPurchaseForm();

    const prodNameInput = document.getElementById('productName') as HTMLInputElement;
    const qtyInput = document.getElementById('quantity') as HTMLInputElement;
    const unitInput = document.getElementById('unit') as HTMLSelectElement;
    const priceInput = document.getElementById('pricePerUnit') as HTMLInputElement;
    const locInput = document.getElementById('location') as HTMLSelectElement;

    if (prodNameInput) prodNameInput.value = item.productName || '';
    if (qtyInput) qtyInput.value = item.quantity || '';
    if (unitInput) unitInput.value = item.unit || 'шт';
    if (priceInput) priceInput.value = item.pricePerUnit || '';
    if (locInput) locInput.value = item.location || '';
    controllers.form.updateTotalAmount();
};

window.downloadPdfFile = async (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
};

window.showPdfPreviewModal = (data: any): Promise<boolean> => {
    return new Promise((resolve) => {
        const modal = document.getElementById('pdfPreviewModal');
        if (!modal) return resolve(false);

        const storeNameEl = document.getElementById('pdfStoreName');
        const itemsCountEl = document.getElementById('pdfItemsCount');
        const totalAmountEl = document.getElementById('pdfTotalAmount');

        if (storeNameEl) storeNameEl.textContent = data.storeName;
        if (itemsCountEl) itemsCountEl.textContent = `${data.items.length} позицій`;
        if (totalAmountEl) totalAmountEl.textContent = `${data.totalAmount.toFixed(2)} ₴`;

        const confirmBtn = document.getElementById('confirmPdfSubmitBtn') as HTMLButtonElement | null;
        const cancelBtn = document.getElementById('cancelPdfSubmitBtn') as HTMLButtonElement | null;

        const onConfirm = () => { modal.classList.remove('visible'); resolve(true); };
        const onCancel = () => { modal.classList.remove('visible'); resolve(false); };

        if (confirmBtn) confirmBtn.onclick = onConfirm;
        if (cancelBtn) cancelBtn.onclick = onCancel;
        modal.classList.add('visible');
    });
};

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
    await IndexedDBManager.init();
    ThemeManager.init();
    initAllABTests();

    // Initialize dates
    const now = new Date();
    const dayNames = ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П’ятниця', 'Субота'];
    const monthNames = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];

    const dayEl = document.getElementById('currentDay');
    const dateEl = document.getElementById('currentDate');
    if (dayEl) dayEl.textContent = dayNames[now.getDay()];
    if (dateEl) dateEl.textContent = `${now.getDate()} ${monthNames[now.getMonth()]}, ${now.getFullYear()}`;

    const opsSummaryDateEl = document.getElementById('operationsSummaryDate');
    if (opsSummaryDateEl) opsSummaryDateEl.textContent = now.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });

    // Set side summaries
    const historySummaryEl = document.getElementById('historySummary');
    if (historySummaryEl) historySummaryEl.textContent = 'Останні 50 операцій';
    const draftsListSummaryEl = document.getElementById('draftsListSummary');
    if (draftsListSummaryEl) draftsListSummaryEl.textContent = 'Список актуальних чернеток';

    // Attach Main Interaction Events
    document.getElementById('startPurchaseBtn')?.addEventListener('click', () => controllers.purchase.startPurchase());
    document.getElementById('startUnloadingBtn')?.addEventListener('click', () => controllers.unloading.startUnloading());
    document.getElementById('operationsSummaryBtn')?.addEventListener('click', () => {
        appState.setScreen('operations-summary');
        controllers.history.refreshOperationsSummary?.();
    });
    document.getElementById('endDayBtn')?.addEventListener('click', () => controllers.history.generateDailyReport());
    document.getElementById('newPurchaseDraftBtn')?.addEventListener('click', () => controllers.purchase.addItemToPurchaseDraft());
    document.getElementById('submitPurchaseDraftBtn')?.addEventListener('click', () => controllers.purchase.submitPurchaseDraft());
    document.getElementById('addItemToDraftBtn')?.addEventListener('click', () => controllers.unloading.addItemToDraft());
    document.getElementById('submitDraftBtn')?.addEventListener('click', () => controllers.unloading.submitDraft());

    // Mode toggle
    document.getElementById('modeToggle')?.addEventListener('click', () => {
        appState.isDelivery = !appState.isDelivery;
        const label = document.getElementById('modeToggleLabel');
        if (label) label.textContent = appState.isDelivery ? 'Режим доставки' : 'Робочий режим';
        document.getElementById('modeToggle')?.setAttribute('aria-pressed', appState.isDelivery.toString());
    });

    // Navigation Tabs
    document.querySelectorAll('.nav-button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tab = (e.currentTarget as HTMLElement).dataset.tab;
            if (tab) controllers.navigation.switchTab(tab);
        });
    });

    // Back Buttons (global listener if not already handled)
    document.getElementById('backButton')?.addEventListener('click', () => controllers.navigation.handleBackButton());

    // Form inputs
    document.getElementById('productName')?.addEventListener('input', () => controllers.form.validateProductName());
    document.getElementById('quantity')?.addEventListener('input', () => {
        controllers.form.validateQuantity();
        controllers.form.updateTotalAmount();
    });
    document.getElementById('pricePerUnit')?.addEventListener('input', () => {
        controllers.form.validatePrice();
        controllers.form.updateTotalAmount();
    });
    document.getElementById('location')?.addEventListener('change', (e: Event) => {
        const target = e.target as HTMLSelectElement;
        const customGroup = document.getElementById('customLocationGroup');
        if (customGroup) customGroup.style.display = target.value === 'Інше' ? 'block' : 'none';
        controllers.form.validateLocation();
    });

    // Set initial screen
    appState.setScreen('main');

    if (typeof (window as any).lucide !== 'undefined') (window as any).lucide.createIcons();
});

// App update notifier
window.addEventListener('app-updated', () => {
    toastManager.show('Доступна нова версія. Оновіть сторінку.', 'info');
});
