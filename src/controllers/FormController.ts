import { config } from '../config.js';
import { AppState, PurchaseDraftManager, DraftManager, InventoryManager, SecureStorageManager } from '../state.js';
import { ToastManager, AppUIAdapter } from '../ui.js';

export class FormController {
    private appState: AppState;
    private toastManager: ToastManager;
    private InputValidator: any;
    private PurchaseDraftManager: typeof PurchaseDraftManager;
    private DraftManager: typeof DraftManager;
    private InventoryManager: typeof InventoryManager;
    private SecureApiClient: any;
    private SecureStorageManager: typeof SecureStorageManager;

    constructor(
        appState: AppState,
        _appUI: AppUIAdapter,
        toastManager: ToastManager,
        InputValidator: any,
        purchaseDraftManager: typeof PurchaseDraftManager,
        draftManager: typeof DraftManager,
        inventoryManager: typeof InventoryManager,
        secureApiClient: any,
        _photoCompressor: any,
        _currencyFormatter: any,
        secureStorageManager: typeof SecureStorageManager
    ) {
        this.appState = appState;
        this.toastManager = toastManager;
        this.InputValidator = InputValidator;
        this.PurchaseDraftManager = purchaseDraftManager;
        this.DraftManager = draftManager;
        this.InventoryManager = inventoryManager;
        this.SecureApiClient = secureApiClient;
        this.SecureStorageManager = secureStorageManager;
    }

    showFieldError(fieldId: string, message: string) {
        const errorElement = document.getElementById(`${fieldId}-error`);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    }

    clearFieldError(fieldId: string) {
        const errorElement = document.getElementById(`${fieldId}-error`);
        if (errorElement) {
            errorElement.textContent = '';
            errorElement.style.display = 'none';
        }
    }

    validateProductName(): boolean {
        const element = document.getElementById('productName') as HTMLInputElement;
        const value = element ? element.value : '';
        if (!this.InputValidator.validateProductName(value)) {
            this.showFieldError('productName', 'Назва товару повинна містити від 2 до 100 символів');
            return false;
        }
        this.clearFieldError('productName');
        return true;
    }

    validateQuantity(): boolean {
        const element = document.getElementById('quantity') as HTMLInputElement;
        const value = element ? element.value : '';
        if (!this.InputValidator.validateQuantity(value)) {
            this.showFieldError('quantity', 'Кількість повинна бути більше 0 і не більше 10000');
            return false;
        }
        this.clearFieldError('quantity');
        return true;
    }

    validatePrice(): boolean {
        const element = document.getElementById('pricePerUnit') as HTMLInputElement;
        const value = element ? element.value.trim() : '';
        const isOptional = this.appState.isUnloading || this.appState.isDelivery;

        if (value === '') {
            if (isOptional) {
                this.clearFieldError('pricePerUnit');
                return true;
            }
            this.showFieldError('pricePerUnit', 'Ціна обов\'язкова для закупівлі');
            return false;
        }

        if (!this.InputValidator.validatePrice(value)) {
            this.showFieldError('pricePerUnit', 'Ціна повинна бути від 0 до 100000');
            return false;
        }

        this.clearFieldError('pricePerUnit');
        return true;
    }

    validateLocation(): boolean {
        const locationField = document.getElementById('location') as HTMLSelectElement;
        const customLocationField = document.getElementById('customLocation') as HTMLInputElement;
        if (!locationField) return false;
        const value = locationField.value;

        if (value === 'Інше') {
            this.clearFieldError('location');
            if (!customLocationField || !this.InputValidator.validateLocation(customLocationField.value)) {
                this.showFieldError('customLocation', 'Локація повинна містити від 2 до 100 символів');
                return false;
            }
            this.clearFieldError('customLocation');
            return true;
        }

        this.clearFieldError('customLocation');
        if (!this.InputValidator.validateLocation(value)) {
            this.showFieldError('location', 'Виберіть локацію');
            return false;
        }
        this.clearFieldError('location');
        return true;
    }

    updateTotalAmount() {
        const qEl = document.getElementById('quantity') as HTMLInputElement;
        const pEl = document.getElementById('pricePerUnit') as HTMLInputElement;
        const quantity = qEl ? parseFloat(qEl.value) || 0 : 0;
        const price = pEl ? parseFloat(pEl.value) || 0 : 0;
        const total = (quantity * price).toFixed(2);
        const totalElement = document.getElementById('totalAmount');
        if (totalElement) totalElement.textContent = `${total} ₴`;
    }

    setupPurchaseForm() {
        const form = document.getElementById('purchaseForm') as HTMLFormElement;
        form?.reset();
        if ((window as any).removePhoto) (window as any).removePhoto();

        ['productName', 'quantity', 'pricePerUnit', 'location', 'customLocation'].forEach(id => this.clearFieldError(id));

        const isUnloading = this.appState.isUnloading || this.appState.isDelivery;
        const priceGroup = document.getElementById('priceGroup');
        const totalGroup = document.getElementById('totalGroup');
        const locationLabel = document.getElementById('locationLabel');
        const locationSelect = document.getElementById('location') as HTMLSelectElement;

        this.populateDropdowns();

        if (priceGroup) priceGroup.style.display = isUnloading ? 'none' : 'block';
        if (totalGroup) totalGroup.style.display = isUnloading ? 'none' : 'block';

        if (locationLabel) {
            if (this.appState.isUnloading) locationLabel.textContent = 'Магазин (Куди відвантажуємо)';
            else if (this.appState.isDelivery) locationLabel.textContent = 'Локація доставки';
            else locationLabel.textContent = 'Ринок / Локація (Де купуємо)';
        }

        if (locationSelect && this.appState.selectedStore) {
            locationSelect.value = this.appState.selectedStore;
            if (this.appState.selectedStore !== 'Інше') {
                const customLocationGroup = document.getElementById('customLocationGroup');
                if (customLocationGroup) customLocationGroup.style.display = 'none';
            }
        }

        const saveButtonText = document.getElementById('saveButtonText');
        if (saveButtonText) {
            saveButtonText.textContent = this.appState.editingItemId ? 'Зберегти зміни' : (isUnloading ? 'Додати до відвантаження' : 'Зберегти закупку');
        }

        this.updateTotalAmount();
    }

    populateDropdowns() {
        // Populate Units
        const unitSelect = document.getElementById('unit') as HTMLSelectElement;
        if (unitSelect && unitSelect.options.length === 0) {
            config.units.forEach(u => {
                const option = document.createElement('option');
                option.value = u.value;
                option.textContent = u.label;
                unitSelect.appendChild(option);
            });
        }

        // Populate Products
        const productSuggestions = document.getElementById('productSuggestions');
        if (productSuggestions && productSuggestions.children.length === 0) {
            const allProducts = [...config.products, ...config.warehouseProducts];
            const uniqueProducts = Array.from(new Set(allProducts)).sort();

            uniqueProducts.forEach(prod => {
                const option = document.createElement('option');
                option.value = prod;
                productSuggestions.appendChild(option);
            });
        }

        // Populate Locations
        const locationSelect = document.getElementById('location') as HTMLSelectElement;
        if (locationSelect) {
            locationSelect.innerHTML = '';

            let locations: string[] = [];
            if (this.appState.isUnloading) {
                locations = config.unloadingLocations;
            } else if (this.appState.isDelivery) {
                locations = config.deliveryLocations;
            } else {
                locations = config.marketLocations;
            }

            // Додаємо опцію за замовчуванням
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'Оберіть...';
            defaultOption.disabled = true;
            defaultOption.selected = true;
            locationSelect.appendChild(defaultOption);

            locations.forEach(loc => {
                const option = document.createElement('option');
                option.value = loc;
                option.textContent = loc;
                locationSelect.appendChild(option);
            });

            // Відновлюємо вибір, якщо є редагування
            if (this.appState.selectedStore) {
                locationSelect.value = this.appState.selectedStore;
            }
        }
    }

    async handleFormSubmit(event: Event) {
        event.preventDefault();

        const isProdValid = this.validateProductName();
        const isQtyValid = this.validateQuantity();
        const isPriceValid = this.validatePrice();
        const isLocValid = this.validateLocation();

        if (!isProdValid || !isQtyValid || !isPriceValid || !isLocValid) {
            this.toastManager.show('Перевірте правильність заповнення форми', 'error');
            return;
        }

        const nameEl = document.getElementById('productName') as HTMLInputElement;
        const qEl = document.getElementById('quantity') as HTMLInputElement;
        const unitEl = document.getElementById('unit') as HTMLSelectElement;
        const pEl = document.getElementById('pricePerUnit') as HTMLInputElement;
        const locEl = document.getElementById('location') as HTMLSelectElement;
        const customLocEl = document.getElementById('customLocation') as HTMLInputElement;

        const productName = nameEl ? nameEl.value.trim() : '';
        const quantity = qEl ? parseFloat(qEl.value) : 0;
        const unit = unitEl ? unitEl.value : 'kg';
        const pricePerUnit = pEl ? parseFloat(pEl.value) || 0 : 0;
        const location = locEl ? locEl.value : '';
        const customLocation = customLocEl ? customLocEl.value.trim() : '';
        const finalLocation = location === 'Інше' ? customLocation : location;

        const itemData = {
            id: this.appState.editingItemId || crypto.randomUUID(),
            productName,
            quantity,
            unit,
            pricePerUnit,
            totalAmount: quantity * pricePerUnit,
            location: finalLocation,
            timestamp: new Date().toISOString(),
            type: this.appState.isUnloading ? 'Відвантаження' : (this.appState.isDelivery ? 'Доставка' : 'Закупка'),
            source: this.appState.isUnloading ? 'purchase' : 'manual'
        };

        if (this.appState.isUnloading) {
            await this.DraftManager.addItemToDraft(finalLocation, itemData);
            this.toastManager.show('Товар додано до відвантаження', 'success');
            if ((window as any).controllers?.unloading) await (window as any).controllers.unloading.showDraftView(finalLocation);
        } else if (!this.appState.isUnloading && !this.appState.isDelivery && this.appState.selectedStore) {
            await this.PurchaseDraftManager.addItemToDraft(finalLocation, itemData);
            this.toastManager.show('Товар додано до закупки', 'success');
            if ((window as any).controllers?.purchase) await (window as any).controllers.purchase.showPurchaseDraftView(finalLocation);
        } else {
            // Direct save for regular purchase/delivery if not using drafts
            await this.saveItemDirectly(itemData);
        }
    }

    async saveItemDirectly(itemData: any) {
        const saveButton = document.getElementById('saveButton') as HTMLButtonElement;
        if (!saveButton) return;

        const buttonIcon = saveButton.querySelector('.button-icon') as HTMLElement;
        const buttonSpinner = saveButton.querySelector('.button-spinner') as HTMLElement;

        saveButton.disabled = true;
        if (buttonIcon) buttonIcon.style.display = 'none';
        if (buttonSpinner) buttonSpinner.style.display = 'inline-block';

        try {
            await this.SecureStorageManager.addToHistory(itemData);
            if (itemData.type === 'Закупка') {
                await this.InventoryManager.addStock(itemData.productName, itemData.quantity, itemData.unit);
            }

            try {
                await this.SecureApiClient.sendPurchase(itemData);
            } catch (apiError) {
                console.warn('Server unavailable, saved locally:', apiError);
            }

            this.toastManager.show('Збережено', 'success');
            this.appState.setScreen('main');
            this.appState.setTab('history');
            if ((window as any).controllers?.history) await (window as any).controllers.history.updateHistoryDisplay();
        } catch (error) {
            console.error('Save error:', error);
            this.toastManager.show('Помилка збереження', 'error');
        } finally {
            saveButton.disabled = false;
            if (buttonIcon) buttonIcon.style.display = 'inline-block';
            if (buttonSpinner) buttonSpinner.style.display = 'none';
        }
    }
}
