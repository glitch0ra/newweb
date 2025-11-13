class HistoryPage {
    constructor() {
        this.data = null;
    }

    async load() {
        try {
            this.data = await dataLoader.loadHistory(true);
            this.render();
        } catch (error) {
            this.renderError();
        }
    }

    render() {
        const mainContent = document.getElementById('main-content');
        if (!mainContent) return;

        mainContent.innerHTML = `
      <div class="history-feed">
        ${this.data.entries.map(entry => this.renderEntry(entry)).join('')}
      </div>
    `;

        // Setup carousels
        this.setupCarousels();
    }

    renderEntry(entry) {
        return `
      <div class="history-entry glass">
        <div class="history-grid">
          <div class="history-images">
            <div class="history-carousel carousel" data-entry-id="${entry.id}">
              <div class="carousel-container">
                ${entry.images.map(image => `
                  <div class="carousel-item history-image">
                    <img src="${image}" alt="History image" loading="lazy">
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
          <div class="history-content">
            <h2 class="history-title">${entry.title}</h2>
            <p class="history-description">${entry.description}</p>
          </div>
        </div>
      </div>
    `;
    }

    setupCarousels() {
        // Wait a bit for DOM to be ready
        setTimeout(() => {
            document.querySelectorAll('.history-carousel').forEach(carouselEl => {
                new Carousel(carouselEl, {
                    itemsPerView: 1,
                    loop: true,
                    draggable: true
                });
            });
        }, 100);
    }

    renderError() {
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.innerHTML = '<div class="error">Ошибка загрузки данных</div>';
        }
    }
}

const historyPage = new HistoryPage();