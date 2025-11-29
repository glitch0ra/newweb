class VideosPage extends Page {
    constructor(store, dataLoader, modal, eventBus = null) {
        super(store);
        this.dataLoader = dataLoader;
        this.modal = modal;
        this.eventBus = eventBus;
        this.modalCloseUnsubscribe = null; // Функция для отмены подписки на onClose
        this.virtualizedGrids = []; // Массив виртуализированных grid для cleanup
    }

    getRoute() {
        return 'videos';
    }

    async loadData(showLoader = true, forceReload = false, signal = null) {
        return await this.dataLoader.loadVideos(showLoader, signal);
    }

    renderContent() {
        if (!this.data || !this.data.groups || !Array.isArray(this.data.groups)) {
            return '<div class="error">No videos data available</div>';
        }
        
        return `
      <div class="videos-feed">
        ${this.data.groups.map(group => this.renderGroup(group)).join('')}
      </div>
    `;
    }

    afterRender() {
        // Виртуализация больше не используется для preview (только 6 элементов)
        // Preview элементы рендерятся напрямую в renderGroup()

        // Setup expand/collapse
        this.setupExpandCollapse();

        // Setup video clicks
        this.setupVideoClicks();
    }


    renderGroup(group) {
        if (!group || !group.videos || !Array.isArray(group.videos)) {
            return '';
        }
        
        const previewItemsCount = window.APP_CONFIG?.PAGINATION?.PREVIEW_ITEMS_COUNT || 6;
        const previewItems = group.videos.slice(0, previewItemsCount);
        const total = group.videos.length;
        const itemsPerPage = window.APP_CONFIG?.PAGINATION?.ITEMS_PER_PAGE || 18;
        const pages = Math.ceil(total / itemsPerPage);

        return `
      <section class="video-group glass" data-group-id="${this.escapeAttribute(group.id)}">
        <div class="group-header">
          <h2 class="group-title">${this.escapeHTML(group.title)}</h2>
          ${(() => {
            if (!group.date) return '';
            const date = new Date(group.date);
            return !isNaN(date.getTime()) ? `<time class="group-date" datetime="${group.date}">${date.toLocaleDateString('ru-RU')}</time>` : '';
          })()}
        </div>
        <p class="group-description">${this.escapeHTML(group.description)}</p>
        <div class="video-group-preview" data-group-id="${this.escapeAttribute(group.id)}">
          ${previewItems.map((video, idx) => `
            <article class="video-item" data-group-id="${this.escapeAttribute(group.id)}" data-index="${idx}">
              <img src="${this.escapeURL(video.thumbnail)}" alt="${this.escapeAttribute(video.title)}" class="video-thumbnail" loading="lazy">
              <div class="video-play-overlay" aria-hidden="true">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
              <div class="video-duration">${this.escapeHTML(video.duration)}</div>
            </article>
          `).join('')}
        </div>
        <button class="group-expand-btn" data-group-id="${this.escapeAttribute(group.id)}" aria-label="Expand video group" aria-expanded="false">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="white" aria-hidden="true">
            <path d="M7 10l5 5 5-5z"/>
          </svg>
        </button>
        <div class="video-group-expanded" style="display: none;" data-expanded="false">
          ${this.renderExpandedGroup(group, pages, itemsPerPage)}
        </div>
      </section>
    `;
    }

    renderExpandedGroup(group, pages, itemsPerPage) {
        let html = '';
        const paginationHtml = pages > 1 ? `
          <div class="video-pagination">
            ${Array.from({ length: pages }, (_, i) => `
              <button class="pagination-dot ${i === 0 ? 'active' : ''}" data-page="${i}">
                ${i + 1}
              </button>
            `).join('')}
          </div>
        ` : '';

        // Виртуализация: рендерим только первую страницу + следующую (для предзагрузки)
        // Остальные страницы будут отрендерены по требованию при переключении
        const pagesToRenderInitially = Math.min(window.APP_CONFIG?.PAGINATION?.PAGES_TO_RENDER_INITIALLY || 2, pages);

        for (let page = 0; page < pages; page++) {
            const startIdx = page * itemsPerPage;
            const endIdx = Math.min(startIdx + itemsPerPage, group.videos.length);
            const pageVideos = group.videos.slice(startIdx, endIdx);
            // Ограничиваем до ITEMS_PER_PAGE элементов (3 ряда * 6 колонок)
            const itemsPerPageLimit = window.APP_CONFIG?.PAGINATION?.ITEMS_PER_PAGE || 18;
            const limitedVideos = pageVideos.slice(0, itemsPerPageLimit);

            // Рендерим только первые страницы, остальные - пустые контейнеры
            const pageContent = page < pagesToRenderInitially
                ? limitedVideos.map((video, idx) => `
                    <div class="video-item" data-group-id="${this.escapeAttribute(group.id)}" data-index="${startIdx + idx}">
                      <img src="${this.escapeURL(video.thumbnail)}" alt="${this.escapeAttribute(video.title)}" class="video-thumbnail" loading="lazy">
                      <div class="video-play-overlay">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      </div>
                      <div class="video-duration">${this.escapeHTML(video.duration)}</div>
                    </div>
                  `).join('')
                : ''; // Пустая страница, будет отрендерена по требованию

            html += `
        <div class="video-page" data-page="${page}" data-group-id="${this.escapeAttribute(group.id)}" style="display: ${page === 0 ? 'grid' : 'none'};">
          ${pageContent}
        </div>
      `;
        }

        return html + paginationHtml;
    }

    setupExpandCollapse() {
        // Remove previous handlers
        this.eventHandlers.filter(h => h.type === 'expand').forEach(({
            element,
            event,
            handler
        }) => {
            if (element && typeof element.removeEventListener === 'function') {
                element.removeEventListener(event, handler);
            }
        });
        this.eventHandlers = this.eventHandlers.filter(h => h.type !== 'expand');

        document.querySelectorAll('.group-expand-btn').forEach(btn => {
            const handler = (e) => {
                e.stopPropagation();
                const groupId = btn.dataset.groupId;
                if (!groupId) return;
                
                const group = document.querySelector(`.video-group[data-group-id="${groupId}"]`);
                if (!group) return;
                
                const expanded = group.querySelector('.video-group-expanded');
                const preview = group.querySelector('.video-group-preview');

                if (!expanded) return;

                // Используем data-атрибут вместо getComputedStyle для избежания forced reflow
                const isExpanded = expanded.dataset.expanded === 'true';

                if (isExpanded) {
                    expanded.style.display = 'none';
                    expanded.dataset.expanded = 'false';
                    btn.setAttribute('aria-expanded', 'false');
                    if (preview) preview.style.display = 'grid';
                    btn.style.transform = 'rotate(0deg)';
                } else {
                    expanded.style.display = 'block';
                    expanded.dataset.expanded = 'true';
                    btn.setAttribute('aria-expanded', 'true');
                    if (preview) preview.style.display = 'none';
                    btn.style.transform = 'rotate(180deg)';
                    // Setup pagination after expanding
                    this.setupPagination(groupId);
                }
            };
            this.addEventListener(btn, 'click', handler, 'expand');
        });
    }

    setupPagination(groupId) {
        const group = document.querySelector(`.video-group[data-group-id="${groupId}"]`);
        if (!group) return;

        const expanded = group.querySelector('.video-group-expanded');
        if (!expanded) return;

        // Remove previous pagination handlers for this group
        const paginationHandlers = this.eventHandlers.filter(h => h.type === 'pagination' && h.groupId === groupId);
        paginationHandlers.forEach(({
            element,
            event,
            handler
        }) => {
            if (element && typeof element.removeEventListener === 'function') {
                element.removeEventListener(event, handler);
            }
        });
        this.eventHandlers = this.eventHandlers.filter(h => !(h.type === 'pagination' && h.groupId === groupId));

        const dots = expanded.querySelectorAll('.pagination-dot');
        const pages = expanded.querySelectorAll('.video-page');

        dots.forEach(dot => {
            const handler = (e) => {
                e.stopPropagation();
                const page = parseInt(dot.dataset.page, 10);
                if (isNaN(page) || page < 0 || page >= pages.length) return;

                // Виртуализация: рендерим страницу по требованию, если она еще не отрендерена
                const pageElement = pages[page];
                if (pageElement && !pageElement.innerHTML.trim()) {
                    // Рендерим страницу по требованию
                    const group = this.data.groups.find(g => g.id === groupId);
                    if (group) {
                        const itemsPerPage = window.APP_CONFIG?.PAGINATION?.ITEMS_PER_PAGE || 18;
                        const startIdx = page * itemsPerPage;
                        const endIdx = Math.min(startIdx + itemsPerPage, group.videos.length);
                        const pageVideos = group.videos.slice(startIdx, endIdx);
                        const limitedVideos = pageVideos.slice(0, itemsPerPage);
                        
                        pageElement.innerHTML = limitedVideos.map((video, idx) => `
                            <div class="video-item" data-group-id="${this.escapeAttribute(groupId)}" data-index="${startIdx + idx}">
                              <img src="${this.escapeURL(video.thumbnail)}" alt="${this.escapeAttribute(video.title)}" class="video-thumbnail" loading="lazy">
                              <div class="video-play-overlay">
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
                                  <path d="M8 5v14l11-7z"/>
                                </svg>
                              </div>
                              <div class="video-duration">${this.escapeHTML(video.duration)}</div>
                            </div>
                        `).join('');
                        
                        // Настраиваем обработчики для новых элементов
                        this.setupVideoClicksForPage(pageElement);
                    }
                }

                pages.forEach((p, idx) => {
                    p.style.display = idx === page ? 'grid' : 'none';
                });

                dots.forEach((d, idx) => {
                    d.classList.toggle('active', idx === page);
                });
            };
            this.addEventListener(dot, 'click', handler, 'pagination', { groupId });
        });
    }

    setupVideoClicks() {
        // Remove previous handlers
        const videoHandlers = this.eventHandlers.filter(h => h.type === 'video');
        videoHandlers.forEach(({
            element,
            event,
            handler
        }) => {
            if (element && typeof element.removeEventListener === 'function') {
                element.removeEventListener(event, handler);
            }
        });
        this.eventHandlers = this.eventHandlers.filter(h => h.type !== 'video');

        // Используем event delegation для обработки кликов на всех video-item
        // Это работает даже для элементов, добавленных динамически
        const mainContent = this.getMainContent();
        if (mainContent) {
            const handler = (e) => {
                const item = e.target.closest('.video-item');
                if (!item) return;
                
                e.stopPropagation();
                const groupId = item.dataset.groupId;
                const index = parseInt(item.dataset.index, 10);
                if (isNaN(index) || index < 0) return;

                if (!this.data || !this.data.groups || !Array.isArray(this.data.groups)) return;
                
                const group = this.data.groups.find(g => g && g.id === groupId);
                if (group) {
                    // Передаем элемент, который открыл модалку, для возврата фокуса
                    this.openVideoModal(group, index, item);
                }
            };
            this.addEventListener(mainContent, 'click', handler, 'video');
        }
    }

    /**
     * Настраивает обработчики кликов для элементов на конкретной странице
     * Используется для виртуализированных страниц
     */
    setupVideoClicksForPage(pageElement) {
        // Обработчики уже настроены через event delegation в setupVideoClicks
        // Но можно добавить дополнительную логику если нужно
    }

    openVideoModal(group, startIndex, triggerElement = null) {
        if (!group || !group.videos || !Array.isArray(group.videos) || group.videos.length === 0) {
            return;
        }
        
        const videos = group.videos;
        const safeStartIndex = Math.max(0, Math.min(startIndex || 0, videos.length - 1));
        let currentIndex = safeStartIndex;
        
        // Валидируем видео перед использованием
        const validatedVideos = videos
            .filter(v => v && typeof v === 'object' && v.url && typeof v.url === 'string' && v.url.length > 0)
            .map(v => ({
                url: String(v.url || ''),
                thumbnail: String(v.thumbnail || ''),
                duration: String(v.duration || ''),
                title: String(v.title || '')
            }));
        
        if (validatedVideos.length === 0) {
            return;
        }
        
        // Обновляем currentIndex если он выходит за границы
        if (currentIndex >= validatedVideos.length) {
            currentIndex = 0;
        }
        
        const firstVideo = validatedVideos[currentIndex];

        const modalContent = `
      <div class="modal-video-viewer">
        <h1 id="modal-title" class="sr-only">Viewing videos: ${this.escapeHTML(group.title || '')}</h1>
        <div class="video-viewer-wrapper">
          <button class="carousel-nav prev video-nav" id="video-prev" aria-label="Previous video">‹</button>
          <div class="video-viewer-container">
            <video controls class="video-viewer-video" id="video-viewer">
              <source src="${this.escapeURL(firstVideo.url)}" type="video/mp4">
            </video>
            <div class="video-viewer-title">${this.escapeHTML(firstVideo.title)}</div>
          </div>
          <button class="carousel-nav next video-nav" id="video-next" aria-label="Next video">›</button>
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

        const videoEl = document.getElementById('video-viewer');

        // Remove previous modal handlers
        this.modalEventHandlers.forEach(({
            element,
            event,
            handler
        }) => {
            if (element && typeof element.removeEventListener === 'function') {
                try {
                    element.removeEventListener(event, handler);
                } catch (e) {
                    // Игнорируем ошибки при удалении обработчиков
                }
            }
        });
        this.modalEventHandlers = [];

        const updateVideo = () => {
            if (videoEl && validatedVideos[currentIndex]) {
                const video = validatedVideos[currentIndex];
                videoEl.src = this.escapeURL(video.url);
                videoEl.load();
                const titleEl = document.querySelector('.video-viewer-title');
                if (titleEl) {
                    titleEl.textContent = this.escapeHTML(video.title);
                }
                // Используем централизованный aria-live регион для объявления screen reader
                if (typeof announceToScreenReader === 'function') {
                    announceToScreenReader(`Video ${currentIndex + 1} of ${validatedVideos.length}: ${video.title || ''}`);
                }
            }
        };

        const prevBtn = document.getElementById('video-prev');
        const nextBtn = document.getElementById('video-next');

        if (prevBtn && videoEl) {
            const prevHandler = () => {
                currentIndex = (currentIndex - 1 + validatedVideos.length) % validatedVideos.length;
                updateVideo();
            };
            this.addModalEventListener(prevBtn, 'click', prevHandler);
        }

        if (nextBtn && videoEl) {
            const nextHandler = () => {
                currentIndex = (currentIndex + 1) % validatedVideos.length;
                updateVideo();
            };
            this.addModalEventListener(nextBtn, 'click', nextHandler);
        }

        // Keyboard navigation - используем addGlobalEventListener для отслеживания
        const handleKeyPress = (e) => {
            if (e.key === 'ArrowLeft') {
                currentIndex = (currentIndex - 1 + validatedVideos.length) % validatedVideos.length;
                updateVideo();
            } else if (e.key === 'ArrowRight') {
                currentIndex = (currentIndex + 1) % validatedVideos.length;
                updateVideo();
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
    }

    cleanup() {
        // Очищаем виртуализированные grid
        this.virtualizedGrids.forEach(grid => {
            if (grid && typeof grid.cleanup === 'function') {
                grid.cleanup();
            }
        });
        this.virtualizedGrids = [];

        // Убеждаемся, что modal keyboard handler удален
        // Используем прямой вызов modal.setKeyboardHandler(null) как основной способ
        if (this.modal && typeof this.modal.setKeyboardHandler === 'function') {
            this.modal.setKeyboardHandler(null);
        } else if (this.eventBus && typeof this.eventBus.emit === 'function' && this.eventBus.listeners) {
            this.eventBus.emit('modal:setKeyboardHandler', { handler: null });
        }

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

        // Вызываем cleanup родительского класса
        super.cleanup();
    }
}

// VideosPage будет создан в Application