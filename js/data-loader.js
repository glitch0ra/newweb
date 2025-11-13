class DataLoader {
    constructor() {
        this.cache = {};
    }

    async loadJSON(path, showLoader = false) {
        if (this.cache[path]) {
            return this.cache[path];
        }

        const mainContent = document.getElementById('main-content');

        if (showLoader && mainContent && window.LoaderAnimation) {
            LoaderAnimation.show(mainContent);
        }

        try {
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            this.cache[path] = data;

            // Preload media from this data
            if (window.preloader) {
                // Don't await to not block rendering
                window.preloader.preloadFromData(data).catch(err => {
                    console.warn('Preload error:', err);
                });
            }

            if (showLoader && mainContent && window.LoaderAnimation) {
                LoaderAnimation.hide(mainContent);
            }

            return data;
        } catch (error) {
            console.error(`Error loading ${path}:`, error);
            if (showLoader && mainContent && window.LoaderAnimation) {
                LoaderAnimation.hide(mainContent);
            }
            // Show user-friendly error message
            if (mainContent) {
                mainContent.innerHTML = `
          <div class="error">
            <p>Data loading error</p>
            <p style="font-size: 0.8rem; margin-top: 0.5rem;">Failed to load: ${path}</p>
          </div>
        `;
            }
            throw error;
        }
    }

    async loadMain(showLoader = true) {
        return this.loadJSON('data/main.json', showLoader);
    }

    async loadCollections(showLoader = true) {
        return this.loadJSON('data/collections.json', showLoader);
    }

    async loadScreenshots(showLoader = true) {
        return this.loadJSON('data/screenshots.json', showLoader);
    }

    async loadVideos(showLoader = true) {
        return this.loadJSON('data/videos.json', showLoader);
    }

    async loadHistory(showLoader = true) {
        return this.loadJSON('data/history.json', showLoader);
    }

    async loadAbout(showLoader = true) {
        return this.loadJSON('data/about.json', showLoader);
    }
}

const dataLoader = new DataLoader();