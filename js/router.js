class Router {
  constructor(app) {
    this.app = app;
    // Получаем конфигурацию роутов из APP_CONFIG
    // Если APP_CONFIG не доступен, используем fallback
    const routesConfig = window.APP_CONFIG?.ROUTES || {};
    // Создаем маппинг path -> route для валидации
    this.routes = {};
    Object.keys(routesConfig).forEach(route => {
      if (routesConfig[route] && routesConfig[route].path) {
        this.routes[routesConfig[route].path] = route;
      }
    });
    this.currentRoute = null;
    this.navLinkHandlers = [];
    this.abortController = null; // AbortController для отмены предыдущих запросов
    this.init();
  }

  init() {
    // Store handlers for cleanup
    this.hashChangeHandler = () => this.handleRoute();
    this.loadHandler = () => this.handleRoute();
    
    window.addEventListener('hashchange', this.hashChangeHandler);
    window.addEventListener('load', this.loadHandler);
    
    // Prevent default navigation for nav links
    this.setupNavLinks();
  }

  /**
   * Очищает все обработчики событий для предотвращения утечек памяти
   */
  cleanup() {
    // Отменяем текущий запрос при cleanup
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    // Удаляем обработчики window
    if (this.hashChangeHandler) {
      window.removeEventListener('hashchange', this.hashChangeHandler);
      this.hashChangeHandler = null;
    }

    if (this.loadHandler) {
      window.removeEventListener('load', this.loadHandler);
      this.loadHandler = null;
    }

    // Удаляем обработчики навигационных ссылок
    this.navLinkHandlers.forEach(({ element, handler }) => {
      if (element && typeof element.removeEventListener === 'function') {
        element.removeEventListener('click', handler);
      }
    });
    this.navLinkHandlers = [];

    // Очищаем ссылки
    this.app = null;
  }

  setupNavLinks() {
    // Remove previous handlers
    this.navLinkHandlers.forEach(({ element, handler }) => {
      if (element && typeof element.removeEventListener === 'function') {
        element.removeEventListener('click', handler);
      }
    });
    this.navLinkHandlers = [];

    // Add new handlers
    document.querySelectorAll('.nav-link').forEach(link => {
      const handler = (e) => {
        e.preventDefault();
        const route = link.getAttribute('data-route');
        if (route) {
          window.location.hash = `#/${route}`;
        }
      };
      link.addEventListener('click', handler);
      this.navLinkHandlers.push({ element: link, handler });
    });
  }

  handleRoute() {
    // Извлекаем route из hash (убираем '#/')
    const hash = window.location.hash.replace(/^#\//, '') || 'main';
    // Получаем route из конфигурации или используем hash как fallback
    const route = this.routes[hash] || hash;
    
    // Проверяем, что route существует в конфигурации, иначе используем 'main' как fallback
    const routesConfig = window.APP_CONFIG?.ROUTES || {};
    const validRoute = routesConfig[route] ? route : 'main';
    
    if (validRoute !== this.currentRoute) {
      this.currentRoute = validRoute;
      this.navigate(validRoute);
    }
  }

  navigate(route) {
    if (!route || typeof route !== 'string') {
      return;
    }

    // Отменяем предыдущий запрос, если он еще выполняется
    if (this.abortController) {
      this.abortController.abort();
    }

    // Создаем новый AbortController для текущего запроса
    this.abortController = new AbortController();

    // Update active nav link
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      if (link && link.classList) {
        link.classList.remove('active');
        if (link.getAttribute('data-route') === route) {
          link.classList.add('active');
        }
      }
    });

    // Прокрутка и фокус не изменяются при переключении вкладок
    // Пользователь остается на той же высоте прокрутки, где он был

    // Load page content с передачей signal для возможности отмены
    if (!this.app || typeof this.app.loadPage !== 'function') {
      return;
    }
    this.app.loadPage(route, this.abortController.signal);
  }

  getCurrentRoute() {
    return this.currentRoute || 'main';
  }
}

// Router будет инициализирован в Application