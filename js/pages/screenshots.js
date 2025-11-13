class ScreenshotsPage {
    constructor() {
        this.data = null;
    }

    async load() {
        try {
            this.data = await dataLoader.loadScreenshots(true);
            this.render();
        } catch (error) {
            this.renderError();
        }
    }

    render() {
        const mainContent = document.getElementById('main-content');
        if (!mainContent) return;

        mainContent.innerHTML = `
      <div class="screenshots-feed">
        ${this.data.groups.map(group => this.renderGroup(group)).join('')}
      </div>
    `;

        // Setup expand/collapse
        this.setupExpandCollapse();

        // Setup screenshot clicks
        this.setupScreenshotClicks();
    }

    renderGroup(group) {
        const firstSix = group.screenshots.slice(0, 6);
        const total = group.screenshots.length;
        const itemsPerPage = 18; // 3 rows * 6 items
        const pages = Math.ceil(total / itemsPerPage);

        return `
      <div class="screenshot-group glass" data-group-id="${group.id}">
        <div class="group-header">
          <h2 class="group-title">${group.title}</h2>
          ${group.date ? `<span class="group-date">${new Date(group.date).toLocaleDateString('ru-RU')}</span>` : ''}
        </div>
        <p class="group-description">${group.description}</p>
        <div class="screenshot-group-preview">
          ${firstSix.map((screenshot, idx) => `
            <img src="${screenshot}" alt="Screenshot ${idx + 1}" class="screenshot-item" data-group-id="${group.id}" data-index="${idx}" loading="lazy">
          `).join('')}
        </div>
        <button class="group-expand-btn" data-group-id="${group.id}">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
            <path d="M7 10l5 5 5-5z"/>
          </svg>
        </button>
        <div class="screenshot-group-expanded" style="display: none;">
          ${this.renderExpandedGroup(group, pages, itemsPerPage)}
        </div>
      </div>
    `;
    }

    renderExpandedGroup(group, pages, itemsPerPage) {
        let html = '';
        const paginationHtml = pages > 1 ? `
          <div class="screenshot-pagination">
            ${Array.from({ length: pages }, (_, i) => `
              <button class="pagination-dot ${i === 0 ? 'active' : ''}" data-page="${i}">
                ${i + 1}
              </button>
            `).join('')}
          </div>
        ` : '';

        for (let page = 0; page < pages; page++) {
            const startIdx = page * itemsPerPage;
            const endIdx = Math.min(startIdx + itemsPerPage, group.screenshots.length);
            const pageScreenshots = group.screenshots.slice(startIdx, endIdx);

            html += `
        <div class="screenshot-page" data-page="${page}" style="display: ${page === 0 ? 'grid' : 'none'};">
          ${pageScreenshots.map((screenshot, idx) => `
            <img src="${screenshot}" alt="Screenshot ${startIdx + idx + 1}" class="screenshot-item" data-group-id="${group.id}" data-index="${startIdx + idx}" loading="lazy">
          `).join('')}
        </div>
      `;
        }
        
        return html + paginationHtml;
    }

    setupExpandCollapse() {
        document.querySelectorAll('.group-expand-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const groupId = btn.dataset.groupId;
                const group = document.querySelector(`.screenshot-group[data-group-id="${groupId}"]`);
                const expanded = group.querySelector('.screenshot-group-expanded');
                const isExpanded = expanded.style.display !== 'none';

                if (isExpanded) {
                    expanded.style.display = 'none';
                    btn.style.transform = 'rotate(0deg)';
                } else {
                    expanded.style.display = 'block';
                    btn.style.transform = 'rotate(180deg)';
                    // Setup pagination after expanding
                    this.setupPagination(groupId);
                }
            });
        });
    }

    setupPagination(groupId) {
        const group = document.querySelector(`.screenshot-group[data-group-id="${groupId}"]`);
        const expanded = group.querySelector('.screenshot-group-expanded');
        const dots = expanded.querySelectorAll('.pagination-dot');
        const pages = expanded.querySelectorAll('.screenshot-page');

        dots.forEach(dot => {
            dot.addEventListener('click', (e) => {
                e.stopPropagation();
                const page = parseInt(dot.dataset.page);

                pages.forEach((p, idx) => {
                    p.style.display = idx === page ? 'grid' : 'none';
                });

                dots.forEach((d, idx) => {
                    d.classList.toggle('active', idx === page);
                });
            });
        });
    }

    setupScreenshotClicks() {
        document.querySelectorAll('.screenshot-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const groupId = item.dataset.groupId;
                const index = parseInt(item.dataset.index);

                const group = this.data.groups.find(g => g.id === groupId);
                if (group) {
                    this.openScreenshotModal(group, index);
                }
            });
        });
    }

    openScreenshotModal(group, startIndex) {
        const screenshots = group.screenshots;
        let currentIndex = startIndex;

        const modalContent = `
      <div class="modal-screenshot-viewer">
        <div class="screenshot-viewer-container">
          <img src="${screenshots[currentIndex]}" alt="Screenshot ${currentIndex + 1}" class="screenshot-viewer-image">
          <div class="screenshot-viewer-nav">
            <button class="carousel-nav prev screenshot-nav" id="screenshot-prev">‹</button>
            <button class="carousel-nav next screenshot-nav" id="screenshot-next">›</button>
          </div>
          <div class="screenshot-viewer-counter">
            ${currentIndex + 1} из ${screenshots.length}
          </div>
        </div>
      </div>
    `;

        modal.open(modalContent);

        const updateImage = () => {
            document.querySelector('.screenshot-viewer-image').src = screenshots[currentIndex];
            document.querySelector('.screenshot-viewer-counter').textContent = `${currentIndex + 1} из ${screenshots.length}`;
        };

        document.getElementById('screenshot-prev')?.addEventListener('click', () => {
            currentIndex = (currentIndex - 1 + screenshots.length) % screenshots.length;
            updateImage();
        });

        document.getElementById('screenshot-next')?.addEventListener('click', () => {
            currentIndex = (currentIndex + 1) % screenshots.length;
            updateImage();
        });

        // Keyboard navigation
        const handleKeyPress = (e) => {
            if (e.key === 'ArrowLeft') {
                currentIndex = (currentIndex - 1 + screenshots.length) % screenshots.length;
                updateImage();
            } else if (e.key === 'ArrowRight') {
                currentIndex = (currentIndex + 1) % screenshots.length;
                updateImage();
            }
        };

        modal.setKeyboardHandler(handleKeyPress);
    }

    renderError() {
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.innerHTML = '<div class="error">Ошибка загрузки данных</div>';
        }
    }
}

const screenshotsPage = new ScreenshotsPage();