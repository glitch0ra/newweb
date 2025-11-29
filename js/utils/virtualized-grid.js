/**
 * VirtualizedGrid - класс для виртуализации grid-контейнеров
 * Использует IntersectionObserver для рендеринга элементов только когда они попадают в viewport
 * 
 * @example
 * const grid = new VirtualizedGrid(container, items, {
 *   renderItem: (item, index) => `<div>${item}</div>`,
 *   columns: 6,
 *   itemHeight: 'auto'
 * });
 */
class VirtualizedGrid {
    /**
     * @param {HTMLElement} container - контейнер для grid
     * @param {Array} items - массив элементов для рендеринга
     * @param {Object} options - опции виртуализации
     * @param {Function} options.renderItem - функция для рендеринга одного элемента (item, index) => string
     * @param {number} options.columns - количество колонок в grid (по умолчанию 6)
     * @param {string} options.itemHeight - высота элемента (по умолчанию 'auto')
     * @param {string} options.itemClass - CSS класс для placeholder элементов (по умолчанию 'virtualized-item')
     * @param {Object} options.observerOptions - опции для IntersectionObserver (по умолчанию { rootMargin: '50px' })
     * @param {Function} options.onItemRendered - callback при рендеринге элемента (item, index, element)
     */
    constructor(container, items, options = {}) {
        this.container = container;
        this.items = items;
        this.options = {
            renderItem: options.renderItem || (() => ''),
            columns: options.columns || 6,
            itemHeight: options.itemHeight || 'auto',
            itemClass: options.itemClass || 'virtualized-item',
            observerOptions: options.observerOptions || { rootMargin: '50px' },
            onItemRendered: options.onItemRendered || null
        };
        
        this.renderedItems = new Set(); // Индексы уже отрендеренных элементов
        this.placeholders = []; // Массив placeholder элементов
        this.observer = null;
        this.isRendering = false; // Флаг для предотвращения многократного рендеринга (debounce)
        
        this.init();
    }

    /**
     * Инициализация виртуализации
     */
    init() {
        if (!this.container || !this.items || this.items.length === 0) {
            return;
        }

        // Создаем IntersectionObserver для отслеживания видимости элементов
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const index = parseInt(entry.target.dataset.index, 10);
                    if (!isNaN(index) && index >= 0 && !this.renderedItems.has(index)) {
                        this.renderItem(index);
                    }
                }
            });
        }, this.options.observerOptions);

        // Создаем placeholder элементы для всех items
        this.createPlaceholders();

        // IntersectionObserver сам определит видимые элементы при первом рендеринге
        // Не нужно вызывать renderVisibleItems(), так как это может вызвать forced reflow
    }

    /**
     * Создает placeholder элементы для всех items
     */
    createPlaceholders() {
        this.placeholders = [];
        
        this.items.forEach((item, index) => {
            const placeholder = document.createElement('div');
            placeholder.className = this.options.itemClass;
            placeholder.dataset.index = index;
            placeholder.dataset.rendered = 'false';
            
            // Устанавливаем высоту placeholder для сохранения layout
            if (this.options.itemHeight !== 'auto') {
                placeholder.style.height = this.options.itemHeight;
            } else {
                // Для auto высоты используем aspect-ratio или минимальную высоту
                placeholder.style.minHeight = '100px';
                placeholder.style.aspectRatio = '16/9';
            }
            
            // Добавляем placeholder в контейнер
            if (this.container && typeof this.container.appendChild === 'function') {
                this.container.appendChild(placeholder);
            }
            this.placeholders.push(placeholder);
            
            // Наблюдаем за placeholder
            if (this.observer && typeof this.observer.observe === 'function') {
                this.observer.observe(placeholder);
            }
        });
    }

    /**
     * Рендерит элемент по индексу
     * @param {number} index - индекс элемента
     */
    renderItem(index) {
        if (index < 0 || index >= this.items.length) {
            return;
        }

        // Проверяем, не идет ли уже рендеринг (debounce для предотвращения многократного рендеринга)
        if (this.isRendering || this.renderedItems.has(index)) {
            return; // Уже отрендерен или идет рендеринг
        }

        const item = this.items[index];
        const placeholder = this.placeholders[index];
        
        if (!placeholder) {
            return;
        }

        // Устанавливаем флаг рендеринга
        this.isRendering = true;

        // Используем requestAnimationFrame для debounce и предотвращения блокировки UI
        requestAnimationFrame(() => {
            try {
                // Рендерим элемент
                const renderedHTML = this.options.renderItem(item, index);
                
                // Заменяем placeholder на реальный контент
                placeholder.innerHTML = renderedHTML;
                placeholder.dataset.rendered = 'true';
                placeholder.style.minHeight = '';
                placeholder.style.aspectRatio = '';
                
                // Если была установлена фиксированная высота, убираем её
                if (this.options.itemHeight !== 'auto') {
                    placeholder.style.height = '';
                }
                
                this.renderedItems.add(index);

                // Вызываем callback если он есть
                if (this.options.onItemRendered) {
                    this.options.onItemRendered(item, index, placeholder);
                }

                // Отключаем наблюдение за элементом после рендеринга для предотвращения утечки памяти
                if (this.observer && placeholder && typeof this.observer.unobserve === 'function') {
                    this.observer.unobserve(placeholder);
                }
            } finally {
                // Сбрасываем флаг рендеринга в любом случае
                this.isRendering = false;
            }
        });
    }


    /**
     * Обновляет список элементов
     * @param {Array} newItems - новый массив элементов
     */
    updateItems(newItems) {
        this.cleanup();
        this.items = newItems;
        this.renderedItems.clear();
        this.placeholders = [];
        this.isRendering = false; // Сбрасываем флаг рендеринга
        this.init();
    }

    /**
     * Очищает виртуализацию и удаляет все обработчики
     */
    cleanup() {
        // Отключаем observer
        if (this.observer) {
            this.placeholders.forEach(placeholder => {
                if (placeholder && typeof this.observer.unobserve === 'function') {
                    this.observer.unobserve(placeholder);
                }
            });
            if (typeof this.observer.disconnect === 'function') {
                this.observer.disconnect();
            }
            this.observer = null;
        }

        // Очищаем контейнер
        if (this.container && typeof this.container.innerHTML !== 'undefined') {
            this.container.innerHTML = '';
        }

        // Очищаем данные
        this.renderedItems.clear();
        this.placeholders = [];
        
        // Сбрасываем флаг рендеринга
        this.isRendering = false;
    }
}

