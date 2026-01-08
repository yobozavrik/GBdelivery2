import { AppState } from '../state.ts';

export class NavigationController {
    private appState: AppState;
    private controllers: any;

    constructor(appState: AppState, controllers: any) {
        this.appState = appState;
        this.controllers = controllers;
    }

    async handleBackButton() {
        this.appState.editingItemId = null;

        const screen = this.appState.screen;
        const isUnloading = this.appState.isUnloading;
        const isDelivery = this.appState.isDelivery;
        const selectedStore = this.appState.selectedStore;

        if (screen === 'purchase-form' && isUnloading && selectedStore) {
            await this.controllers.unloading.showDraftView(selectedStore);
        } else if (screen === 'purchase-form' && !isUnloading && !isDelivery && selectedStore) {
            await this.controllers.purchase.showPurchaseDraftView(selectedStore);
        } else if (screen === 'draft-view' || screen === 'store-selection') {
            this.appState.setScreen('drafts-list');
            await this.controllers.unloading.showDraftsList();
        } else if (screen === 'purchase-draft-view' || screen === 'purchase-location-selection') {
            this.appState.setScreen('purchase-drafts-list');
            await this.controllers.purchase.showPurchaseDraftsList();
        } else if (screen === 'operations-summary') {
            this.appState.setScreen('main');
        } else if (screen === 'operations-detail') {
            this.appState.setScreen('operations-summary', { isUnloading: false, isDelivery: false, operationType: null });
            if ((window as any).renderOperationsSummary) await (window as any).renderOperationsSummary();
        } else {
            this.appState.setScreen('main');
        }
    }

    async switchTab(tab: string) {
        this.appState.setTab(tab);
        if (tab === 'history' && this.controllers.history) {
            await this.controllers.history.updateHistoryDisplay();
        }
    }
}
