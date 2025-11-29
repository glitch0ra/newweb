// Preloader for images and videos

// Полифилл для performance.now() для совместимости с Safari 14
// В Safari 14 есть баги с performance.now(), поэтому используем Date.now() как fallback
// Использование: const startTime = performance.now ? performance.now() : Date.now();

class Preloader {
  constructor() {
    // Используем Map вместо Set для хранения timestamp загрузки
    // Это позволяет реализовать LRU кэш с автоматической очисткой старых записей
    this.loadedImages = new Map(); // key: url, value: timestamp
    this.loadedVideos = new Map(); // key: url, value: timestamp
    this.loadingPromises = [];
    
    // Максимальный размер кэша для предотвращения утечки памяти
    // При превышении лимита удаляются самые старые записи (LRU)
    this.maxCacheSize = 100; // Лимит для каждого типа медиа (изображения и видео отдельно)
  }

  preloadImage(src) {
    // Проверяем, не превышен ли лимит кэша, и очищаем старые записи при необходимости
    if (this.loadedImages.size >= this.maxCacheSize) {
      this.cleanupOldEntries(this.loadedImages);
    }
    
    if (this.loadedImages.has(src)) {
      // Обновляем timestamp для LRU
      this.loadedImages.set(src, Date.now());
      return Promise.resolve();
    }

    // Проверяем, загружено ли уже изображение в браузере
    // Ищем существующие img элементы с таким же src
    if (typeof document !== 'undefined' && typeof document.querySelectorAll === 'function') {
      const existingImg = Array.from(document.querySelectorAll('img')).find(img => img.src === src || img.getAttribute('src') === src);
      if (existingImg && existingImg.complete && existingImg.naturalWidth > 0) {
        // Изображение уже загружено в браузере
        this.loadedImages.set(src, Date.now());
        return Promise.resolve();
      }
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.loadedImages.set(src, Date.now());
        resolve();
      };
      img.onerror = () => {
        resolve(); // Resolve anyway to not block
      };
      img.src = src;
    });
  }

  preloadVideo(src) {
    // Проверяем, не превышен ли лимит кэша, и очищаем старые записи при необходимости
    if (this.loadedVideos.size >= this.maxCacheSize) {
      this.cleanupOldEntries(this.loadedVideos);
    }
    
    if (this.loadedVideos.has(src)) {
      // Обновляем timestamp для LRU
      this.loadedVideos.set(src, Date.now());
      return Promise.resolve();
    }

    // Проверяем, загружено ли уже видео в браузере
    // Ищем существующие video элементы с таким же src
    if (typeof document !== 'undefined' && typeof document.querySelectorAll === 'function') {
      const existingVideo = Array.from(document.querySelectorAll('video')).find(video => {
        const source = video.querySelector('source');
        return (source && (source.src === src || source.getAttribute('src') === src)) ||
               (video.src === src || video.getAttribute('src') === src);
      });
      if (existingVideo && existingVideo.readyState >= 2) {
        // Видео уже загружено в браузере (readyState >= 2 означает, что метаданные загружены)
        this.loadedVideos.set(src, Date.now());
        return Promise.resolve();
      }
    }

    return new Promise((resolve) => {
      if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
        resolve();
        return;
      }
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        this.loadedVideos.set(src, Date.now());
        resolve();
      };
      video.onerror = () => {
        resolve(); // Resolve anyway to not block
      };
      video.src = src;
    });
  }

  /**
   * Извлекает все URL медиа из данных для предзагрузки
   * @param {Object} data - данные для извлечения URL
   * @returns {Object} объект с массивами imageUrls и videoUrls
   */
  extractMediaUrls(data) {
    const imageUrls = [];
    const videoUrls = [];

    // Extract all image URLs
    if (data.posts) {
      data.posts.forEach(post => {
        if (post.mainImage) imageUrls.push(post.mainImage);
        if (post.screenshots) {
          post.screenshots.forEach(screenshot => {
            imageUrls.push(screenshot);
          });
        }
        if (post.video?.thumbnail) imageUrls.push(post.video.thumbnail);
        if (post.video?.url) videoUrls.push(post.video.url);
      });
    }

    if (data.collections) {
      data.collections.forEach(collection => {
        collection.images?.forEach(image => {
          if (image.url) imageUrls.push(image.url);
          if (image.screenshots) {
            image.screenshots.forEach(screenshot => {
              imageUrls.push(screenshot);
            });
          }
          if (image.videos) {
            image.videos.forEach(video => {
              if (video.thumbnail) imageUrls.push(video.thumbnail);
              if (video.url) videoUrls.push(video.url);
            });
          }
        });
      });
    }

    if (data.groups) {
      data.groups.forEach(group => {
        if (group.screenshots) {
          group.screenshots.forEach(screenshot => {
            imageUrls.push(screenshot);
          });
        }
        if (group.videos) {
          group.videos.forEach(video => {
            if (video.thumbnail) imageUrls.push(video.thumbnail);
            if (video.url) videoUrls.push(video.url);
          });
        }
      });
    }

    if (data.entries) {
      data.entries.forEach(entry => {
        if (entry.images) {
          entry.images.forEach(image => {
            imageUrls.push(image);
          });
        }
      });
    }

    if (data.profile?.avatar) {
      imageUrls.push(data.profile.avatar);
    }

    return { imageUrls, videoUrls };
  }

  /**
   * Предзагружает медиа из данных асинхронно, не блокируя рендеринг
   * Использует Background Sync API если доступен, иначе fallback на requestIdleCallback
   * @param {Object} data - данные для предзагрузки
   * @returns {Promise} Promise, который резолвится после регистрации предзагрузки
   */
  async preloadFromData(data) {
    const { imageUrls, videoUrls } = this.extractMediaUrls(data);
    
    // Используем fallback метод для асинхронной предзагрузки
    // Это не блокирует рендеринг и выполняется в фоновом режиме
    this.preloadFromDataFallback(imageUrls, videoUrls);
    return Promise.resolve();
  }

  /**
   * Fallback метод для предзагрузки медиа без Background Sync API
   * Использует requestIdleCallback или отложенную предзагрузку
   * @param {Array} imageUrls - массив URL изображений
   * @param {Array} videoUrls - массив URL видео
   */
  preloadFromDataFallback(imageUrls, videoUrls) {
    // Фильтруем уже загруженные медиа, чтобы не загружать их повторно
    const unloadedImageUrls = imageUrls.filter(url => !this.loadedImages.has(url));
    const unloadedVideoUrls = videoUrls.filter(url => !this.loadedVideos.has(url));
    
    // Проверяем лимиты кэша перед началом загрузки
    if (this.loadedImages.size >= this.maxCacheSize) {
      this.cleanupOldEntries(this.loadedImages);
    }
    if (this.loadedVideos.size >= this.maxCacheSize) {
      this.cleanupOldEntries(this.loadedVideos);
    }
    
    // Если все медиа уже загружены, не делаем ничего
    if (unloadedImageUrls.length === 0 && unloadedVideoUrls.length === 0) {
      return;
    }
    
    const allUrls = [
      ...unloadedImageUrls.map(url => ({ type: 'image', url })),
      ...unloadedVideoUrls.map(url => ({ type: 'video', url }))
    ];

    // Если нечего загружать, выходим
    if (allUrls.length === 0) {
      return;
    }

    const batchSize = window.APP_CONFIG?.PRELOADER?.BATCH_SIZE || 5;
    
    const loadBatch = (startIndex) => {
      const endIndex = Math.min(startIndex + batchSize, allUrls.length);
      const batch = allUrls.slice(startIndex, endIndex);
      
      if (batch.length > 0) {
        // Загружаем батч асинхронно, не блокируя рендеринг
        batch.forEach(({ type, url }) => {
          if (type === 'image') {
            this.preloadImage(url).catch(() => {});
          } else {
            this.preloadVideo(url).catch(() => {});
          }
        });
        
        // Загружаем следующий батч в следующем idle периоде
        if (endIndex < allUrls.length) {
          if ('requestIdleCallback' in window) {
            requestIdleCallback(() => {
              loadBatch(endIndex);
            }, { timeout: 2000 });
          } else {
            // Fallback на setTimeout для браузеров без requestIdleCallback
            setTimeout(() => {
              loadBatch(endIndex);
            }, 100);
          }
        }
      }
    };
    
    // Начинаем загрузку после того, как браузер освободится
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        loadBatch(0);
      }, { timeout: 2000 });
    } else {
      // Fallback на setTimeout
      setTimeout(() => {
        loadBatch(0);
      }, 100);
    }
  }

  /**
   * Очищает старые записи из кэша (LRU - Least Recently Used)
   * Удаляет 20% самых старых записей при превышении лимита
   * @param {Map} cache - кэш для очистки (loadedImages или loadedVideos)
   */
  cleanupOldEntries(cache) {
    if (!cache || cache.size < this.maxCacheSize) {
      return;
    }

    // Вычисляем количество записей для удаления (20% от maxCacheSize)
    const entriesToRemove = Math.ceil(this.maxCacheSize * 0.2);
    
    // Создаем массив записей с timestamp для сортировки
    const entries = Array.from(cache.entries()).map(([url, timestamp]) => ({
      url,
      timestamp
    }));
    
    // Сортируем по timestamp (старые первыми)
    entries.sort((a, b) => a.timestamp - b.timestamp);
    
    // Удаляем самые старые записи
    for (let i = 0; i < entriesToRemove && i < entries.length; i++) {
      cache.delete(entries[i].url);
    }
  }
}

// Preloader будет создан в Application

