export class FormController {
    constructor(appState, appUI, toastManager, InputValidator, PurchaseDraftManager, DraftManager, InventoryManager, SecureApiClient, PhotoCompressor, currencyFormatter) {
        this.appState = appState;
        this.appUI = appUI;
        this.toastManager = toastManager;
        this.InputValidator = InputValidator;
        this.PurchaseDraftManager = PurchaseDraftManager;
        this.DraftManager = DraftManager;
        this.InventoryManager = InventoryManager;
        this.SecureApiClient = SecureApiClient;
        this.PhotoCompressor = PhotoCompressor;
        this.currencyFormatter = currencyFormatter;
    }

    showFieldError(fieldId, message) {
        const errorElement = document.getElementById(`${fieldId}-error`);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    }

    clearFieldError(fieldId) {
        const errorElement = document.getElementById(`${fieldId}-error`);
        if (errorElement) {
            errorElement.textContent = '';
            errorElement.style.display = 'none';
        }
    }

    validateProductName() {
        const value = document.getElementById('productName').value;
        if (!this.InputValidator.validateProductName(value)) {
            this.showFieldError('productName', 'Назва товару повинна містити від 2 до 100 символів');
            return false;
        }
        this.clearFieldError('productName');
        return true;
    }

    validateQuantity() {
        const value = document.getElementById('quantity').value;
        if (!this.InputValidator.validateQuantity(value)) {
            this.showFieldError('quantity', 'Кількість повинна бути більше 0 і не більше 10000');
            return false;
        }
        this.clearFieldError('quantity');
        return true;
    }

    validatePrice() {
        const value = document.getElementById('pricePerUnit').value.trim();
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

    validateLocation() {
        const locationField = document.getElementById('location');
        const customLocationField = document.getElementById('customLocation');
        const value = locationField.value;

        if (value === 'Інше') {
            this.clearFieldError('location');
            if (!this.InputValidator.validateLocation(customLocationField.value)) {
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
        const quantity = parseFloat(document.getElementById('quantity').value) || 0;
        const price = parseFloat(document.getElementById('pricePerUnit').value) || 0;
        const total = (quantity * price).toFixed(2);
        const totalElement = document.getElementById('totalAmount');
        if (totalElement) totalElement.textContent = `${total} ₴`;
    }

    setupPurchaseForm() {
        document.getElementById('purchaseForm')?.reset();
        if (window.removePhoto) window.removePhoto();

        ['productName', 'quantity', 'pricePerUnit', 'location', 'customLocation'].forEach(id => this.clearFieldError(id));

        const isUnloading = this.appState.isUnloading || this.appState.isDelivery;
        const priceGroup = document.getElementById('priceGroup');
        const totalGroup = document.getElementById('totalGroup');
        const locationLabel = document.getElementById('locationLabel');
        const locationSelect = document.getElementById('location');

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
                document.getElementById('customLocationGroup').style.display = 'none';
            }
        }

        const saveButtonText = document.getElementById('saveButtonText');
        if (saveButtonText) {
            saveButtonText.textContent = this.appState.editingItemId ? 'Зберегти зміни' : (isUnloading ? 'Додати до відвантаження' : 'Зберегти закупку');
        }

        this.updateTotalAmount();
    }

    async handleFormSubmit(event) {
        event.preventDefault();

        const isProdValid = this.validateProductName();
        const isQtyValid = this.validateQuantity();
        const isPriceValid = this.validatePrice();
        const isLocValid = this.validateLocation();

        if (!isProdValid || !isQtyValid || !isPriceValid || !isLocValid) {
            this.toastManager.show('Перевірте правильність заповнення форми', 'error');
            return;
        }

        const productName = document.getElementById('productName').value.trim();
        const quantity = parseFloat(document.getElementById('quantity').value);
        const unit = document.getElementById('unit').value;
        const pricePerUnit = parseFloat(document.getElementById('pricePerUnit').value) || 0;
        const location = document.getElementById('location').value;
        const customLocation = document.getElementById('customLocation').value.trim();
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
            if (window.controllers?.unloading) await window.controllers.unloading.showDraftView(finalLocation);
        } else if (!this.appState.isUnloading && !this.appState.isDelivery && this.appState.selectedStore) {
            await this.PurchaseDraftManager.addItemToDraft(finalLocation, itemData);
            this.toastManager.show('Товар додано до закупки', 'success');
            if (window.controllers?.purchase) await window.controllers.purchase.showPurchaseDraftView(finalLocation);
        } else {
            // Direct save for regular purchase/delivery if not using drafts
            await this.saveItemDirectly(itemData);
        }
    }

    async saveItemDirectly(itemData) {
        const saveButton = document.getElementById('saveButton');
        if (!saveButton) return;

        const buttonIcon = saveButton.querySelector('.button-icon');
        const buttonSpinner = saveButton.querySelector('.button-spinner');

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
            if (window.controllers?.history) await window.controllers.history.updateHistoryDisplay();
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
