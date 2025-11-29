class HistoryPage extends Page {
    constructor(store, dataLoader) {
        super(store);
        this.dataLoader = dataLoader;
        this.carousels = [];
    }

    getRoute() {
        return 'history';
    }

    async loadData(showLoader = true, forceReload = false, signal = null) {
        return await this.dataLoader.loadHistory(showLoader, signal);
    }

    renderContent() {
        if (!this.data || !this.data.entries || !Array.isArray(this.data.entries)) {
            return '<div class="error">No history data available</div>';
        }
        
        return `
      <div class="history-feed">
        ${this.data.entries.map(entry => this.renderEntry(entry)).join('')}
      </div>
    `;
    }

    afterRender() {
        // Setup carousels
        this.setupCarousels();
    }

    renderEntry(entry) {
        if (!entry) {
            return '';
        }
        
        const images = entry.images && Array.isArray(entry.images) ? entry.images : [];
        
        return `
      <div class="history-entry glass">
        <div class="history-grid">
          <div class="history-images">
            <div class="history-carousel-wrapper">
              <div class="history-carousel carousel" data-entry-id="${this.escapeAttribute(entry.id || '')}">
                <div class="carousel-container">
                  ${images.map(image => `
                    <div class="carousel-item history-image">
                      <img src="${this.escapeURL(image)}" alt="${this.escapeAttribute('History image')}" loading="lazy">
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
          </div>
          <div class="history-content">
            <h2 class="history-title">${this.escapeHTML(entry.title || '')}</h2>
            <p class="history-description">${this.escapeHTML(entry.description || '')}</p>
          </div>
        </div>
      </div>
    `;
    }

    setupCarousels() {
        // Destroy previous carousels только если они еще не уничтожены
        this.carousels.forEach(carousel => {
            if (carousel && typeof carousel.destroy === 'function' && carousel.container) {
                carousel.destroy();
            }
        });
        this.carousels = [];

        // Используем requestAnimationFrame вместо setTimeout для лучшей производительности
        // Это предотвращает избыточные перерисовки
        requestAnimationFrame(() => {
            document.querySelectorAll('.history-carousel').forEach(carouselEl => {
                const carousel = new Carousel(carouselEl, {
                    itemsPerView: 1,
                    loop: true,
                    draggable: true
                });
                this.carousels.push(carousel);
            });
        });
    }

    cleanup() {
        // Destroy all carousels
        this.carousels.forEach(carousel => {
            if (carousel && typeof carousel.destroy === 'function') {
                carousel.destroy();
            }
        });
        this.carousels = [];

        // Вызываем cleanup родительского класса
        super.cleanup();
    }
}

// HistoryPage будет создан в Application