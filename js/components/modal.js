/**
 * Throttle функция - ограничивает частоту вызовов функции
 * @param {Function} func - функция для throttling
 * @param {number} delay - задержка в миллисекундах
 * @returns {Function}
 */
function throttle(func, delay) {
  let lastCall = 0;
  return function(...args) {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      return func.apply(this, args);
    }
  };
}

class Modal {
  constructor(eventBus = null) {
    this.modal = document.getElementById('modal');
    this.modalContent = document.getElementById('modal-content');
    this.modalClose = document.getElementById('modal-close');
    this.modalOverlay = this.modal?.querySelector('.modal-overlay');
    this.contentStack = []; // Stack for modal content history
    this.previousActiveElement = null; // Store element that opened modal for focus return
    this.focusableElements = null; // Cache for focusable elements
    this.focusTrapHandler = null; // Handler for focus trap
    this.hiddenElements = []; // Store elements that were hidden with aria-hidden
    this.onCloseCallbacks = []; // Callbacks для уведомления о закрытии модалки
    this.keyboardHandler = null; // Handler for keyboard navigation
    this.eventBus = eventBus; // EventBus для событийной архитектуры
    
    this.init();
    this.setupEventListeners();
  }

  init() {
    if (this.modalClose) {
      this.closeHandler = () => this.close();
      this.modalClose.addEventListener('click', this.closeHandler);
    }

    if (this.modalOverlay) {
      this.overlayHandler = () => this.close();
      this.modalOverlay.addEventListener('click', this.overlayHandler);
    }

    // Throttle для ESC - ограничиваем частоту вызовов до 1 раза в 300мс
    this.escapeHandler = throttle((e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        this.close();
      }
    }, 300);
    document.addEventListener('keydown', this.escapeHandler);
  }

  /**
   * Настраивает подписки на события через EventBus
   */
  setupEventListeners() {
    if (!this.eventBus || typeof this.eventBus.on !== 'function') {
      return;
    }

    // Подписываемся на события для открытия/закрытия модалки
    this.eventUnsubscribers = [];
    
    // modal:open - открыть модалку
    this.eventUnsubscribers.push(
      this.eventBus.on('modal:open', (data) => {
        if (data && typeof data === 'object') {
          this.open(data.content, data.triggerElement);
        }
      })
    );

    // modal:close - закрыть модалку
    this.eventUnsubscribers.push(
      this.eventBus.on('modal:close', () => {
        this.close();
      })
    );

    // modal:pushContent - добавить контент в стек
    this.eventUnsubscribers.push(
      this.eventBus.on('modal:pushContent', (data) => {
        if (data && typeof data === 'object' && data.content) {
          this.pushContent(data.content);
        }
      })
    );

    // modal:popContent - вернуть предыдущий контент из стека
    this.eventUnsubscribers.push(
      this.eventBus.on('modal:popContent', () => {
        this.popContent();
      })
    );

    // modal:setKeyboardHandler - установить обработчик клавиатуры
    this.eventUnsubscribers.push(
      this.eventBus.on('modal:setKeyboardHandler', (data) => {
        if (data && typeof data === 'object') {
          this.setKeyboardHandler(data.handler);
        }
      })
    );
  }

  /**
   * Получает все фокусируемые элементы внутри модального окна
   * @returns {Array<HTMLElement>}
   */
  getFocusableElements() {
    if (!this.modal) return [];
    
    const focusableSelectors = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(', ');
    
    return Array.from(this.modal.querySelectorAll(focusableSelectors))
      .filter(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });
  }

  /**
   * Реализует focus trap - удерживает фокус внутри модального окна
   */
  setupFocusTrap() {
    this.focusTrapHandler = (e) => {
      if (!this.isOpen() || e.key !== 'Tab') return;
      
      const focusableElements = this.getFocusableElements();
      if (focusableElements.length === 0) return;
      
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      
      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };
    
    document.addEventListener('keydown', this.focusTrapHandler);
  }

  /**
   * Удаляет focus trap
   */
  removeFocusTrap() {
    if (this.focusTrapHandler && typeof document.removeEventListener === 'function') {
      document.removeEventListener('keydown', this.focusTrapHandler);
      this.focusTrapHandler = null;
    }
  }

  open(content, triggerElement = null) {
    if (!this.modal || !this.modalContent) {
      return;
    }
    
    if (!content || (typeof content !== 'string' && typeof content !== 'object')) {
      return;
    }
    
    // Сохраняем элемент, который открыл модалку, для возврата фокуса
    this.previousActiveElement = triggerElement || (document && document.activeElement) || null;
    
    // ВАЖНО: Убираем фокус с текущего активного элемента ПЕРЕД установкой aria-hidden
    // Это предотвращает предупреждение "Blocked aria-hidden on an element because its descendant retained focus"
    if (document.activeElement && document.activeElement !== document.body) {
      document.activeElement.blur();
    }
    
    // Устанавливаем aria-hidden="false" на модальное окно ДО установки aria-hidden на другие элементы
    // Это гарантирует что модальное окно доступно когда получает фокус
    this.modal.setAttribute('aria-hidden', 'false');
    
    // Скрываем все элементы вне модалки от screen readers
    // Теперь main-content не имеет фокуса, поэтому можно безопасно установить aria-hidden="true"
    this.hideElementsOutsideModal();
    
    this.modalContent.innerHTML = content;
    this.modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Prevent scroll on modal content
    this.modalContent.scrollTop = 0;
    
    // Настраиваем focus trap
    this.setupFocusTrap();
    
    // Перемещаем фокус на первый фокусируемый элемент или кнопку закрытия
    // Используем requestAnimationFrame для гарантии, что DOM обновлен
    // Теперь модальное окно уже имеет aria-hidden="false", поэтому фокус безопасен
    requestAnimationFrame(() => {
      const focusableElements = this.getFocusableElements();
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      } else if (this.modalClose) {
        this.modalClose.focus();
      }
    });

    // Эмитим событие для уведомления других компонентов
    if (this.eventBus && typeof this.eventBus.emit === 'function') {
      this.eventBus.emit('modal:opened', { content, triggerElement });
    }
  }

  close() {
    if (!this.modal) return;
    
    // Remove keyboard handler (очищает старый обработчик)
    this.setKeyboardHandler(null);
    
    // Remove focus trap
    this.removeFocusTrap();
    
    // Вызываем callbacks для уведомления о закрытии (например, для очистки modalEventHandlers в страницах)
    this.onCloseCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        // Игнорируем ошибки в callbacks
      }
    });
    this.onCloseCallbacks = [];
    
    // ВАЖНО: Убираем фокус с модального окна ПЕРЕД установкой aria-hidden="true"
    // Это предотвращает предупреждение "Blocked aria-hidden on an element because its descendant retained focus"
    if (document.activeElement && this.modal.contains(document.activeElement)) {
      document.activeElement.blur();
    }
    
    // Устанавливаем aria-hidden="true" на модальное окно
    this.modal.setAttribute('aria-hidden', 'true');
    this.modal.classList.remove('active');
    document.body.style.overflow = '';
    
    // Возвращаем aria-hidden для элементов вне модалки
    this.showElementsOutsideModal();
    
    // Очищаем все обработчики событий на modalContent через клонирование
    // Это предотвращает утечки памяти от обработчиков, добавленных страницами
    if (this.modalContent) {
      const newContent = this.modalContent.cloneNode(false);
      this.modalContent.parentNode?.replaceChild(newContent, this.modalContent);
      this.modalContent = newContent;
    }
    
    // Возвращаем фокус на элемент, который открыл модалку
    // Теперь модальное окно уже имеет aria-hidden="true" и не имеет фокуса, поэтому безопасно
    if (this.previousActiveElement && 
        typeof this.previousActiveElement.focus === 'function' &&
        document.body &&
        document.body.contains(this.previousActiveElement)) {
      // Используем requestAnimationFrame вместо setTimeout для лучшей производительности
      try {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            // Дополнительная проверка перед вызовом focus (элемент может быть удалён между кадрами)
            if (this.previousActiveElement && 
                typeof this.previousActiveElement.focus === 'function' &&
                document.body &&
                document.body.contains(this.previousActiveElement)) {
              this.previousActiveElement.focus();
            }
          });
        });
      } catch (error) {
        // Игнорируем ошибки при возврате фокуса
      }
    }
    this.previousActiveElement = null;
    
    // Очищаем contentStack для освобождения ссылок
    // Это предотвращает утечки памяти через замыкания в pushContent/popContent
    this.contentStack = [];

    // Эмитим событие для уведомления других компонентов
    if (this.eventBus && typeof this.eventBus.emit === 'function') {
      this.eventBus.emit('modal:closed');
    }
  }
  
  pushContent(content) {
    // Save current content to stack
    if (this.modalContent && this.modalContent.innerHTML.trim()) {
      this.contentStack.push(this.modalContent.innerHTML);
    }
    // Set new content
    this.setContent(content);
  }
  
  popContent() {
    if (this.contentStack.length > 0) {
      const previousContent = this.contentStack.pop();
      this.setContent(previousContent);
      return true;
    }
    return false;
  }
  
  hasPreviousContent() {
    return this.contentStack.length > 0;
  }
  
  setKeyboardHandler(handler) {
    // Remove previous handler if exists
    // ВАЖНО: Правильно удаляем старый обработчик перед добавлением нового
    // Это предотвращает утечки памяти от накопления обработчиков
    if (this.keyboardHandler && typeof document.removeEventListener === 'function') {
      document.removeEventListener('keydown', this.keyboardHandler);
      this.keyboardHandler = null;
    }
    // Если handler null, просто удаляем (для cleanup)
    if (!handler) {
      return;
    }
    this.keyboardHandler = handler;
    if (typeof document.addEventListener === 'function') {
      document.addEventListener('keydown', handler);
    }
  }

  /**
   * Регистрирует callback, который будет вызван при закрытии модалки
   * Используется страницами для очистки modalEventHandlers
   * @param {Function} callback - функция для вызова при закрытии
   * @returns {Function} функция для отмены регистрации
   */
  onClose(callback) {
    if (typeof callback !== 'function') {
      return () => {};
    }
    this.onCloseCallbacks.push(callback);
    // Возвращаем функцию для отмены регистрации
    return () => {
      const index = this.onCloseCallbacks.indexOf(callback);
      if (index > -1) {
        this.onCloseCallbacks.splice(index, 1);
      }
    };
  }

  isOpen() {
    return this.modal?.classList.contains('active');
  }

  setContent(content) {
    if (this.modalContent) {
      this.modalContent.innerHTML = content;
    }
  }

  /**
   * Скрывает все элементы вне модалки от screen readers
   * Устанавливает aria-hidden="true" для main-content и других элементов
   * ВАЖНО: Этот метод вызывается ПОСЛЕ того как фокус убран с элементов (blur())
   */
  hideElementsOutsideModal() {
    this.hiddenElements = [];
    
    // Получаем все элементы, которые нужно скрыть
    const elementsToHide = [
      document.getElementById('main-content'),
      document.querySelector('.header-wrapper'),
      document.querySelector('nav'),
      ...Array.from(document.querySelectorAll('[role="navigation"]'))
    ].filter(el => el !== null && el !== undefined);
    
    elementsToHide.forEach(el => {
      // Дополнительная проверка: убеждаемся что элемент не имеет фокуса
      // Если элемент имеет фокус, убираем его (на случай если blur() не сработал)
      if (el === document.activeElement || el.contains(document.activeElement)) {
        // Убираем фокус с элемента или его потомков
        if (document.activeElement && typeof document.activeElement.blur === 'function') {
          document.activeElement.blur();
        }
      }
      
      // Сохраняем текущее значение aria-hidden, если оно было установлено
      const currentAriaHidden = el.getAttribute('aria-hidden');
      this.hiddenElements.push({
        element: el,
        previousValue: currentAriaHidden
      });
      
      // Устанавливаем aria-hidden="true"
      // Теперь элемент гарантированно не имеет фокуса
      el.setAttribute('aria-hidden', 'true');
    });
  }

  /**
   * Возвращает aria-hidden для элементов вне модалки
   */
  showElementsOutsideModal() {
    this.hiddenElements.forEach(({ element, previousValue }) => {
      if (element && document.body.contains(element)) {
        if (previousValue === null) {
          // Если aria-hidden не был установлен, удаляем атрибут
          element.removeAttribute('aria-hidden');
        } else {
          // Возвращаем предыдущее значение
          element.setAttribute('aria-hidden', previousValue);
        }
      }
    });
    
    this.hiddenElements = [];
  }

  /**
   * Очищает все обработчики событий для предотвращения утечек памяти
   */
  cleanup() {
    // Отписываемся от событий EventBus
    if (this.eventUnsubscribers && Array.isArray(this.eventUnsubscribers)) {
      this.eventUnsubscribers.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      });
      this.eventUnsubscribers = [];
    }

    // Удаляем escape handler
    if (this.escapeHandler && typeof document.removeEventListener === 'function') {
      document.removeEventListener('keydown', this.escapeHandler);
      this.escapeHandler = null;
    }

    // Удаляем focus trap handler
    this.removeFocusTrap();

    // Удаляем keyboard handler
    this.setKeyboardHandler(null);

    // Удаляем обработчики кнопки закрытия и overlay
    if (this.modalClose && this.closeHandler && typeof this.modalClose.removeEventListener === 'function') {
      this.modalClose.removeEventListener('click', this.closeHandler);
      this.closeHandler = null;
    }

    if (this.modalOverlay && this.overlayHandler && typeof this.modalOverlay.removeEventListener === 'function') {
      this.modalOverlay.removeEventListener('click', this.overlayHandler);
      this.overlayHandler = null;
    }

    // Очищаем ссылку на EventBus
    this.eventBus = null;
  }
}

// Modal будет создан в Application


