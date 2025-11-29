class MainPage extends Page {
    constructor(store, dataLoader, modal, eventBus = null) {
        super(store);
        this.dataLoader = dataLoader;
        this.modal = modal;
        this.eventBus = eventBus;
    }

    getRoute() {
        return 'main';
    }

    async loadData(showLoader = true, forceReload = false, signal = null) {
        return await this.dataLoader.loadMain(showLoader, signal);
    }

    renderContent() {
        if (!this.data || !this.data.posts || !Array.isArray(this.data.posts)) {
            return '<div class="error">No posts data available</div>';
        }
        
        // Используем slice() чтобы не мутировать исходный массив
        const posts = [...this.data.posts].sort((a, b) => {
            const dateA = a.date ? new Date(a.date).getTime() : 0;
            const dateB = b.date ? new Date(b.date).getTime() : 0;
            // Проверяем на валидность дат
            if (isNaN(dateA) || isNaN(dateB)) return 0;
            return dateB - dateA;
        });

        return `
      <section class="main-feed" aria-label="Posts feed">
        ${posts.map(post => this.renderPost(post)).join('')}
      </section>
    `;
    }

    afterRender() {
        // Setup post clicks
        this.setupPostClicks();
    }

    renderPost(post) {
        if (!post) {
            return '';
        }
        
        const screenshots = post.screenshots && Array.isArray(post.screenshots) ? post.screenshots : [];
        const video = post.video && typeof post.video === 'object' ? post.video : { url: '', thumbnail: '', duration: '' };
        
        return `
      <article class="post-card glass" data-post-id="${this.escapeAttribute(post.id || '')}">
        <div class="post-grid">
          <div class="post-main-image">
            <img src="${this.escapeURL(post.mainImage || '')}" alt="${this.escapeAttribute(post.title || '')}" loading="lazy">
          </div>
          <div class="post-content">
            <div class="post-header">
              <h2 class="post-title">${this.escapeHTML(post.title || '')}</h2>
              <span class="post-date">${(() => {
                if (!post.date) return '';
                const date = new Date(post.date);
                return !isNaN(date.getTime()) ? date.toLocaleDateString('ru-RU') : '';
              })()}</span>
            </div>
            <p class="post-description">${this.escapeHTML(post.description || '')}</p>
            <div class="post-screenshots">
              ${screenshots.map((screenshot, idx) => `
                <img src="${this.escapeURL(screenshot)}" alt="${this.escapeAttribute(`Screenshot ${idx + 1}`)}" loading="lazy">
              `).join('')}
            </div>
            <div class="post-video-preview">
              <img src="${this.escapeURL(video.thumbnail || '')}" alt="${this.escapeAttribute('Video preview')}" loading="lazy">
              <div class="video-play-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </article>
    `;
    }

    setupPostClicks() {
        // Remove previous handlers
        this.eventHandlers.filter(h => h.type === 'post-click').forEach(({ element, event, handler }) => {
            if (element && typeof element.removeEventListener === 'function') {
                element.removeEventListener(event, handler);
            }
        });
        this.eventHandlers = this.eventHandlers.filter(h => h.type !== 'post-click');

        document.querySelectorAll('.post-card').forEach(card => {
            const handler = (e) => {
                if (e.target.closest('.post-card')) {
                    const postId = card.dataset.postId;
                    if (!postId) return;
                    
                    if (!this.data || !this.data.posts || !Array.isArray(this.data.posts)) return;
                    
                    const post = this.data.posts.find(p => p && p.id === postId);
                    if (!post) return;

                    // Передаем элемент, который открыл модалку, для возврата фокуса
                    this.openPostModal(post, card);
                }
            };
            this.addEventListener(card, 'click', handler, 'post-click');
        });
    }

    openPostModal(post, triggerElement = null) {
        if (!post) {
            return;
        }
        
        const screenshots = post.screenshots && Array.isArray(post.screenshots) ? post.screenshots : [];
        const video = post.video && typeof post.video === 'object' ? post.video : { url: '', thumbnail: '', duration: '' };
        
        const modalContent = `
      <div class="modal-post">
        <h1 id="modal-title" class="sr-only">${this.escapeHTML(post.title || '')}</h1>
        <div class="modal-post-grid">
          <div class="modal-post-image">
            <img src="${this.escapeURL(post.mainImage || '')}" alt="${this.escapeAttribute(post.title || '')}" loading="lazy">
          </div>
          <div class="modal-post-content">
            <h1 class="modal-post-title">${this.escapeHTML(post.title || '')}</h1>
            <p class="modal-post-description">${this.escapeHTML(post.description || '')}</p>
            <div class="modal-post-screenshots">
              ${screenshots.map((screenshot, idx) => `
                <img src="${this.escapeURL(screenshot)}" alt="${this.escapeAttribute(`Screenshot ${idx + 1}`)}" loading="lazy">
              `).join('')}
            </div>
            <div class="modal-post-video">
              <video controls>
                <source src="${this.escapeURL(video.url || '')}" type="video/mp4">
              </video>
            </div>
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
    }

    cleanup() {
        // Вызываем cleanup родительского класса
        super.cleanup();
    }
}

// MainPage будет создан в Application