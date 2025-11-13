// Preloader for images and videos
class Preloader {
  constructor() {
    this.loadedImages = new Set();
    this.loadedVideos = new Set();
    this.loadingPromises = [];
  }

  preloadImage(src) {
    if (this.loadedImages.has(src)) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.loadedImages.add(src);
        resolve();
      };
      img.onerror = () => {
        console.warn(`Failed to preload image: ${src}`);
        resolve(); // Resolve anyway to not block
      };
      img.src = src;
    });
  }

  preloadVideo(src) {
    if (this.loadedVideos.has(src)) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        this.loadedVideos.add(src);
        resolve();
      };
      video.onerror = () => {
        console.warn(`Failed to preload video: ${src}`);
        resolve(); // Resolve anyway to not block
      };
      video.src = src;
    });
  }

  async preloadFromData(data) {
    const promises = [];

    // Extract all image URLs
    if (data.posts) {
      data.posts.forEach(post => {
        if (post.mainImage) promises.push(this.preloadImage(post.mainImage));
        if (post.screenshots) {
          post.screenshots.forEach(screenshot => {
            promises.push(this.preloadImage(screenshot));
          });
        }
        if (post.video?.thumbnail) promises.push(this.preloadImage(post.video.thumbnail));
        if (post.video?.url) promises.push(this.preloadVideo(post.video.url));
      });
    }

    if (data.collections) {
      data.collections.forEach(collection => {
        collection.images?.forEach(image => {
          if (image.url) promises.push(this.preloadImage(image.url));
          if (image.screenshots) {
            image.screenshots.forEach(screenshot => {
              promises.push(this.preloadImage(screenshot));
            });
          }
          if (image.videos) {
            image.videos.forEach(video => {
              if (video.thumbnail) promises.push(this.preloadImage(video.thumbnail));
              if (video.url) promises.push(this.preloadVideo(video.url));
            });
          }
        });
      });
    }

    if (data.groups) {
      data.groups.forEach(group => {
        if (group.screenshots) {
          group.screenshots.forEach(screenshot => {
            promises.push(this.preloadImage(screenshot));
          });
        }
        if (group.videos) {
          group.videos.forEach(video => {
            if (video.thumbnail) promises.push(this.preloadImage(video.thumbnail));
            if (video.url) promises.push(this.preloadVideo(video.url));
          });
        }
      });
    }

    if (data.entries) {
      data.entries.forEach(entry => {
        if (entry.images) {
          entry.images.forEach(image => {
            promises.push(this.preloadImage(image));
          });
        }
      });
    }

    if (data.profile?.avatar) {
      promises.push(this.preloadImage(data.profile.avatar));
    }

    // Load in batches to not overwhelm the browser
    // Use requestIdleCallback if available for better performance
    const batchSize = 5;
    
    const loadBatch = async (startIndex) => {
      const endIndex = Math.min(startIndex + batchSize, promises.length);
      const batch = promises.slice(startIndex, endIndex);
      
      if (batch.length > 0) {
        await Promise.all(batch);
        
        // Load next batch asynchronously
        if (endIndex < promises.length) {
          if (window.requestIdleCallback) {
            window.requestIdleCallback(() => {
              loadBatch(endIndex);
            }, { timeout: 1000 });
          } else {
            setTimeout(() => loadBatch(endIndex), 50);
          }
        }
      }
    };
    
    // Start loading first batch immediately
    loadBatch(0);
  }
}

const preloader = new Preloader();

