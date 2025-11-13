class MainPage {
    constructor() {
        this.data = null;
    }

    async load() {
        try {
            this.data = await dataLoader.loadMain(true);
            this.render();
        } catch (error) {
            this.renderError();
        }
    }

    render() {
        const mainContent = document.getElementById('main-content');
        if (!mainContent) return;

        const posts = this.data.posts.sort((a, b) =>
            new Date(b.date) - new Date(a.date)
        );

        mainContent.innerHTML = `
      <div class="main-feed">
        ${posts.map(post => this.renderPost(post)).join('')}
      </div>
    `;

        // Setup lazy loading
        this.setupLazyLoading();

        // Setup post clicks
        this.setupPostClicks();
    }

    renderPost(post) {
        return `
      <article class="post-card glass" data-post-id="${post.id}">
        <div class="post-grid">
          <div class="post-main-image">
            <img src="${post.mainImage}" alt="${post.title}" loading="lazy">
          </div>
          <div class="post-content">
            <h2 class="post-title">${post.title}</h2>
            <p class="post-description">${post.description}</p>
            <div class="post-screenshots">
              ${post.screenshots.map((screenshot, idx) => `
                <img src="${screenshot}" alt="Screenshot ${idx + 1}" loading="lazy">
              `).join('')}
            </div>
            <div class="post-video-preview">
              <img src="${post.video.thumbnail}" alt="Video preview" loading="lazy">
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

    setupLazyLoading() {
        const images = document.querySelectorAll('img[loading="lazy"]');
        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                    }
                    imageObserver.unobserve(img);
                }
            });
        });

        images.forEach(img => imageObserver.observe(img));
    }

    setupPostClicks() {
        document.querySelectorAll('.post-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.post-card')) {
                    const postId = card.dataset.postId;
                    const post = this.data.posts.find(p => p.id === postId);
                    if (post) {
                        this.openPostModal(post);
                    }
                }
            });
        });
    }

    openPostModal(post) {
        const modalContent = `
      <div class="modal-post">
        <div class="modal-post-grid">
          <div class="modal-post-image">
            <img src="${post.mainImage}" alt="${post.title}">
          </div>
          <div class="modal-post-content">
            <h2 class="modal-post-title">${post.title}</h2>
            <p class="modal-post-description">${post.description}</p>
            <div class="modal-post-screenshots">
              ${post.screenshots.map((screenshot, idx) => `
                <img src="${screenshot}" alt="Screenshot ${idx + 1}">
              `).join('')}
            </div>
            <div class="modal-post-video">
              <video controls>
                <source src="${post.video.url}" type="video/mp4">
              </video>
            </div>
          </div>
        </div>
      </div>
    `;

        modal.open(modalContent);
    }

    renderError() {
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.innerHTML = '<div class="error">Ошибка загрузки данных</div>';
        }
    }
}

const mainPage = new MainPage();