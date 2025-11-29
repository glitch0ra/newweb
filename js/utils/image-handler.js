// Image error handler
let imageErrorHandler = null;
let imageErrorInitHandler = null;

function setupImageErrorHandling() {
  // Сохраняем ссылку на обработчик для возможного cleanup
  imageErrorHandler = (e) => {
    if (e && e.target && e.target.tagName === 'IMG') {
      const img = e.target;
      if (!img.dataset.errorHandled) {
        img.dataset.errorHandled = 'true';
        img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMWExYTFhIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iI2Y4MDNmYyIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBmb3VuZDwvdGV4dD48L3N2Zz4=';
        img.alt = 'Image not found';
        img.style.border = '2px solid #f803fc';
        img.style.opacity = '0.7';
      }
    }
  };
  
  if (typeof document.addEventListener === 'function') {
    document.addEventListener('error', imageErrorHandler, true);
  }
}

/**
 * Очищает обработчики ошибок изображений (обычно не требуется, но может быть полезно для тестирования)
 */
function cleanupImageErrorHandling() {
  if (imageErrorHandler && typeof document.removeEventListener === 'function') {
    document.removeEventListener('error', imageErrorHandler, true);
    imageErrorHandler = null;
  }
  if (imageErrorInitHandler && typeof document.removeEventListener === 'function') {
    document.removeEventListener('DOMContentLoaded', imageErrorInitHandler);
    imageErrorInitHandler = null;
  }
}

// Initialize on load
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    imageErrorInitHandler = setupImageErrorHandling;
    if (typeof document.addEventListener === 'function') {
      document.addEventListener('DOMContentLoaded', imageErrorInitHandler);
    }
  } else {
    setupImageErrorHandling();
  }
}


