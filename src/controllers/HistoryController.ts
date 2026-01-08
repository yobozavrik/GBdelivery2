export class HistoryController {
    constructor(appState, appUI, toastManager, SecureStorageManager, InventoryManager, SecureApiClient, SkeletonLoader, AnimationManager, currencyFormatter, config) {
        this.appState = appState;
        this.appUI = appUI;
        this.toastManager = toastManager;
        this.SecureStorageManager = SecureStorageManager;
        this.InventoryManager = InventoryManager;
        this.SecureApiClient = SecureApiClient;
        this.SkeletonLoader = SkeletonLoader;
        this.AnimationManager = AnimationManager;
        this.currencyFormatter = currencyFormatter;
        this.config = config;
    }

    async updateHistoryDisplay() {
        const container = document.getElementById('historyItems');
        const emptyState = document.getElementById('historyEmpty');
        const summary = document.getElementById('historySummary');

        if (!container || !emptyState || !summary) return;

        emptyState.style.display = 'none';
        this.SkeletonLoader.showHistorySkeleton(container, 10);
        summary.textContent = 'Завантаження...';

        const items = await this.SecureStorageManager.getHistoryItems();
        container.innerHTML = '';

        if (items.length === 0) {
            emptyState.style.display = 'block';
            summary.textContent = 'Немає записів';
            return;
        }

        emptyState.style.display = 'none';
        summary.textContent = `Всього записів: ${items.length}`;

        const fragment = document.createDocumentFragment();
        items.forEach(item => {
            const div = this.createHistoryItemElement(item);
            fragment.appendChild(div);
        });

        container.appendChild(fragment);
        this.AnimationManager.animateListItems(container);
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    createHistoryItemElement(item) {
        const div = document.createElement('div');
        div.className = 'history-item glassmorphism';

        const date = new Date(item.timestamp).toLocaleString('uk-UA', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
        });

        const unitLabel = this.config.units.find(u => u.value === item.unit)?.label || item.unit;

        const nameDiv = document.createElement('div');
        nameDiv.className = 'history-item-name';
        nameDiv.textContent = item.productName;

        const typeDiv = document.createElement('div');
        typeDiv.className = 'history-item-type';
        typeDiv.textContent = item.type;

        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'history-item-details';
        detailsDiv.textContent = `${item.quantity} ${unitLabel} • ${item.location} • ${this.currencyFormatter.format(item.totalAmount)}`;

        const dateDiv = document.createElement('div');
        dateDiv.className = 'history-item-date';
        dateDiv.textContent = date;

        div.appendChild(nameDiv);
        div.appendChild(typeDiv);
        div.appendChild(detailsDiv);
        div.appendChild(dateDiv);

        return div;
    }

    async generateDailyReport() {
        const modal = document.getElementById('aiSummaryModal');
        const content = document.getElementById('aiSummaryContent');
        const clearBtn = document.getElementById('clearHistoryBtn');

        if (!modal || !content || !clearBtn) return;

        modal.classList.add('visible');
        content.innerHTML = '<div class="loading-spinner"></div><p>Генеруємо звіт...</p>';
        clearBtn.style.display = 'none';

        try {
            const items = await this.SecureStorageManager.getHistoryItems();
            if (items.length === 0) {
                content.textContent = 'Немає операцій для аналізу';
                return;
            }

            const historyText = items.map(item =>
                `${item.type}: ${item.productName}, ${item.quantity} ${item.unit}, ${item.totalAmount}₴, ${item.location}`
            ).join('\n');

            const summary = await this.SecureApiClient.generateAISummary(historyText);
            content.textContent = summary;
            clearBtn.style.display = 'inline-block';
        } catch (error) {
            console.error('AI Summary error:', error);
            content.textContent = 'Не вдалося згенерувати звіт. AI API не налаштований або недоступний.';
        }
    }

    async clearHistory() {
        if (confirm('Ви впевнені? Історію буде видалено назавжди.')) {
            await this.SecureStorageManager.clearHistory();
            await this.InventoryManager.clearDailyStock();
            await this.updateHistoryDisplay();
            if (window.refreshOperationsSummaryIfVisible) window.refreshOperationsSummaryIfVisible();
            document.getElementById('aiSummaryModal')?.classList.remove('visible');
            this.toastManager.show('Історію та залишки очищено', 'success');
        }
    }
}
