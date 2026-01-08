export { };

declare global {
    interface Window {
        controllers: any;
        appState: any;
        toastManager: any;
        handleBackButton: () => void;
        switchTab: (tab: string) => void;
        startPurchase: () => void;
        startUnloading: () => void;
        openReceiptCamera: () => void;
        showReceiptScanScreen: () => void;
        processReceipt: () => void;
        retakeReceiptPhoto: () => void;
        generateDailyReport: () => void;
        clearHistory: () => void;
        setupPurchaseForm: () => void;
        handleFormSubmit: (event: Event) => void;
        updateTotalAmount: () => void;
        validateProductName: () => boolean;
        validateQuantity: () => boolean;
        validatePrice: () => boolean;
        validateLocation: () => boolean;
        addItemToPurchaseDraft: () => void;
        submitPurchaseDraft: () => void;
        submitDraft: () => void;
        openNewPurchaseDraft: () => void;
        showItemViewModal: (store: string, item: any) => void;
        hideItemViewModal: () => void;
        editDraftItem: (store: string, item: any) => void;
        downloadPdfFile: (blob: Blob, filename: string) => Promise<void>;
        showPdfPreviewModal: (data: any) => Promise<boolean>;
        refreshOperationsSummaryIfVisible: () => void;
        removePhoto: () => void;
        showPdfErrorModal: (error: any) => void;
        SkeletonLoader: any;
        AnimationManager: any;
        processPhotos: (files: FileList) => void;
        showHistory: () => void;
        addBatchItem: () => void;
        submitBatch: () => void;
        removeBatchItem: (index: number) => void;
        viewHistoryItem: (item: any) => void;
        editBatchItem: (index: number) => void;
        openManualEntry: () => void;
        closeModal: (id: string) => void;
    }

    const lucide: {
        createIcons: () => void;
    };
}
