// Loading animation component
class LoaderAnimation {
  static create() {
    return `
      <div class="loader-container">
        <div class="loader-spinner">
          <div class="spinner-ring"></div>
          <div class="spinner-ring"></div>
          <div class="spinner-ring"></div>
          <div class="spinner-ring"></div>
        </div>
      </div>
    `;
  }

  static show(container) {
    if (!container) return;
    container.innerHTML = this.create();
  }

  static hide(container) {
    if (!container || typeof container.querySelector !== 'function') return;
    const loader = container.querySelector('.loader-container');
    if (!loader) return;

    // Устанавливаем transition для анимации исчезновения
    loader.style.transition = 'opacity 0.3s ease';
    loader.style.opacity = '0';
    
    // Используем transitionend вместо setTimeout/requestAnimationFrame
    // Это предотвращает "jank" и синхронизировано с браузером
    let transitionEndHandled = false;
    let fallbackTimeout = null;
    
    const handleTransitionEnd = (e) => {
      // Проверяем, что это именно transition для opacity и для правильного элемента
      // e.target === loader гарантирует, что событие пришло от нужного элемента
      if (e && e.target === loader && e.propertyName === 'opacity' && !transitionEndHandled) {
        transitionEndHandled = true;
        
        // Очищаем fallback timeout
        if (fallbackTimeout) {
          clearTimeout(fallbackTimeout);
          fallbackTimeout = null;
        }
        
        // Удаляем обработчик перед удалением элемента
        if (typeof loader.removeEventListener === 'function') {
          loader.removeEventListener('transitionend', handleTransitionEnd);
        }
        
        // Удаляем элемент только если он все еще в DOM
        if (loader.parentNode && typeof loader.remove === 'function') {
          loader.remove();
        }
      }
    };
    
    // Добавляем обработчик transitionend
    if (typeof loader.addEventListener === 'function') {
      loader.addEventListener('transitionend', handleTransitionEnd);
    }
    
    // Fallback timeout на случай, если transitionend не сработает
    // (например, если transition был отменен, элемент был удален, или браузер не поддерживает transitionend)
    // Используем более надежную проверку: проверяем, что loader все еще существует и в DOM
    fallbackTimeout = setTimeout(() => {
      if (!transitionEndHandled) {
        // Проверяем, что loader все еще существует и в DOM
        if (loader && loader.parentNode) {
          transitionEndHandled = true;
          
          // Удаляем обработчик перед удалением элемента
          if (typeof loader.removeEventListener === 'function') {
            loader.removeEventListener('transitionend', handleTransitionEnd);
          }
          
          // Удаляем элемент
          if (typeof loader.remove === 'function') {
            loader.remove();
          }
        }
      }
      fallbackTimeout = null;
    }, 500); // 300ms transition + 200ms запас для надежности
  }
}

