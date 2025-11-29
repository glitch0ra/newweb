class CollectionsPage extends Page {
    constructor(store, dataLoader, modal, dataValidator, eventBus = null) {
        super(store);
        this.dataLoader = dataLoader;
        this.modal = modal;
        this.dataValidator = dataValidator;
        this.eventBus = eventBus;
        this.carousels = [];
        this.screenshotModalHandler = null;
        this.videoModalHandler = null;
        this.modalCloseUnsubscribe = null; // Функция для отмены подписки на onClose
    }

    /**
     * Валидирует изображение коллекции перед использованием
     * @param {Object} image - объект изображения
     * @returns {Object|null} - валидированное изображение или null
     */
    validateImage(image) {
        if (!image || typeof image !== 'object') {
            return null;
        }

        // Используем DataValidator для валидации структуры
        if (this.dataValidator) {
            const validator = this.dataValidator;
            const validatedImage = validator.validateCollectionImage(image);
            if (validatedImage) {
                return validatedImage;
            }
        }

        // Fallback: базовая проверка структуры
        return {
            id: String(image.id || ''),
            url: String(image.url || ''),
            title: String(image.title || ''),
            description: String(image.description || ''),
            screenshots: Array.isArray(image.screenshots) ? image.screenshots.map(s => String(s || '')) : [],
            videos: Array.isArray(image.videos) ? image.videos.map(v => {
                if (!v || typeof v !== 'object') return { url: '', thumbnail: '', duration: '' };
                return {
                    url: String(v.url || ''),
                    thumbnail: String(v.thumbnail || ''),
                    duration: String(v.duration || '')
                };
            }) : [],
            downloadLink: String(image.downloadLink || '')
        };
    }

    /**
     * Валидирует видео перед использованием
     * @param {Object} video - объект видео
     * @returns {Object|null} - валидированное видео или null
     */
    validateVideo(video) {
        if (!video || typeof video !== 'object') {
            return null;
        }

        // Используем DataValidator для валидации структуры
        if (this.dataValidator) {
            const validator = this.dataValidator;
            const validatedVideo = validator.validateVideo(video, 'video');
            if (validatedVideo) {
                return validatedVideo;
            }
        }

        // Fallback: базовая проверка структуры
        return {
            url: String(video.url || ''),
            thumbnail: String(video.thumbnail || ''),
            duration: String(video.duration || '')
        };
    }

    /**
     * Валидирует массив скриншотов перед использованием
     * @param {Array} screenshots - массив URL скриншотов
     * @returns {Array} - валидированный массив строк
     */
    validateScreenshots(screenshots) {
        if (!Array.isArray(screenshots)) {
            return [];
        }
        return screenshots.map(s => String(s || '')).filter(s => s.length > 0);
    }

    getRoute() {
        return 'collections';
    }

    async loadData(showLoader = true, forceReload = false, signal = null) {
        return await this.dataLoader.loadCollections(showLoader, forceReload, signal);
    }

    renderContent() {
        if (!this.data || !this.data.collections || !Array.isArray(this.data.collections)) {
            return '<div class="error">No collections data available</div>';
        }
        
        return `
      <div class="collections-feed">
        ${this.data.collections.map(collection => this.renderCollection(collection)).join('')}
      </div>
    `;
    }

    afterRender() {
        // Setup carousels
        this.setupCarousels();

        // Setup image clicks
        this.setupImageClicks();
    }

    renderCollection(collection) {
        if (!collection) {
            return '';
        }
        
        const images = collection.images && Array.isArray(collection.images) ? collection.images : [];
        
        return `
      <div class="collection-block glass">
        <div class="collection-header">
          <h2 class="collection-title">${this.escapeHTML(collection.title || '')}</h2>
          ${(() => {
            if (!collection.date) return '';
            const date = new Date(collection.date);
            return !isNaN(date.getTime()) ? `<span class="collection-date">${date.toLocaleDateString('ru-RU')}</span>` : '';
          })()}
        </div>
        <p class="collection-description">${this.escapeHTML(collection.description || '')}</p>
        <div class="collection-carousel-wrapper">
          <div class="collection-carousel carousel" data-collection-id="${this.escapeAttribute(collection.id || '')}">
            <div class="carousel-container">
              ${images.map(image => `
                <div class="carousel-item collection-image-card" data-image-id="${this.escapeAttribute(image.id || '')}">
                  <img src="${this.escapeURL(image.url || '')}" alt="${this.escapeAttribute(image.title || '')}" loading="lazy">
                  <div class="image-title-overlay">${this.escapeHTML(image.title || '')}</div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
    }

    setupCarousels() {
        // Destroy previous carousels только если они еще не уничтожены
        // (cleanup уже вызывается при смене страницы, но на всякий случай)
        this.carousels.forEach(carousel => {
            if (carousel && typeof carousel.destroy === 'function' && carousel.container) {
                carousel.destroy();
            }
        });
        this.carousels = [];

        // Используем requestAnimationFrame для отложенной инициализации каруселей
        // Это предотвращает избыточные перерисовки при загрузке страницы
        requestAnimationFrame(() => {
            document.querySelectorAll('.collection-carousel').forEach(carouselEl => {
                const carouselConfig = window.APP_CONFIG?.CAROUSEL?.ITEMS_PER_VIEW || { DESKTOP: 3, TABLET: 2, MOBILE: 1 };
                const itemsPerView = window.innerWidth > 1023 
                    ? carouselConfig.DESKTOP
                    : window.innerWidth > 767 
                        ? carouselConfig.TABLET
                        : carouselConfig.MOBILE;
                const carousel = new Carousel(carouselEl, {
                    itemsPerView,
                    loop: true,
                    draggable: true
                });
                this.carousels.push(carousel);
            });
        });
    }

    setupImageClicks() {
        // Remove previous handlers
        this.eventHandlers.filter(h => h.type === 'image-click').forEach(({ element, event, handler }) => {
            if (element && typeof element.removeEventListener === 'function') {
                element.removeEventListener(event, handler);
            }
        });
        this.eventHandlers = this.eventHandlers.filter(h => h.type !== 'image-click');

        document.querySelectorAll('.collection-image-card').forEach(card => {
            const handler = (e) => {
                e.stopPropagation();
                const imageId = card.dataset.imageId;
                const collectionId = card.closest('.collection-carousel')?.dataset.collectionId;

                if (!this.data || !this.data.collections || !Array.isArray(this.data.collections)) return;
                
                const collection = this.data.collections.find(c => c && c.id === collectionId);
                if (!collection || !collection.images || !Array.isArray(collection.images)) return;
                
                const image = collection.images.find(img => img && img.id === imageId);
                if (!image) return;

                // Передаем элемент, который открыл модалку, для возврата фокуса
                this.openImageModal(image, card);
            };
            this.addEventListener(card, 'click', handler, 'image-click');
        });
    }

    openImageModal(image, triggerElement = null) {
        // Валидируем изображение перед использованием
        const validatedImage = this.validateImage(image);
        if (!validatedImage) {
            return;
        }

        // Валидируем первый видео, если он есть
        const firstVideo = validatedImage.videos && validatedImage.videos.length > 0 
            ? this.validateVideo(validatedImage.videos[0]) 
            : null;
        
        // Валидируем скриншоты
        const validatedScreenshots = this.validateScreenshots(validatedImage.screenshots);
        
        // Валидируем все видео
        const validatedVideos = validatedImage.videos.map(v => this.validateVideo(v)).filter(v => v !== null);

        const modalContent = `
      <div class="modal-collection-image">
        <h1 id="modal-title" class="sr-only">${this.escapeHTML(validatedImage.title)}</h1>
        <div class="modal-collection-grid">
          <div class="modal-collection-left">
            <div class="modal-collection-main-image">
              <img src="${this.escapeURL(validatedImage.url)}" alt="${this.escapeAttribute(validatedImage.title)}" loading="lazy">
            </div>
            <div class="modal-collection-video">
              <video controls>
                <source src="${this.escapeURL(firstVideo?.url || '')}" type="video/mp4">
              </video>
            </div>
          </div>
          <div class="modal-collection-right">
            <h1 class="modal-collection-title">${this.escapeHTML(validatedImage.title)}</h1>
            <p class="modal-collection-description">${this.escapeHTML(validatedImage.description)}</p>
            <div class="modal-collection-screenshots">
              ${validatedScreenshots.map((screenshot, idx) => `
                <img src="${this.escapeURL(screenshot)}" alt="${this.escapeAttribute(`Screenshot ${idx + 1}`)}" class="screenshot-thumb" data-screenshot-index="${idx}" data-image-id="${this.escapeAttribute(validatedImage.id)}" loading="lazy">
              `).join('')}
            </div>
            <div class="modal-collection-videos">
              ${validatedVideos.map((video, idx) => `
                <div class="modal-video-item" data-video-index="${idx}" data-image-id="${this.escapeAttribute(validatedImage.id)}">
                  <video muted>
                    <source src="${this.escapeURL(video.url)}" type="video/mp4">
                  </video>
                  <div class="video-play-overlay-small">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="white">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </div>
                </div>
              `).join('')}
            </div>
            <a href="${this.escapeURL(validatedImage.downloadLink)}" class="btn" target="_blank" rel="noopener noreferrer">Download</a>
          </div>
        </div>
      </div>
    `;

        // Используем прямой вызов modal.open() как основной способ
        // EventBus используется только если modal недоступен
        if (this.modal && typeof this.modal.open === 'function') {
            this.modal.open(modalContent, triggerElement);
        } else if (this.eventBus && typeof this.eventBus.emit === 'function' && this.eventBus.listeners) {
            // Проверяем, что eventBus не является заглушкой (имеет listeners)
            this.eventBus.emit('modal:open', { content: modalContent, triggerElement });
        }

        // Регистрируем callback для очистки modalEventHandlers при закрытии модалки
        // Это предотвращает утечки памяти
        if (this.modalCloseUnsubscribe) {
            this.modalCloseUnsubscribe();
        }
        // Используем EventBus для подписки на закрытие модалки, если доступен
        if (this.eventBus && typeof this.eventBus.on === 'function') {
            this.modalCloseUnsubscribe = this.eventBus.on('modal:closed', () => {
                // Очищаем все modalEventHandlers при закрытии модалки
                this.modalEventHandlers.forEach(({ element, event, handler }) => {
                    if (element && typeof element.removeEventListener === 'function') {
                        try {
                            element.removeEventListener(event, handler);
                        } catch (e) {
                            // Игнорируем ошибки при удалении обработчиков
                        }
                    }
                });
                this.modalEventHandlers = [];
            });
        } else if (this.modal && typeof this.modal.onClose === 'function') {
            // Fallback на прямой вызов для обратной совместимости
            this.modalCloseUnsubscribe = this.modal.onClose(() => {
                // Очищаем все modalEventHandlers при закрытии модалки
                this.modalEventHandlers.forEach(({ element, event, handler }) => {
                    if (element && typeof element.removeEventListener === 'function') {
                        try {
                            element.removeEventListener(event, handler);
                        } catch (e) {
                            // Игнорируем ошибки при удалении обработчиков
                        }
                    }
                });
                this.modalEventHandlers = [];
            });
        }

        // Setup screenshot modal с валидированными данными
        this.setupScreenshotModal(validatedImage);

        // Setup video modal - use event delegation to ensure clicks work
        // Используем requestAnimationFrame для гарантии, что DOM обновлен
        requestAnimationFrame(() => {
            this.setupVideoModal(validatedImage);
        });
    }

    setupScreenshotModal(image) {
        // Валидируем изображение перед использованием
        const validatedImage = this.validateImage(image);
        if (!validatedImage) {
            return;
        }

        // Use event delegation on modal-content to ensure clicks work
        // This ensures handlers work even after content changes via pushContent/popContent
        const modalContent = document.getElementById('modal-content');
        if (modalContent) {
            // Remove old handler if exists - удаляем из modalEventHandlers, так как modalContent может быть заменен
            if (this.screenshotModalHandler) {
                // Ищем и удаляем старый обработчик из modalEventHandlers
                this.modalEventHandlers = this.modalEventHandlers.filter(({ handler }) => handler !== this.screenshotModalHandler);
                // Пытаемся удалить со старого modalContent (может не сработать если элемент был заменен)
                try {
                    modalContent.removeEventListener('click', this.screenshotModalHandler);
                } catch (e) {
                    // Игнорируем ошибки - элемент мог быть заменен
                }
            }
            
            const newHandler = (e) => {
                const screenshotThumb = e.target.closest('.screenshot-thumb');
                if (screenshotThumb) {
                    e.stopPropagation();
                    const screenshotIndex = parseInt(screenshotThumb.dataset.screenshotIndex, 10);
                    const imageId = screenshotThumb.dataset.imageId;
                    if (!isNaN(screenshotIndex) && screenshotIndex >= 0) {
                        // Find the correct image to pass
                        let currentImage = validatedImage;
                        if (imageId && this.data && this.data.collections) {
                            for (const collection of this.data.collections) {
                                if (!collection || !collection.images || !Array.isArray(collection.images)) continue;
                                const foundImage = collection.images.find(img => img && img.id === imageId);
                                if (foundImage) {
                                    currentImage = foundImage;
                                    break;
                                }
                            }
                        }
                        
                        if (currentImage) {
                            // Валидируем изображение перед использованием
                            const validatedCurrentImage = this.validateImage(currentImage);
                            if (validatedCurrentImage && validatedCurrentImage.screenshots) {
                                this.openScreenshotViewer(validatedCurrentImage.screenshots, screenshotIndex, validatedCurrentImage);
                            }
                        }
                    }
                }
            };
            
            this.screenshotModalHandler = newHandler;
            // Используем addModalEventListener для отслеживания и автоматической очистки
            this.addModalEventListener(modalContent, 'click', newHandler);
        }
    }

    openScreenshotViewer(screenshots, startIndex, image = null) {
        // Валидируем скриншоты перед использованием
        const validatedScreenshots = this.validateScreenshots(screenshots);
        if (validatedScreenshots.length === 0) {
            return;
        }

        // Проверяем корректность startIndex
        const safeStartIndex = Math.max(0, Math.min(startIndex, validatedScreenshots.length - 1));

        const modalContent = `
      <div class="modal-screenshot-viewer collection-modal-viewer">
        <div class="screenshot-viewer-wrapper">
          <button class="carousel-nav prev screenshot-nav" id="screenshot-prev">‹</button>
          <div class="screenshot-viewer-container">
            <img src="${this.escapeAttribute(validatedScreenshots[safeStartIndex])}" alt="${this.escapeAttribute(`Screenshot ${safeStartIndex + 1}`)}" class="screenshot-viewer-image" loading="lazy">
            <div class="screenshot-viewer-counter">
              ${safeStartIndex + 1} of ${validatedScreenshots.length}
            </div>
          </div>
          <button class="carousel-nav next screenshot-nav" id="screenshot-next">›</button>
        </div>
        <button class="modal-back-btn" id="screenshot-back-btn">← Back</button>
      </div>
    `;

        // Используем прямой вызов modal.pushContent() как основной способ
        // EventBus используется только если modal недоступен
        if (this.modal && typeof this.modal.pushContent === 'function') {
            this.modal.pushContent(modalContent);
        } else if (this.eventBus && typeof this.eventBus.emit === 'function' && this.eventBus.listeners) {
            // Проверяем, что eventBus не является заглушкой (имеет listeners)
            this.eventBus.emit('modal:pushContent', { content: modalContent });
        }

        let currentIndex = safeStartIndex;

        // Remove previous modal handlers
        this.modalEventHandlers.forEach(({ element, event, handler }) => {
            if (element && typeof element.removeEventListener === 'function') {
                try {
                    element.removeEventListener(event, handler);
                } catch (e) {
                    // Игнорируем ошибки при удалении обработчиков
                }
            }
        });
        this.modalEventHandlers = [];

        const prevBtn = document.getElementById('screenshot-prev');
        const nextBtn = document.getElementById('screenshot-next');
        const backBtn = document.getElementById('screenshot-back-btn');

        if (prevBtn) {
            const prevHandler = () => {
                currentIndex = (currentIndex - 1 + validatedScreenshots.length) % validatedScreenshots.length;
                const imgEl = document.querySelector('.screenshot-viewer-image');
                const counterEl = document.querySelector('.screenshot-viewer-counter');
                if (imgEl) {
                    imgEl.src = this.escapeURL(validatedScreenshots[currentIndex]);
                }
                if (counterEl) {
                    counterEl.textContent = `${currentIndex + 1} of ${validatedScreenshots.length}`;
                }
            };
            this.addModalEventListener(prevBtn, 'click', prevHandler);
        }

        if (nextBtn) {
            const nextHandler = () => {
                currentIndex = (currentIndex + 1) % validatedScreenshots.length;
                const imgEl = document.querySelector('.screenshot-viewer-image');
                const counterEl = document.querySelector('.screenshot-viewer-counter');
                if (imgEl) {
                    imgEl.src = this.escapeURL(validatedScreenshots[currentIndex]);
                }
                if (counterEl) {
                    counterEl.textContent = `${currentIndex + 1} of ${validatedScreenshots.length}`;
                }
            };
            this.addModalEventListener(nextBtn, 'click', nextHandler);
        }

        // Keyboard navigation - используем addGlobalEventListener для отслеживания
        const handleKeyPress = (e) => {
            const imgEl = document.querySelector('.screenshot-viewer-image');
            const counterEl = document.querySelector('.screenshot-viewer-counter');
            if (e.key === 'ArrowLeft') {
                currentIndex = (currentIndex - 1 + validatedScreenshots.length) % validatedScreenshots.length;
                if (imgEl) {
                    imgEl.src = this.escapeURL(validatedScreenshots[currentIndex]);
                }
                if (counterEl) {
                    counterEl.textContent = `${currentIndex + 1} of ${validatedScreenshots.length}`;
                }
            } else if (e.key === 'ArrowRight') {
                currentIndex = (currentIndex + 1) % validatedScreenshots.length;
                if (imgEl) {
                    imgEl.src = this.escapeURL(validatedScreenshots[currentIndex]);
                }
                if (counterEl) {
                    counterEl.textContent = `${currentIndex + 1} of ${validatedScreenshots.length}`;
                }
            }
        };

        // Используем modal.setKeyboardHandler для управления keyboard navigation
        // Не дублируем через addGlobalEventListener, так как modal сам управляет этим обработчиком
        this.modal.setKeyboardHandler(handleKeyPress);
        
        // Setup back button
        if (backBtn) {
            const backHandler = () => {
                if (this.modal.popContent()) {
                    // Restore handlers after content is restored
                    if (image) {
                        // Используем requestAnimationFrame для гарантии, что DOM обновлен
                        requestAnimationFrame(() => {
                            this.setupScreenshotModal(image);
                            this.setupVideoModal(image);
                        });
                    }
                } else {
                    this.modal.close();
                }
            };
            this.addModalEventListener(backBtn, 'click', backHandler);
        }
    }

    setupVideoModal(image) {
        // Валидируем изображение перед использованием
        const validatedImage = this.validateImage(image);
        if (!validatedImage) {
            return;
        }

        // Use event delegation on modal-content to ensure clicks work
        // Remove existing handler if any
        const modalContent = document.getElementById('modal-content');
        if (modalContent) {
            // Remove old handler if exists - удаляем из modalEventHandlers, так как modalContent может быть заменен
            if (this.videoModalHandler) {
                // Ищем и удаляем старый обработчик из modalEventHandlers
                this.modalEventHandlers = this.modalEventHandlers.filter(({ handler }) => handler !== this.videoModalHandler);
                // Пытаемся удалить со старого modalContent (может не сработать если элемент был заменен)
                try {
                    modalContent.removeEventListener('click', this.videoModalHandler);
                } catch (e) {
                    // Игнорируем ошибки - элемент мог быть заменен
                }
            }
            
            const newHandler = (e) => {
                const videoItem = e.target.closest('.modal-video-item');
                if (videoItem) {
                    e.stopPropagation();
                    const videoIndex = parseInt(videoItem.dataset.videoIndex, 10);
                    const imageId = videoItem.dataset.imageId;
                    if (!isNaN(videoIndex) && videoIndex >= 0) {
                        // Find the correct image to pass
                        let currentImage = validatedImage;
                        if (imageId && this.data && this.data.collections) {
                            for (const collection of this.data.collections) {
                                if (!collection || !collection.images || !Array.isArray(collection.images)) continue;
                                const foundImage = collection.images.find(img => img && img.id === imageId);
                                if (foundImage) {
                                    currentImage = foundImage;
                                    break;
                                }
                            }
                        }
                        
                        if (currentImage) {
                            // Валидируем изображение перед использованием
                            const validatedCurrentImage = this.validateImage(currentImage);
                            if (validatedCurrentImage && validatedCurrentImage.videos) {
                                this.openVideoViewer(validatedCurrentImage.videos, videoIndex, validatedCurrentImage);
                            }
                        }
                    }
                }
            };
            
            this.videoModalHandler = newHandler;
            // Используем addModalEventListener для отслеживания и автоматической очистки
            this.addModalEventListener(modalContent, 'click', newHandler);
        }
    }

    openVideoViewer(videos, startIndex, image = null) {
        // Валидируем видео перед использованием
        const validatedVideos = videos.map(v => this.validateVideo(v)).filter(v => v !== null);
        if (validatedVideos.length === 0) {
            return;
        }

        // Проверяем корректность startIndex
        const safeStartIndex = Math.max(0, Math.min(startIndex, validatedVideos.length - 1));
        const firstVideo = validatedVideos[safeStartIndex];

        const modalContent = `
      <div class="modal-video-viewer collection-modal-viewer">
        <div class="video-viewer-wrapper">
          <button class="carousel-nav prev video-nav" id="video-prev">‹</button>
          <div class="video-viewer-container">
            <video controls class="video-viewer-video" id="video-viewer">
              <source src="${this.escapeURL(firstVideo.url)}" type="video/mp4">
            </video>
          </div>
          <button class="carousel-nav next video-nav" id="video-next">›</button>
        </div>
        <button class="modal-back-btn" id="video-back-btn">← Back</button>
      </div>
    `;

        // Используем прямой вызов modal.pushContent() как основной способ
        // EventBus используется только если modal недоступен
        if (this.modal && typeof this.modal.pushContent === 'function') {
            this.modal.pushContent(modalContent);
        } else if (this.eventBus && typeof this.eventBus.emit === 'function' && this.eventBus.listeners) {
            // Проверяем, что eventBus не является заглушкой (имеет listeners)
            this.eventBus.emit('modal:pushContent', { content: modalContent });
        }

        let currentIndex = safeStartIndex;
        const videoEl = document.getElementById('video-viewer');

        // Remove previous modal handlers
        this.modalEventHandlers.forEach(({ element, event, handler }) => {
            if (element && typeof element.removeEventListener === 'function') {
                try {
                    element.removeEventListener(event, handler);
                } catch (e) {
                    // Игнорируем ошибки при удалении обработчиков
                }
            }
        });
        this.modalEventHandlers = [];

        const prevBtn = document.getElementById('video-prev');
        const nextBtn = document.getElementById('video-next');
        const backBtn = document.getElementById('video-back-btn');

        if (prevBtn && videoEl) {
            const prevHandler = () => {
                currentIndex = (currentIndex - 1 + validatedVideos.length) % validatedVideos.length;
                const video = validatedVideos[currentIndex];
                if (video && video.url) {
                    videoEl.src = this.escapeURL(video.url);
                    videoEl.load();
                }
            };
            this.addModalEventListener(prevBtn, 'click', prevHandler);
        }

        if (nextBtn && videoEl) {
            const nextHandler = () => {
                currentIndex = (currentIndex + 1) % validatedVideos.length;
                const video = validatedVideos[currentIndex];
                if (video && video.url) {
                    videoEl.src = this.escapeURL(video.url);
                    videoEl.load();
                }
            };
            this.addModalEventListener(nextBtn, 'click', nextHandler);
        }

        // Keyboard navigation - используем addGlobalEventListener для отслеживания
        const handleKeyPress = (e) => {
            if (videoEl) {
                if (e.key === 'ArrowLeft') {
                    currentIndex = (currentIndex - 1 + validatedVideos.length) % validatedVideos.length;
                    const video = validatedVideos[currentIndex];
                    if (video && video.url) {
                        videoEl.src = this.escapeURL(video.url);
                        videoEl.load();
                    }
                } else if (e.key === 'ArrowRight') {
                    currentIndex = (currentIndex + 1) % validatedVideos.length;
                    const video = validatedVideos[currentIndex];
                    if (video && video.url) {
                        videoEl.src = this.escapeURL(video.url);
                        videoEl.load();
                    }
                }
            }
        };

        // Используем прямой вызов modal.setKeyboardHandler() как основной способ
        // EventBus используется только если modal недоступен
        if (this.modal && typeof this.modal.setKeyboardHandler === 'function') {
            this.modal.setKeyboardHandler(handleKeyPress);
        } else if (this.eventBus && typeof this.eventBus.emit === 'function' && this.eventBus.listeners) {
            // Проверяем, что eventBus не является заглушкой (имеет listeners)
            this.eventBus.emit('modal:setKeyboardHandler', { handler: handleKeyPress });
        }
        
        // Setup back button
        if (backBtn) {
            const backHandler = () => {
                // popContent возвращает boolean, поэтому используем прямой вызов
                const hasPrevious = this.modal && typeof this.modal.popContent === 'function' 
                    ? this.modal.popContent() 
                    : false;
                if (hasPrevious) {
                    // Restore handlers after content is restored
                    if (image) {
                        // Используем requestAnimationFrame для гарантии, что DOM обновлен
                        requestAnimationFrame(() => {
                            this.setupScreenshotModal(image);
                            this.setupVideoModal(image);
                        });
                    }
                } else {
                    // Используем EventBus для закрытия модалки, если доступен
                    if (this.eventBus && typeof this.eventBus.emit === 'function') {
                        // Используем прямой вызов modal.close() как основной способ
                        if (this.modal && typeof this.modal.close === 'function') {
                            this.modal.close();
                        } else if (this.eventBus && typeof this.eventBus.emit === 'function' && this.eventBus.listeners) {
                            this.eventBus.emit('modal:close');
                        }
                    } else if (this.modal && typeof this.modal.close === 'function') {
                        // Fallback на прямой вызов для обратной совместимости
                        this.modal.close();
                    }
                }
            };
            this.addModalEventListener(backBtn, 'click', backHandler);
        }
    }

    cleanup() {
        // Destroy all carousels
        this.carousels.forEach(carousel => {
            if (carousel && typeof carousel.destroy === 'function') {
                carousel.destroy();
            }
        });
        this.carousels = [];

        // Отменяем подписку на onClose callback
        if (this.modalCloseUnsubscribe && typeof this.modalCloseUnsubscribe === 'function') {
            this.modalCloseUnsubscribe();
            this.modalCloseUnsubscribe = null;
        }

        // Очищаем все modalEventHandlers
        this.modalEventHandlers.forEach(({ element, event, handler }) => {
            if (element && typeof element.removeEventListener === 'function') {
                try {
                    element.removeEventListener(event, handler);
                } catch (e) {
                    // Игнорируем ошибки
                }
            }
        });
        this.modalEventHandlers = [];

        // Remove modal handlers (теперь они отслеживаются через addModalEventListener)
        // Но оставляем очистку ссылок для безопасности
        this.screenshotModalHandler = null;
        this.videoModalHandler = null;

        // Убеждаемся, что modal keyboard handler удален
        if (this.eventBus && typeof this.eventBus.emit === 'function') {
            this.eventBus.emit('modal:setKeyboardHandler', { handler: null });
        } else if (this.modal && this.modal.keyboardHandler) {
            this.modal.setKeyboardHandler(null);
        }

        // Вызываем cleanup родительского класса (удалит все отслеживаемые обработчики)
        super.cleanup();
    }
}

// CollectionsPage будет создан в Application