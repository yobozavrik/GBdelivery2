/**
 * Оптимізована реалізація списків з pagination та virtual scrolling
 * A/B Test 2: List Optimization
 */

interface ListOptions {
    pageSize?: number;
    useVirtualScroll?: boolean;
    itemHeight?: number;
    [key: string]: any;
}

class OptimizedListRenderer {
    protected container: HTMLElement;
    protected options: Required<ListOptions>;
    protected data: any[];
    protected currentPage: number;
    protected totalPages: number;
    protected renderedItems: any[];
    protected scrollContainer: HTMLElement | null;

    constructor(container: HTMLElement, options: ListOptions = {}) {
        this.container = container;
        this.options = {
            pageSize: options.pageSize || 10,
            useVirtualScroll: options.useVirtualScroll !== undefined ? options.useVirtualScroll : true,
            itemHeight: options.itemHeight || 120,
            ...options
        } as Required<ListOptions>;

        this.data = [];
        this.currentPage = 1;
        this.totalPages = 1;
        this.renderedItems = [];
        this.scrollContainer = null;
    }

    /**
     * Встановлення даних для відображення
     */
    setData(data: any[]) {
        this.data = Array.isArray(data) ? data : [];
        this.totalPages = Math.ceil(this.data.length / this.options.pageSize);
        this.currentPage = 1;
        this.render();
    }

    /**
     * Рендеринг списку
     */
    render() {
        if (this.options.useVirtualScroll && this.data.length > 20) {
            this.renderVirtualScrolling();
        } else {
            this.renderPaginated();
        }
    }

    /**
     * Pagination реалізація
     */
    renderPaginated() {
        this.container.innerHTML = '';

        const startIndex = (this.currentPage - 1) * this.options.pageSize;
        const endIndex = Math.min(startIndex + this.options.pageSize, this.data.length);
        const itemsToRender = this.data.slice(startIndex, endIndex);

        const fragment = document.createDocumentFragment();

        itemsToRender.forEach((_item, index) => {
            const element = this.createItemElement(_item, startIndex + index);
            fragment.appendChild(element);
        });

        this.container.appendChild(fragment);

        // Pagination controls
        this.renderPaginationControls();
    }

    /**
     * Virtual scrolling реалізація
     */
    renderVirtualScrolling() {
        // TODO: Implement virtual scrolling for very large lists
        // For now, fall back to pagination
        this.renderPaginated();
    }

    createItemElement(_item: any, index: number): HTMLElement {
        // Це буде перевизначено в конкретних імплементаціях
        const div = document.createElement('div');
        div.className = 'optimized-list-item';
        div.textContent = `Item ${index}`;
        return div;
    }

    /**
     * Рендеринг контролів pagination
     */
    renderPaginationControls() {
        const parent = this.container.parentElement;
        if (!parent) return;

        const existingControls = parent.querySelector('.pagination-controls');
        if (existingControls) {
            existingControls.remove();
        }

        if (this.totalPages <= 1) {
            return;
        }

        const controls = document.createElement('div');
        controls.className = 'pagination-controls';

        const prevBtn = document.createElement('button');
        prevBtn.textContent = '← Назад';
        prevBtn.disabled = this.currentPage === 1;
        prevBtn.onclick = () => this.goToPage(this.currentPage - 1);
        controls.appendChild(prevBtn);

        const pageInfo = document.createElement('span');
        pageInfo.className = 'pagination-info';
        pageInfo.textContent = `Сторінка ${this.currentPage} з ${this.totalPages}`;
        controls.appendChild(pageInfo);

        const nextBtn = document.createElement('button');
        nextBtn.textContent = 'Далі →';
        nextBtn.disabled = this.currentPage === this.totalPages;
        nextBtn.onclick = () => this.goToPage(this.currentPage + 1);
        controls.appendChild(nextBtn);

        parent.appendChild(controls);
    }

    /**
     * Перехід на сторінку
     */
    goToPage(page: number) {
        if (page < 1 || page > this.totalPages) {
            return;
        }

        this.currentPage = page;
        this.render();

        // Track event
        if ((window as any).abTestManager && (window as any).abTestManager.isTestActive('list-optimization')) {
            (window as any).abTestManager.trackEvent('list-optimization', 'page-changed', { page });
        }
    }

    /**
     * Прокрутка до елемента
     */
    scrollToItem(index: number) {
        const element = this.container.children[index] as HTMLElement;
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}

/**
 * Оптимізований рендерер для чернеток відвантаження
 */
export class OptimizedDraftsRenderer extends OptimizedListRenderer {
    createItemElement(item: any, _index: number): HTMLElement {
        const card = document.createElement('div');
        card.className = 'draft-card glassmorphism optimized-item';

        const info = document.createElement('div');
        info.className = 'draft-card-info';

        const name = document.createElement('div');
        name.className = 'draft-card-store';
        name.textContent = item.storeName || item.locationName || 'Чернетка';

        const count = document.createElement('div');
        count.className = 'draft-card-count';
        const itemCount = item.itemCount || 0;
        count.textContent = `${itemCount} ${itemCount === 1 ? 'товар' : itemCount < 5 ? 'товари' : 'товарів'}`;

        info.appendChild(name);
        info.appendChild(count);

        const actions = document.createElement('div');
        actions.className = 'draft-card-actions';

        const viewBtn = document.createElement('button');
        viewBtn.className = 'btn-view';
        viewBtn.textContent = 'Переглянути';
        viewBtn.type = 'button';

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-delete';
        deleteBtn.textContent = 'Видалити';
        deleteBtn.type = 'button';

        actions.appendChild(viewBtn);
        actions.appendChild(deleteBtn);

        card.appendChild(info);
        card.appendChild(actions);

        if (item.onView) {
            card.onclick = (e) => {
                if (e.target !== deleteBtn) item.onView(e);
            };
            viewBtn.onclick = item.onView;
        }
        if (item.onDelete) deleteBtn.onclick = item.onDelete;

        return card;
    }
}

/**
 * Оптимізований рендерер для товарів у чернетці
 */
export class OptimizedDraftItemsRenderer extends OptimizedListRenderer {
    createItemElement(item: any, _index: number): HTMLElement {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'draft-item glassmorphism optimized-item';

        const info = document.createElement('div');
        info.className = 'draft-item-info';

        if (item.photo) {
            const photoPreview = document.createElement('img');
            photoPreview.className = 'draft-item-photo';
            photoPreview.src = item.photo;
            photoPreview.alt = 'Фото товару';
            photoPreview.loading = 'lazy';
            info.appendChild(photoPreview);
        }

        const textInfo = document.createElement('div');
        textInfo.className = 'draft-item-text-info';

        const name = document.createElement('div');
        name.className = 'draft-item-name';
        name.textContent = item.productName;

        const details = document.createElement('div');
        details.className = 'draft-item-details';
        const unitLabel = item.unitLabel || item.unit;
        details.textContent = `${item.quantity} ${unitLabel} • ${item.totalAmount.toFixed(2)} ₴`;

        textInfo.appendChild(name);
        textInfo.appendChild(details);
        info.appendChild(textInfo);

        const actions = document.createElement('div');
        actions.className = 'draft-item-actions';

        if (item.onView) {
            const viewBtn = document.createElement('button');
            viewBtn.className = 'draft-item-view';
            viewBtn.innerHTML = '<i data-lucide="eye"></i>';
            viewBtn.onclick = item.onView;
            actions.appendChild(viewBtn);
        }

        if (item.onEdit) {
            const editBtn = document.createElement('button');
            editBtn.className = 'draft-item-edit';
            editBtn.innerHTML = '<i data-lucide="edit"></i>';
            editBtn.onclick = item.onEdit;
            actions.appendChild(editBtn);
        }

        if (item.onDelete) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'draft-item-delete';
            deleteBtn.innerHTML = '<i data-lucide="trash-2"></i>';
            deleteBtn.onclick = item.onDelete;
            actions.appendChild(deleteBtn);
        }

        itemDiv.appendChild(info);
        itemDiv.appendChild(actions);

        return itemDiv;
    }
}

/**
 * Performance benchmark
 */
export class PerformanceBenchmark {
    private testName: string;
    private metrics: {
        renderStart: number | null;
        renderEnd: number | null;
        itemsCount: number;
        memoryUsage: number | null;
    };

    constructor(testName: string) {
        this.testName = testName;
        this.metrics = {
            renderStart: null,
            renderEnd: null,
            itemsCount: 0,
            memoryUsage: null
        };
    }

    start() {
        this.metrics.renderStart = performance.now();
        if ('memory' in (performance as any)) {
            this.metrics.memoryUsage = (performance as any).memory.usedJSHeapSize;
        }
    }

    end(itemsCount: number) {
        this.metrics.renderEnd = performance.now();
        this.metrics.itemsCount = itemsCount;

        const duration = (this.metrics.renderEnd || 0) - (this.metrics.renderStart || 0);
        const itemsPerSecond = (itemsCount / duration) * 1000;

        const result = {
            testName: this.testName,
            duration: Math.round(duration),
            itemsPerSecond: Math.round(itemsPerSecond),
            ...this.metrics
        };

        console.log('📊 Performance:', result);

        if ((window as any).abTestManager) {
            (window as any).abTestManager.trackEvent(this.testName, 'render-complete', result);
        }

        return result;
    }
}

export { OptimizedListRenderer };

