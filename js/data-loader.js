class DataLoader {
  constructor() {
    this.cache = {};
  }

  async loadJSON(path) {
    if (this.cache[path]) {
      return this.cache[path];
    }

    try {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      this.cache[path] = data;
      return data;
    } catch (error) {
      console.error(`Error loading ${path}:`, error);
      // Show user-friendly error message
      const mainContent = document.getElementById('main-content');
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

  async loadMain() {
    return this.loadJSON('data/main.json');
  }

  async loadCollections() {
    return this.loadJSON('data/collections.json');
  }

  async loadScreenshots() {
    return this.loadJSON('data/screenshots.json');
  }

  async loadVideos() {
    return this.loadJSON('data/videos.json');
  }

  async loadHistory() {
    return this.loadJSON('data/history.json');
  }

  async loadAbout() {
    return this.loadJSON('data/about.json');
  }
}

const dataLoader = new DataLoader();

