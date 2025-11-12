class CollectionsPage {
  constructor() {
    this.data = null;
  }

  async load() {
    try {
      this.data = await dataLoader.loadCollections();
      this.render();
    } catch (error) {
      this.renderError();
    }
  }

  render() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    mainContent.innerHTML = `
      <div class="collections-feed">
        ${this.data.collections.map(collection => this.renderCollection(collection)).join('')}
      </div>
    `;

    // Setup carousels
    this.setupCarousels();
    
    // Setup image clicks
    this.setupImageClicks();
  }

  renderCollection(collection) {
    return `
      <div class="collection-block glass">
        <h2 class="collection-title">${collection.title}</h2>
        <p class="collection-description">${collection.description}</p>
        <div class="collection-carousel carousel" data-collection-id="${collection.id}">
          <div class="carousel-container">
            ${collection.images.map(image => `
              <div class="carousel-item collection-image-card" data-image-id="${image.id}">
                <img src="${image.url}" alt="${image.title}" loading="lazy">
                <div class="image-title-overlay">${image.title}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  setupCarousels() {
    document.querySelectorAll('.collection-carousel').forEach(carouselEl => {
      const itemsPerView = window.innerWidth > 1023 ? 3 : window.innerWidth > 767 ? 2 : 1;
      new Carousel(carouselEl, { itemsPerView, loop: true, draggable: true });
    });
  }

  setupImageClicks() {
    document.querySelectorAll('.collection-image-card').forEach(card => {
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        const imageId = card.dataset.imageId;
        const collectionId = card.closest('.collection-carousel')?.dataset.collectionId;
        
        const collection = this.data.collections.find(c => c.id === collectionId);
        const image = collection?.images.find(img => img.id === imageId);
        
        if (image) {
          this.openImageModal(image);
        }
      });
    });
  }

  openImageModal(image) {
    const modalContent = `
      <div class="modal-collection-image">
        <div class="modal-collection-grid">
          <div class="modal-collection-left">
            <div class="modal-collection-main-image">
              <img src="${image.url}" alt="${image.title}">
            </div>
            <div class="modal-collection-video">
              <video controls>
                <source src="${image.videos[0]?.url}" type="video/mp4">
              </video>
            </div>
          </div>
          <div class="modal-collection-right">
            <h2 class="modal-collection-title">${image.title}</h2>
            <p class="modal-collection-description">${image.description}</p>
            <div class="modal-collection-screenshots">
              ${image.screenshots.map((screenshot, idx) => `
                <img src="${screenshot}" alt="Screenshot ${idx + 1}" class="screenshot-thumb" data-screenshot-index="${idx}">
              `).join('')}
            </div>
            <div class="modal-collection-videos">
              ${image.videos.map((video, idx) => `
                <div class="modal-video-item" data-video-index="${idx}">
                  <video muted>
                    <source src="${video.url}" type="video/mp4">
                  </video>
                  <div class="video-play-overlay-small">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="white">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </div>
                </div>
              `).join('')}
            </div>
            <a href="${image.downloadLink}" class="btn" target="_blank">Скачать</a>
          </div>
        </div>
      </div>
    `;
    
    modal.open(modalContent);
    
    // Setup screenshot modal
    this.setupScreenshotModal(image);
    
    // Setup video modal
    this.setupVideoModal(image);
  }

  setupScreenshotModal(image) {
    let currentScreenshotIndex = 0;
    const screenshots = image.screenshots;
    
    document.querySelectorAll('.screenshot-thumb').forEach(thumb => {
      thumb.addEventListener('click', (e) => {
        e.stopPropagation();
        currentScreenshotIndex = parseInt(thumb.dataset.screenshotIndex);
        this.openScreenshotViewer(screenshots, currentScreenshotIndex);
      });
    });
  }

  openScreenshotViewer(screenshots, startIndex) {
    const modalContent = `
      <div class="modal-screenshot-viewer">
        <div class="screenshot-viewer-container">
          <img src="${screenshots[startIndex]}" alt="Screenshot ${startIndex + 1}" class="screenshot-viewer-image">
          <div class="screenshot-viewer-nav">
            <button class="carousel-nav prev screenshot-nav" id="screenshot-prev">‹</button>
            <button class="carousel-nav next screenshot-nav" id="screenshot-next">›</button>
          </div>
          <div class="screenshot-viewer-counter">
            ${startIndex + 1} из ${screenshots.length}
          </div>
        </div>
      </div>
    `;
    
    modal.setContent(modalContent);
    
    let currentIndex = startIndex;
    
    document.getElementById('screenshot-prev')?.addEventListener('click', () => {
      currentIndex = (currentIndex - 1 + screenshots.length) % screenshots.length;
      document.querySelector('.screenshot-viewer-image').src = screenshots[currentIndex];
      document.querySelector('.screenshot-viewer-counter').textContent = `${currentIndex + 1} из ${screenshots.length}`;
    });
    
    document.getElementById('screenshot-next')?.addEventListener('click', () => {
      currentIndex = (currentIndex + 1) % screenshots.length;
      document.querySelector('.screenshot-viewer-image').src = screenshots[currentIndex];
      document.querySelector('.screenshot-viewer-counter').textContent = `${currentIndex + 1} из ${screenshots.length}`;
    });
    
    // Keyboard navigation
    const handleKeyPress = (e) => {
      if (e.key === 'ArrowLeft') {
        currentIndex = (currentIndex - 1 + screenshots.length) % screenshots.length;
        document.querySelector('.screenshot-viewer-image').src = screenshots[currentIndex];
        document.querySelector('.screenshot-viewer-counter').textContent = `${currentIndex + 1} из ${screenshots.length}`;
      } else if (e.key === 'ArrowRight') {
        currentIndex = (currentIndex + 1) % screenshots.length;
        document.querySelector('.screenshot-viewer-image').src = screenshots[currentIndex];
        document.querySelector('.screenshot-viewer-counter').textContent = `${currentIndex + 1} из ${screenshots.length}`;
      }
    };
    
    document.addEventListener('keydown', handleKeyPress);
    
    // Remove listener when modal closes
    const originalClose = modal.close.bind(modal);
    modal.close = () => {
      document.removeEventListener('keydown', handleKeyPress);
      originalClose();
    };
  }

  setupVideoModal(image) {
    let currentVideoIndex = 0;
    const videos = image.videos;
    
    document.querySelectorAll('.modal-video-item').forEach((item, idx) => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        currentVideoIndex = idx;
        this.openVideoViewer(videos, currentVideoIndex);
      });
    });
  }

  openVideoViewer(videos, startIndex) {
    const modalContent = `
      <div class="modal-video-viewer">
        <div class="video-viewer-container">
          <video controls class="video-viewer-video" id="video-viewer">
            <source src="${videos[startIndex].url}" type="video/mp4">
          </video>
          <div class="video-viewer-nav">
            <button class="carousel-nav prev video-nav" id="video-prev">‹</button>
            <button class="carousel-nav next video-nav" id="video-next">›</button>
          </div>
        </div>
      </div>
    `;
    
    modal.setContent(modalContent);
    
    let currentIndex = startIndex;
    const videoEl = document.getElementById('video-viewer');
    
    document.getElementById('video-prev')?.addEventListener('click', () => {
      currentIndex = (currentIndex - 1 + videos.length) % videos.length;
      videoEl.src = videos[currentIndex].url;
      videoEl.load();
    });
    
    document.getElementById('video-next')?.addEventListener('click', () => {
      currentIndex = (currentIndex + 1) % videos.length;
      videoEl.src = videos[currentIndex].url;
      videoEl.load();
    });
    
    // Keyboard navigation
    const handleKeyPress = (e) => {
      if (e.key === 'ArrowLeft') {
        currentIndex = (currentIndex - 1 + videos.length) % videos.length;
        videoEl.src = videos[currentIndex].url;
        videoEl.load();
      } else if (e.key === 'ArrowRight') {
        currentIndex = (currentIndex + 1) % videos.length;
        videoEl.src = videos[currentIndex].url;
        videoEl.load();
      }
    };
    
    document.addEventListener('keydown', handleKeyPress);
    
    // Remove listener when modal closes
    const originalClose = modal.close.bind(modal);
    modal.close = () => {
      document.removeEventListener('keydown', handleKeyPress);
      originalClose();
    };
  }

  renderError() {
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      mainContent.innerHTML = '<div class="error">Ошибка загрузки данных</div>';
    }
  }
}

const collectionsPage = new CollectionsPage();

