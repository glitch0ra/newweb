class VideosPage {
    constructor() {
        this.data = null;
    }

    async load() {
        try {
            this.data = await dataLoader.loadVideos(true);
            this.render();
        } catch (error) {
            this.renderError();
        }
    }

    render() {
        const mainContent = document.getElementById('main-content');
        if (!mainContent) return;

        mainContent.innerHTML = `
      <div class="videos-feed">
        ${this.data.groups.map(group => this.renderGroup(group)).join('')}
      </div>
    `;

        // Setup expand/collapse
        this.setupExpandCollapse();

        // Setup video clicks
        this.setupVideoClicks();
    }

    renderGroup(group) {
        const firstSix = group.videos.slice(0, 6);
        const total = group.videos.length;
        const itemsPerPage = 18; // 3 rows * 6 items
        const pages = Math.ceil(total / itemsPerPage);

        return `
      <div class="video-group glass" data-group-id="${group.id}">
        <div class="group-header">
          <h2 class="group-title">${group.title}</h2>
          ${group.date ? `<span class="group-date">${new Date(group.date).toLocaleDateString('ru-RU')}</span>` : ''}
        </div>
        <p class="group-description">${group.description}</p>
        <div class="video-group-preview">
          ${firstSix.map((video, idx) => `
            <div class="video-item" data-group-id="${group.id}" data-index="${idx}">
              <img src="${video.thumbnail}" alt="${video.title}" class="video-thumbnail" loading="lazy">
              <div class="video-play-overlay">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
              <div class="video-duration">${video.duration}</div>
            </div>
          `).join('')}
        </div>
        <button class="group-expand-btn" data-group-id="${group.id}">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
            <path d="M7 10l5 5 5-5z"/>
          </svg>
        </button>
        <div class="video-group-expanded" style="display: none;">
          ${this.renderExpandedGroup(group, pages, itemsPerPage)}
        </div>
      </div>
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

        for (let page = 0; page < pages; page++) {
            const startIdx = page * itemsPerPage;
            const endIdx = Math.min(startIdx + itemsPerPage, group.videos.length);
            const pageVideos = group.videos.slice(startIdx, endIdx);

            html += `
        <div class="video-page" data-page="${page}" style="display: ${page === 0 ? 'grid' : 'none'};">
          ${pageVideos.map((video, idx) => `
            <div class="video-item" data-group-id="${group.id}" data-index="${startIdx + idx}">
              <img src="${video.thumbnail}" alt="${video.title}" class="video-thumbnail" loading="lazy">
              <div class="video-play-overlay">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
              <div class="video-duration">${video.duration}</div>
            </div>
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
                const group = document.querySelector(`.video-group[data-group-id="${groupId}"]`);
                const expanded = group.querySelector('.video-group-expanded');
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
        const group = document.querySelector(`.video-group[data-group-id="${groupId}"]`);
        const expanded = group.querySelector('.video-group-expanded');
        const dots = expanded.querySelectorAll('.pagination-dot');
        const pages = expanded.querySelectorAll('.video-page');

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

    setupVideoClicks() {
        document.querySelectorAll('.video-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const groupId = item.dataset.groupId;
                const index = parseInt(item.dataset.index);

                const group = this.data.groups.find(g => g.id === groupId);
                if (group) {
                    this.openVideoModal(group, index);
                }
            });
        });
    }

    openVideoModal(group, startIndex) {
        const videos = group.videos;
        let currentIndex = startIndex;

        const modalContent = `
      <div class="modal-video-viewer">
        <div class="video-viewer-wrapper">
          <button class="carousel-nav prev video-nav" id="video-prev">‹</button>
          <div class="video-viewer-container">
            <video controls class="video-viewer-video" id="video-viewer">
              <source src="${videos[currentIndex].url}" type="video/mp4">
            </video>
            <div class="video-viewer-title">${videos[currentIndex].title}</div>
          </div>
          <button class="carousel-nav next video-nav" id="video-next">›</button>
        </div>
      </div>
    `;

        modal.open(modalContent);

        const videoEl = document.getElementById('video-viewer');

        const updateVideo = () => {
            videoEl.src = videos[currentIndex].url;
            videoEl.load();
            document.querySelector('.video-viewer-title').textContent = videos[currentIndex].title;
        };

        document.getElementById('video-prev') ?.addEventListener('click', () => {
            currentIndex = (currentIndex - 1 + videos.length) % videos.length;
            updateVideo();
        });

        document.getElementById('video-next') ?.addEventListener('click', () => {
            currentIndex = (currentIndex + 1) % videos.length;
            updateVideo();
        });

        // Keyboard navigation
        const handleKeyPress = (e) => {
            if (e.key === 'ArrowLeft') {
                currentIndex = (currentIndex - 1 + videos.length) % videos.length;
                updateVideo();
            } else if (e.key === 'ArrowRight') {
                currentIndex = (currentIndex + 1) % videos.length;
                updateVideo();
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

const videosPage = new VideosPage();