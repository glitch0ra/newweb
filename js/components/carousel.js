class Carousel {
    constructor(container, options = {}) {
        this.container = container;
        const config = window.APP_CONFIG?.CAROUSEL || {};
        this.options = {
            itemsPerView: options.itemsPerView || 1,
            loop: options.loop !== false,
            draggable: options.draggable !== false,
            ...options
        };

        this.currentIndex = 0;
        this.items = [];
        this.isDragging = false;
        this.startX = 0;
        this.currentX = 0;
        this.offset = 0;
        this.resizeTimeout = null;
        this.handlers = {};
        this.containerOffsetLeft = 0; // Кэш для offsetLeft, чтобы избежать forced reflow
        this.cachedItemWidth = null; // Кэш для itemWidth, чтобы избежать forced reflow при drag
        this.cachedItemMargin = null; // Кэш для marginRight, чтобы избежать forced reflow
        this.cachedContainerWidth = null; // Кэш для container.offsetWidth, чтобы избежать forced reflow
        this.touchStartTime = 0; // Время начала touch для определения клика
        this.touchStartY = 0; // Y координата для проверки вертикального свайпа
        this.lastSwipeTime = 0; // Время последнего свайпа для debounce
        this.isTouching = false; // Флаг для отслеживания активного touch
        this.imageLoadHandlers = []; // Массив для хранения обработчиков загрузки изображений

        this.init();
    }

    init() {
        if (!this.container) return;

        const carouselContainer = this.container.querySelector('.carousel-container');
        if (!carouselContainer) return;

        this.items = Array.from(carouselContainer.children);
        this.totalItems = this.items.length;

        if (this.totalItems === 0) return;

        // Добавляем accessibility атрибуты
        this.container.setAttribute('role', 'region');
        this.container.setAttribute('aria-roledescription', 'carousel');
        this.container.setAttribute('aria-label', 'Image carousel');
        carouselContainer.setAttribute('role', 'group');
        // Убрали aria-live с carouselContainer - используем централизованный #live-region

        // Создаем элемент для индикации текущего слайда (для screen readers)
        // НЕ используем aria-live здесь - используем централизованный #live-region через announceToScreenReader
        this.statusElement = document.createElement('div');
        this.statusElement.className = 'sr-only';
        // Убрали aria-live - используем централизованный #live-region
        this.statusElement.id = `carousel-status-${Date.now()}-${Math.random()}`;
        this.container.appendChild(this.statusElement);

        // Анонсируем начальный слайд для screen readers
        this.updateStatus();

        // Create navigation
        this.createNavigation();

        // Setup drag
        if (this.options.draggable) {
            this.setupDrag();
        }

        // Setup touch
        this.setupTouch();

        // Wait for images to load before calculating sizes
        const images = carouselContainer.querySelectorAll('img');
        if (images.length > 0) {
            let loadedCount = 0;
            const totalImages = images.length;

            images.forEach(img => {
                if (img.complete) {
                    loadedCount++;
                } else {
                    // Создаем обработчик с проверкой на существование container
                    const loadHandler = () => {
                        // Проверяем, что carousel еще не был уничтожен
                        if (!this.container) return;
                        
                        loadedCount++;
                        if (loadedCount === totalImages) {
                            // Проверяем еще раз перед обновлением
                            if (!this.container) return;
                            
                            // Обновляем кэш размеров после загрузки всех изображений
                            this.cacheContainerWidth();
                            this.cacheItemWidth();
                            this.update();
                        }
                    };
                    
                    img.addEventListener('load', loadHandler);
                    // Сохраняем ссылку на обработчик и изображение для последующего удаления
                    this.imageLoadHandlers.push({ element: img, handler: loadHandler });
                }
            });

            if (loadedCount === totalImages) {
                // Обновляем кэш размеров после загрузки всех изображений
                this.cacheContainerWidth();
                this.cacheItemWidth();
                this.update();
            }
        } else {
            // Кэшируем размеры контейнера и элементов при инициализации
            this.cacheContainerWidth();
            this.cacheItemWidth();
            this.update();
        }
        
        // Update on resize
        const resizeHandler = () => {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = setTimeout(() => {
                // Сбрасываем кэш при resize, чтобы пересчитать размеры
                this.cachedItemWidth = null;
                this.cachedItemMargin = null;
                this.cachedContainerWidth = null;
                // Пересчитываем размеры контейнера и элементов
                this.cacheContainerWidth();
                this.cacheItemWidth();
                this.update();
            }, window.APP_CONFIG?.CAROUSEL?.RESIZE_DEBOUNCE_DELAY || 100);
        };
        window.addEventListener('resize', resizeHandler);
        this.handlers.resize = { element: window, handler: resizeHandler };
    }

    createNavigation() {
        const prevBtn = document.createElement('button');
        prevBtn.className = 'carousel-nav prev';
        prevBtn.setAttribute('aria-label', 'Previous slide');
        prevBtn.setAttribute('type', 'button');
        const prevHandler = () => this.prev();
        prevBtn.addEventListener('click', prevHandler);
        this.handlers.prevBtn = prevBtn;
        this.handlers.prevHandler = prevHandler;

        const nextBtn = document.createElement('button');
        nextBtn.className = 'carousel-nav next';
        nextBtn.setAttribute('aria-label', 'Next slide');
        nextBtn.setAttribute('type', 'button');
        const nextHandler = () => this.next();
        nextBtn.addEventListener('click', nextHandler);
        this.handlers.nextBtn = nextBtn;
        this.handlers.nextHandler = nextHandler;

        // Check if there's a wrapper (for collections or history)
        const wrapper = this.container.parentElement;
        if (wrapper && (wrapper.classList.contains('collection-carousel-wrapper') || wrapper.classList.contains('history-carousel-wrapper'))) {
            wrapper.insertBefore(prevBtn, this.container);
            wrapper.appendChild(nextBtn);
            this.handlers.wrapper = wrapper;
        } else {
            this.container.appendChild(prevBtn);
            this.container.appendChild(nextBtn);
        }
    }

    setupDrag() {
        const mousedownHandler = (e) => {
            this.isDragging = true;
            // Кэшируем offsetLeft один раз при начале drag, чтобы избежать forced reflow при каждом движении мыши
            const rect = this.container.getBoundingClientRect();
            this.containerOffsetLeft = rect.left + window.scrollX;
            this.startX = e.pageX - this.containerOffsetLeft;
            this.currentX = this.startX;
            
            // Кэшируем itemWidth при начале drag, чтобы избежать forced reflow в updateTransform
            this.cacheItemWidth();
            
            this.container.style.cursor = 'grabbing';
        };

        const mousemoveHandler = (e) => {
            if (!this.isDragging) return;
            e.preventDefault();
            // Используем кэшированное значение вместо this.container.offsetLeft
            // Это предотвращает forced reflow при каждом движении мыши
            this.currentX = e.pageX - this.containerOffsetLeft;
            this.offset = this.currentX - this.startX;
            this.updateTransform();
        };

        const mouseupHandler = () => {
            if (!this.isDragging) return;
            this.isDragging = false;
            this.container.style.cursor = '';

            const threshold = window.APP_CONFIG?.CAROUSEL?.DRAG_THRESHOLD || 50;
            if (Math.abs(this.offset) > threshold) {
                if (this.offset > 0) {
                    this.prev();
                } else {
                    this.next();
                }
            }
            this.offset = 0;
            this.update();
        };

        this.container.addEventListener('mousedown', mousedownHandler);
        document.addEventListener('mousemove', mousemoveHandler);
        document.addEventListener('mouseup', mouseupHandler);

        this.handlers.mousedown = { element: this.container, handler: mousedownHandler };
        this.handlers.mousemove = { element: document, handler: mousemoveHandler };
        this.handlers.mouseup = { element: document, handler: mouseupHandler };
    }

    setupTouch() {
        let touchStartX = 0;
        let touchEndX = 0;
        let touchStartY = 0;
        let touchEndY = 0;
        let touchMoved = false; // Флаг для отслеживания движения во время touch

        const touchstartHandler = (e) => {
            const touch = e.changedTouches[0];
            touchStartX = touch.screenX;
            touchStartY = touch.screenY;
            this.touchStartTime = Date.now();
            this.touchStartY = touch.screenY;
            this.isTouching = true;
            touchMoved = false;
        };

        const touchmoveHandler = (e) => {
            if (!this.isTouching) return;
            const touch = e.changedTouches[0];
            const deltaX = Math.abs(touch.screenX - touchStartX);
            const deltaY = Math.abs(touch.screenY - touchStartY);
            
            // Если движение больше по вертикали, чем по горизонтали, это не свайп
            // Также отмечаем, что было движение
            const touchMoveThreshold = window.APP_CONFIG?.CAROUSEL?.CLICK_DISTANCE_THRESHOLD || 10;
            if (deltaY > deltaX || deltaX > touchMoveThreshold) {
                touchMoved = true;
            }
        };

        const touchendHandler = (e) => {
            if (!this.isTouching) return;
            
            const touch = e.changedTouches[0];
            touchEndX = touch.screenX;
            touchEndY = touch.screenY;
            
            const touchDuration = Date.now() - this.touchStartTime;
            const diffX = touchStartX - touchEndX;
            const diffY = Math.abs(touchStartY - touchEndY);
            const distance = Math.abs(diffX);
            
            // Проверяем, был ли это клик (малое расстояние и короткое время)
            const clickThreshold = window.APP_CONFIG?.CAROUSEL?.CLICK_DISTANCE_THRESHOLD || 10;
            const clickDuration = window.APP_CONFIG?.CAROUSEL?.CLICK_DURATION_THRESHOLD || 300;
            const isClick = distance < clickThreshold && touchDuration < clickDuration;
            
            // Проверяем, был ли это вертикальный свайп (больше движения по Y, чем по X)
            const isVerticalSwipe = diffY > Math.abs(diffX);
            
            // Debounce: предотвращаем множественные срабатывания при быстром свайпе
            const timeSinceLastSwipe = Date.now() - this.lastSwipeTime;
            const minSwipeInterval = window.APP_CONFIG?.CAROUSEL?.MIN_SWIPE_INTERVAL || 300;
            const swipeDistanceThreshold = window.APP_CONFIG?.CAROUSEL?.DRAG_THRESHOLD || 50;
            
            // Если это не клик, не вертикальный свайп, было движение, и прошло достаточно времени
            if (!isClick && !isVerticalSwipe && touchMoved && distance > swipeDistanceThreshold && timeSinceLastSwipe > minSwipeInterval) {
                this.lastSwipeTime = Date.now();
                if (diffX > 0) {
                    this.next();
                } else {
                    this.prev();
                }
            }
            
            this.isTouching = false;
            touchMoved = false;
        };

        const touchcancelHandler = () => {
            this.isTouching = false;
            touchMoved = false;
        };

        this.container.addEventListener('touchstart', touchstartHandler, { passive: true });
        this.container.addEventListener('touchmove', touchmoveHandler, { passive: true });
        this.container.addEventListener('touchend', touchendHandler, { passive: true });
        this.container.addEventListener('touchcancel', touchcancelHandler, { passive: true });

        this.handlers.touchstart = { element: this.container, handler: touchstartHandler };
        this.handlers.touchmove = { element: this.container, handler: touchmoveHandler };
        this.handlers.touchend = { element: this.container, handler: touchendHandler };
        this.handlers.touchcancel = { element: this.container, handler: touchcancelHandler };
    }

    /**
     * Кэширует ширину контейнера для избежания forced reflow
     * Вызывается при инициализации и при resize
     */
    cacheContainerWidth() {
        if (!this.container) {
            this.cachedContainerWidth = null;
            return;
        }
        // Читаем размер только здесь, не во время drag/animation
        this.cachedContainerWidth = this.container.offsetWidth;
    }

    /**
     * Кэширует margin для collection-image-card элементов
     * Использует CSS Custom Property для избежания forced reflow
     * @param {HTMLElement} firstItem - первый элемент для получения margin
     */
    cacheItemMargin(firstItem) {
        if (!firstItem || this.cachedItemMargin !== null) {
            return;
        }

        // Чтение CSS Custom Property не вызывает forced reflow
        const marginValue = getComputedStyle(firstItem).getPropertyValue('--item-margin').trim();
        if (marginValue) {
            // Парсим значение (может быть в px, rem, em)
            // getPropertyValue возвращает вычисленное значение
            const match = marginValue.match(/^([\d.]+)(px|rem|em)$/);
            if (match) {
                const value = parseFloat(match[1]);
                const unit = match[2];
                // Конвертируем в px: 1rem = 16px, 1em = 16px (обычно)
                this.cachedItemMargin = unit === 'px' ? value : value * 16;
            } else {
                // Fallback: читаем marginRight (вызывает reflow, но только один раз)
                this.cachedItemMargin = parseFloat(getComputedStyle(firstItem).marginRight) || 0;
            }
        } else {
            // Fallback: читаем marginRight (вызывает reflow, но только один раз)
            this.cachedItemMargin = parseFloat(getComputedStyle(firstItem).marginRight) || 0;
        }
    }

    /**
     * Кэширует itemWidth для использования в updateTransform
     * Вызывается при начале drag и при resize
     */
    cacheItemWidth() {
        if (this.items.length === 0) {
            this.cachedItemWidth = null;
            return;
        }

        const firstItem = this.items[0];
        if (!firstItem) {
            this.cachedItemWidth = null;
            return;
        }

        if (firstItem.classList.contains('history-image')) {
            this.cachedItemWidth = window.APP_CONFIG?.CAROUSEL?.FIXED_ITEM_WIDTH || 252;
        } else if (firstItem.classList.contains('collection-image-card')) {
            // Fixed width for collection images (252px) + margin
            // Кэшируем margin только один раз при инициализации
            this.cacheItemMargin(firstItem);
            this.cachedItemWidth = (window.APP_CONFIG?.CAROUSEL?.FIXED_ITEM_WIDTH || 252) + this.cachedItemMargin;
        } else {
            // Для динамических размеров используем кэшированную ширину контейнера
            // Если кэш не установлен, устанавливаем его (не должно происходить во время drag)
            if (this.cachedContainerWidth === null) {
                this.cacheContainerWidth();
            }
            if (this.cachedContainerWidth !== null) {
                this.cachedItemWidth = this.cachedContainerWidth / this.options.itemsPerView;
            } else {
                this.cachedItemWidth = null;
            }
        }
    }

    updateTransform() {
        // Проверяем, что container еще существует (не был уничтожен)
        if (!this.container) return;
        
        const carouselContainer = this.container.querySelector('.carousel-container');
        if (!carouselContainer) return;

        if (this.items.length === 0) return;

        // Используем ТОЛЬКО кэшированное значение itemWidth, чтобы избежать forced reflow
        // Кэш должен быть установлен при инициализации или начале drag
        const itemWidth = this.cachedItemWidth;
        if (itemWidth === null) {
            // Если кэш не установлен, устанавливаем его (не должно происходить во время drag)
            // Но это fallback на случай ошибки
            this.cacheItemWidth();
            // Используем кэш после установки
            if (this.cachedItemWidth === null) {
                return; // Не можем обновить без размера
            }
        }

        const translateX = -(this.currentIndex * this.cachedItemWidth) + this.offset;
        carouselContainer.style.transform = `translateX(${translateX}px)`;
        carouselContainer.style.transition = 'none';
    }

    /**
     * Обновляет индикацию текущего слайда для screen readers
     * Включает информацию о текущем элементе (title, alt и т.д.)
     */
    updateStatus() {
        if (this.totalItems === 0) return;
        
        const currentSlide = this.currentIndex + 1;
        const currentItem = this.items[this.currentIndex];
        
        // Извлекаем информацию о текущем элементе
        let itemInfo = '';
        if (currentItem) {
            // Пытаемся получить title из различных источников
            const title = currentItem.getAttribute('title') || 
                        currentItem.getAttribute('data-title') ||
                        currentItem.querySelector('[data-title]')?.getAttribute('data-title');
            
            // Пытаемся получить alt из изображения
            const img = currentItem.querySelector('img');
            const alt = img ? img.getAttribute('alt') : null;
            
            // Пытаемся получить текст из overlay (для collection-image-card)
            const overlay = currentItem.querySelector('.image-title-overlay');
            const overlayText = overlay ? overlay.textContent.trim() : null;
            
            // Используем title, overlayText, alt или aria-label (в порядке приоритета)
            itemInfo = title || overlayText || alt || currentItem.getAttribute('aria-label') || '';
        }
        
        // Формируем сообщение для screen reader
        let message = `Slide ${currentSlide} of ${this.totalItems}`;
        if (itemInfo) {
            message = `${message}, ${itemInfo}`;
        }
        
        // Обновляем локальный statusElement для визуального отображения (если нужно)
        if (this.statusElement) {
            this.statusElement.textContent = message;
        }
        
        // Используем централизованный aria-live регион для объявления screen reader
        // Это предотвращает конфликты при наличии нескольких каруселей на странице
        if (typeof announceToScreenReader === 'function') {
            announceToScreenReader(message);
        }
    }

    update() {
        // Проверяем, что container еще существует (не был уничтожен)
        if (!this.container) return;
        
        const carouselContainer = this.container.querySelector('.carousel-container');
        if (!carouselContainer) return;

        if (this.items.length === 0) return;

        // Check if items have fixed width (for history carousel)
        const firstItem = this.items[0];
        let itemWidth;

        if (firstItem && firstItem.classList.contains('history-image')) {
            // Fixed width for history images
            itemWidth = window.APP_CONFIG?.CAROUSEL?.FIXED_ITEM_WIDTH || 252;
            // Устанавливаем ширину для всех элементов history-image
            this.items.forEach(item => {
                if (item.classList.contains('history-image')) {
                    item.style.width = `${itemWidth}px`;
                    item.style.flexShrink = '0';
                }
            });
        } else if (firstItem && firstItem.classList.contains('collection-image-card')) {
            // Fixed width for collection images (252px) + margin
            // Кэшируем margin, чтобы не вызывать getComputedStyle каждый раз
            this.cacheItemMargin(firstItem);
            itemWidth = (window.APP_CONFIG?.CAROUSEL?.FIXED_ITEM_WIDTH || 252) + this.cachedItemMargin;
            // Set width immediately without transition to prevent animation
            this.items.forEach(item => {
                item.style.transition = 'none';
                item.style.width = '252px';
                item.style.flexShrink = '0';
                // Restore transition after a short delay
                setTimeout(() => {
                    item.style.transition = '';
                }, 0);
            });
        } else {
            // Set item width based on itemsPerView
            // Используем кэшированную ширину контейнера, чтобы избежать forced reflow
            if (this.cachedContainerWidth === null) {
                this.cacheContainerWidth();
            }
            if (this.cachedContainerWidth !== null) {
                itemWidth = this.cachedContainerWidth / this.options.itemsPerView;
            } else {
                // Fallback на случай, если контейнер еще не отрендерен
                itemWidth = 0;
            }
            
            this.items.forEach(item => {
                item.style.width = `${itemWidth}px`;
                item.style.flexShrink = '0';
            });
        }

        // Обновляем кэш itemWidth для использования в updateTransform
        this.cachedItemWidth = itemWidth;

        const translateX = -(this.currentIndex * itemWidth);
        carouselContainer.style.transform = `translateX(${translateX}px)`;
        const transitionDuration = window.APP_CONFIG?.CAROUSEL?.TRANSITION_DURATION || 0.4;
        carouselContainer.style.transition = `transform ${transitionDuration}s cubic-bezier(0.4, 0, 0.2, 1)`;
        
        // Обновляем aria-current для текущего слайда
        this.items.forEach((item, index) => {
            if (index === this.currentIndex) {
                item.setAttribute('aria-current', 'true');
            } else {
                item.removeAttribute('aria-current');
            }
        });
        
        // Обновляем индикацию для screen readers
        this.updateStatus();
    }

    next() {
        if (this.options.loop) {
            this.currentIndex = (this.currentIndex + 1) % this.totalItems;
        } else {
            this.currentIndex = Math.min(this.currentIndex + 1, this.totalItems - this.options.itemsPerView);
        }
        this.update();
    }

    prev() {
        if (this.options.loop) {
            this.currentIndex = (this.currentIndex - 1 + this.totalItems) % this.totalItems;
        } else {
            this.currentIndex = Math.max(this.currentIndex - 1, 0);
        }
        this.update();
    }

    goTo(index) {
        if (index >= 0 && index < this.totalItems) {
            this.currentIndex = index;
            this.update();
        }
    }

    getCurrentIndex() {
        return this.currentIndex;
    }

    destroy() {
        // Clear resize timeout
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = null;
        }

        // Remove status element
        if (this.statusElement && this.statusElement.parentNode) {
            this.statusElement.parentNode.removeChild(this.statusElement);
            this.statusElement = null;
        }

        // Remove resize handler
        if (this.handlers.resize && this.handlers.resize.element && typeof this.handlers.resize.element.removeEventListener === 'function') {
            this.handlers.resize.element.removeEventListener('resize', this.handlers.resize.handler);
        }

        // Remove drag handlers
        if (this.handlers.mousedown && this.handlers.mousedown.element && typeof this.handlers.mousedown.element.removeEventListener === 'function') {
            this.handlers.mousedown.element.removeEventListener('mousedown', this.handlers.mousedown.handler);
        }
        if (this.handlers.mousemove && this.handlers.mousemove.element && typeof this.handlers.mousemove.element.removeEventListener === 'function') {
            this.handlers.mousemove.element.removeEventListener('mousemove', this.handlers.mousemove.handler);
        }
        if (this.handlers.mouseup && this.handlers.mouseup.element && typeof this.handlers.mouseup.element.removeEventListener === 'function') {
            this.handlers.mouseup.element.removeEventListener('mouseup', this.handlers.mouseup.handler);
        }

        // Remove touch handlers
        // ВАЖНО: При удалении обработчиков нужно указывать те же опции, что и при добавлении
        // Это особенно важно для Safari, где passive обработчики могут остаться в памяти
        if (this.handlers.touchstart && this.handlers.touchstart.element && typeof this.handlers.touchstart.element.removeEventListener === 'function') {
            this.handlers.touchstart.element.removeEventListener('touchstart', this.handlers.touchstart.handler, { passive: true });
        }
        if (this.handlers.touchmove && this.handlers.touchmove.element && typeof this.handlers.touchmove.element.removeEventListener === 'function') {
            this.handlers.touchmove.element.removeEventListener('touchmove', this.handlers.touchmove.handler, { passive: true });
        }
        if (this.handlers.touchend && this.handlers.touchend.element && typeof this.handlers.touchend.element.removeEventListener === 'function') {
            this.handlers.touchend.element.removeEventListener('touchend', this.handlers.touchend.handler, { passive: true });
        }
        if (this.handlers.touchcancel && this.handlers.touchcancel.element && typeof this.handlers.touchcancel.element.removeEventListener === 'function') {
            this.handlers.touchcancel.element.removeEventListener('touchcancel', this.handlers.touchcancel.handler, { passive: true });
        }

        // Remove navigation buttons
        if (this.handlers.prevBtn && this.handlers.prevHandler && typeof this.handlers.prevBtn.removeEventListener === 'function') {
            this.handlers.prevBtn.removeEventListener('click', this.handlers.prevHandler);
            if (this.handlers.prevBtn.parentNode) {
                this.handlers.prevBtn.remove();
            }
        }
        if (this.handlers.nextBtn && this.handlers.nextHandler && typeof this.handlers.nextBtn.removeEventListener === 'function') {
            this.handlers.nextBtn.removeEventListener('click', this.handlers.nextHandler);
            if (this.handlers.nextBtn.parentNode) {
                this.handlers.nextBtn.remove();
            }
        }

        // Remove image load handlers
        this.imageLoadHandlers.forEach(({ element, handler }) => {
            if (element && typeof element.removeEventListener === 'function') {
                try {
                    element.removeEventListener('load', handler);
                } catch (e) {
                    // Игнорируем ошибки при удалении обработчика
                }
            }
        });
        this.imageLoadHandlers = [];
        
        // Также удаляем обработчики через клонирование для надежности
        const carouselContainer = this.container?.querySelector('.carousel-container');
        if (carouselContainer) {
            const images = carouselContainer.querySelectorAll('img');
            images.forEach(img => {
                // Remove any load event listeners by cloning the node
                const newImg = img.cloneNode(true);
                img.parentNode?.replaceChild(newImg, img);
            });
        }

        // Clear all references
        this.handlers = {};
        this.items = [];
        this.container = null;
    }
}