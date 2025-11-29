/**
 * Объявляет для screen reader о загрузке контента
 * @param {string} message - сообщение для объявления
 */
function announceToScreenReader(message) {
    const liveRegion = document.getElementById('live-region');
    if (liveRegion) {
        // Сначала очищаем текст, чтобы screen reader заметил изменение
        liveRegion.textContent = '';
        // Устанавливаем новый текст через небольшую задержку
        // Это гарантирует, что screen reader зафиксирует изменение
        setTimeout(() => {
            liveRegion.textContent = message;
        }, 100);
    }
}

/**
 * Получает название страницы для объявления
 * @param {string} route - маршрут страницы
 * @returns {string}
 */
function getPageTitle(route) {
    // Получаем конфигурацию роутов из APP_CONFIG
    const routesConfig = window.APP_CONFIG?.ROUTES || {};
    if (routesConfig[route] && routesConfig[route].title) {
        return routesConfig[route].title;
    }
    return 'Page';
}

/**
 * Главный класс приложения - единая точка входа
 * Содержит все компоненты и управляет их жизненным циклом
 * Использует Dependency Injection для управления зависимостями
 */
class Application {
    constructor(config = {}) {
        // Dependency Injection: принимаем зависимости через config или создаем по умолчанию
        // Обертываем инициализацию каждого компонента в try-catch для graceful degradation
        
        // Store - критически важный компонент
        try {
            this.store = config.store || new Store();
        } catch (e) {
            console.error('Failed to initialize Store:', e);
            // Заглушка для Store
            this.store = {
                get: () => null,
                set: () => {},
                has: () => false,
                clear: () => {},
                getAll: () => ({})
            };
        }
        
        // EventBus - не критичен, можно работать без него
        try {
            this.eventBus = config.eventBus || new EventBus();
        } catch (e) {
            console.error('Failed to initialize EventBus:', e);
            // Заглушка для EventBus
            this.eventBus = {
                on: () => {},
                off: () => {},
                emit: () => {},
                once: () => {},
                clear: () => {}
            };
        }
        
        // DataValidator - критичен для безопасности данных
        try {
            this.dataValidator = config.dataValidator || new DataValidator();
        } catch (e) {
            console.error('Failed to initialize DataValidator:', e);
            // Заглушка для DataValidator - пропускает валидацию
            this.dataValidator = {
                validateMain: (data) => data,
                validateCollections: (data) => data,
                validateScreenshots: (data) => data,
                validateVideos: (data) => data,
                validateHistory: (data) => data,
                validateAbout: (data) => data,
                hasErrors: () => false
            };
        }
        
        // Preloader - не критичен, можно работать без предзагрузки
        try {
            this.preloader = config.preloader || new Preloader();
        } catch (e) {
            console.error('Failed to initialize Preloader:', e);
            // Заглушка для Preloader
            this.preloader = {
                preloadImage: () => Promise.resolve(),
                preloadVideo: () => Promise.resolve(),
                preloadFromData: () => Promise.resolve(),
                extractMediaUrls: () => ({ imageUrls: [], videoUrls: [] })
            };
        }
        
        // Modal - критичен для отображения контента
        // Передаем eventBus в Modal для событийной архитектуры
        try {
            this.modal = config.modal || new Modal(this.eventBus);
        } catch (e) {
            console.error('Failed to initialize Modal:', e);
            // Заглушка для Modal
            this.modal = {
                open: () => {},
                close: () => {},
                isOpen: () => false,
                pushContent: () => {},
                popContent: () => false,
                setKeyboardHandler: () => {},
                onClose: () => () => {},
                cleanup: () => {}
            };
        }
        
        // LoaderAnimation - статический класс, проверяем доступность
        try {
            this.LoaderAnimation = config.LoaderAnimation || LoaderAnimation;
            if (!this.LoaderAnimation || typeof this.LoaderAnimation.show !== 'function') {
                throw new Error('LoaderAnimation is not available');
            }
        } catch (e) {
            console.error('Failed to initialize LoaderAnimation:', e);
            // Заглушка для LoaderAnimation
            this.LoaderAnimation = {
                show: () => {},
                hide: () => {}
            };
        }
        
        // DataLoader получает зависимости через конструктор
        try {
            this.dataLoader = config.dataLoader || new DataLoader(
                this.dataValidator, 
                this.preloader, 
                this.store,
                this.LoaderAnimation
            );
        } catch (e) {
            console.error('Failed to initialize DataLoader:', e);
            // Заглушка для DataLoader
            this.dataLoader = {
                loadJSON: () => Promise.reject(new Error('DataLoader not available')),
                loadMain: () => Promise.reject(new Error('DataLoader not available')),
                loadCollections: () => Promise.reject(new Error('DataLoader not available')),
                loadScreenshots: () => Promise.reject(new Error('DataLoader not available')),
                loadVideos: () => Promise.reject(new Error('DataLoader not available')),
                loadHistory: () => Promise.reject(new Error('DataLoader not available')),
                loadAbout: () => Promise.reject(new Error('DataLoader not available'))
            };
        }
        
        // Инициализируем страницы с передачей всех необходимых зависимостей
        // Используем конфигурацию роутов из APP_CONFIG для динамического создания страниц
        this.pages = {};
        const routesConfig = window.APP_CONFIG?.ROUTES || {};
        
        // Маппинг классов страниц (должен быть синхронизирован с ROUTES_CONFIG)
        const pageClasses = {
            main: MainPage,
            collections: CollectionsPage,
            screenshots: ScreenshotsPage,
            videos: VideosPage,
            history: HistoryPage,
            about: AboutPage
        };
        
        // Маппинг аргументов для конструкторов страниц
        // Передаем eventBus в страницы для событийной архитектуры
        const pageArgs = {
            main: [this.store, this.dataLoader, this.modal, this.eventBus],
            collections: [this.store, this.dataLoader, this.modal, this.dataValidator, this.eventBus],
            screenshots: [this.store, this.dataLoader, this.modal, this.eventBus],
            videos: [this.store, this.dataLoader, this.modal, this.eventBus],
            history: [this.store, this.dataLoader, this.eventBus],
            about: [this.store, this.dataLoader, this.eventBus]
        };
        
        // Создаем страницы на основе конфигурации роутов
        Object.keys(routesConfig).forEach(route => {
            const PageClass = pageClasses[route];
            const args = pageArgs[route];
            
            if (PageClass && args) {
                try {
                    this.pages[route] = new PageClass(...args);
                } catch (e) {
                    console.error(`Failed to initialize ${route} page:`, e);
                    // Заглушка для страницы
                    this.pages[route] = {
                        load: () => Promise.resolve(),
                        render: () => {},
                        cleanup: () => {},
                        getRoute: () => route,
                        store: this.store,
                        dataLoader: this.dataLoader
                    };
                }
            }
        });
        
        // Инициализируем router с передачей loadPage
        try {
            this.router = new Router(this);
        } catch (e) {
            console.error('Failed to initialize Router:', e);
            // Заглушка для Router
            this.router = {
                navigate: () => {},
                getCurrentRoute: () => 'main',
                cleanup: () => {}
            };
        }
        
        // Текущий route для защиты от race conditions
        this.currentLoadingRoute = null;
        
        // Инициализируем приложение
        this.init();
    }
    
    /**
     * Загружает страницу по маршруту
     * Использует прямые вызовы вместо Event Bus для явных зависимостей
     * @param {string} route - маршрут страницы
     * @param {AbortSignal} signal - сигнал для отмены запроса (опционально)
     */
    async loadPage(route, signal = null) {
        const mainContent = document.getElementById('main-content');
        if (!mainContent) return;

        // Проверяем, не отменен ли запрос до начала загрузки
        if (signal && signal.aborted) {
            return;
        }

        // Получаем страницу по маршруту
        const page = this.pages[route];
        if (!page || !page.store) {
            return;
        }

        // Защита от race conditions - если уже загружается другая страница, игнорируем
        const loadingRoute = route;
        this.currentLoadingRoute = loadingRoute;

        // Cleanup previous page before loading new one
        // Вызываем cleanup напрямую для всех страниц
        Object.values(this.pages).forEach(p => {
            if (p && typeof p.cleanup === 'function') {
                p.cleanup();
            }
        });

        // Close modal if open
        // Используем EventBus для закрытия модалки, если доступен
        if (this.modal && typeof this.modal.isOpen === 'function' && this.modal.isOpen()) {
            if (this.eventBus && typeof this.eventBus.emit === 'function') {
                this.eventBus.emit('modal:close');
            } else if (this.modal && typeof this.modal.close === 'function') {
                this.modal.close();
            }
        }

        // Объявляем о начале загрузки страницы
        const pageTitle = getPageTitle(route);
        
        // Проверяем, есть ли данные в Store
        // Добавлена проверка на page и page.store для безопасности
        const hasCachedData = page && page.store && typeof page.store.has === 'function' && page.store.has(route);
        
        if (!hasCachedData) {
            // Показываем loader только если данных нет в кэше
            announceToScreenReader(`Loading page: ${pageTitle}`);
            this.showLoader(mainContent);
        } else {
            // Данные в кэше - просто объявляем о переходе
            announceToScreenReader(`Navigating to: ${pageTitle}`);
        }

        try {
            // Прямой вызов метода load() страницы вместо эмиссии событий
            // Это делает зависимости явными и убирает скрытые связи через Event Bus
            // Проверяем, что page существует и имеет метод load
            if (!page || typeof page.load !== 'function') {
                throw new Error(`Page load method is not available for route: ${route}`);
            }
            
            // Проверяем, не отменен ли запрос перед загрузкой
            if (signal && signal.aborted) {
                return;
            }
            
            // Передаем signal в page.load() как третий параметр
            // showLoader определяется наличием кэшированных данных
            await page.load(!hasCachedData, false, signal);
            
            // Проверяем, что route не изменился во время загрузки (race condition protection)
            // Или что запрос не был отменен
            if (this.currentLoadingRoute !== loadingRoute || (signal && signal.aborted)) {
                return; // Пользователь переключился на другую страницу или запрос отменен, игнорируем результат
            }

            // Объявляем о завершении загрузки
            announceToScreenReader(`Page "${pageTitle}" loaded`);
            
            // Уведомляем InitialLoaderManager о готовности данных
            // Если это главная вкладка - устанавливаем setMainDataReady и отслеживаем медиа
            // Если это другая вкладка при первом заходе - тоже устанавливаем setMainDataReady
            // (для случая когда пользователь заходит сразу на другую вкладку)
            if (typeof window !== 'undefined' && window.initialLoaderManager && 
                typeof window.initialLoaderManager.setMainDataReady === 'function') {
                // Проверяем, не был ли уже установлен флаг готовности данных
                // Используем метод hasMainDataReady() если он есть, иначе устанавливаем всегда
                const shouldSetMainData = typeof window.initialLoaderManager.hasMainDataReady === 'function'
                    ? !window.initialLoaderManager.hasMainDataReady()
                    : true;
                
                if (shouldSetMainData) {
                    window.initialLoaderManager.setMainDataReady();
                    
                    // Отслеживаем загрузку медиа контента только для главной вкладки
                    if (route === 'main') {
                        this.trackMainPageMedia(mainContent);
                    } else {
                        // Для других вкладок тоже отслеживаем медиа, но не критично
                        // Устанавливаем флаг медиа готовности сразу для не-главных вкладок
                        if (typeof window.initialLoaderManager.setMediaReady === 'function') {
                            window.initialLoaderManager.setMediaReady();
                        }
                    }
                }
            }
            
            if (!hasCachedData) {
                // Hide loader after content is rendered
                // Используем requestAnimationFrame вместо setTimeout для лучшей производительности
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        // Двойной requestAnimationFrame гарантирует, что контент отрендерен
                        this.hideLoader(mainContent);
                    });
                });
            }
            
            // Очищаем текущий route после успешной загрузки
            if (this.currentLoadingRoute === loadingRoute) {
                this.currentLoadingRoute = null;
            }
        } catch (error) {
            // Игнорируем ошибки отмены запроса (AbortError)
            if (error && error.name === 'AbortError') {
                // Запрос был отменен - не обновляем UI
                return;
            }
            
            // Очищаем текущий route даже при ошибке
            if (this.currentLoadingRoute === loadingRoute) {
                this.currentLoadingRoute = null;
            }
            
            announceToScreenReader('Error loading data');
            this.hideLoader(mainContent);
            mainContent.innerHTML = '<div class="error">Error loading data</div>';
        }
    }
    

    /**
     * Инициализирует приложение
     */
    init() {
        // Устанавливаем глобальный обработчик неотловленных Promise rejections
        this.setupGlobalErrorHandlers();
    }

    /**
     * Устанавливает глобальные обработчики ошибок
     */
    setupGlobalErrorHandlers() {
        // Сохраняем ссылки на обработчики для последующего удаления
        this.unhandledRejectionHandler = (e) => {
            // Предотвращаем вывод ошибки в консоль браузера по умолчанию
            e.preventDefault();
            
            // Показываем пользователю сообщение об ошибке
            const mainContent = document.getElementById('main-content');
            if (mainContent) {
                // Не перезаписываем контент, если уже есть ошибка
                if (!mainContent.querySelector('.error')) {
                    const errorMessage = e.reason?.message || 'An unexpected error occurred';
                    mainContent.innerHTML = `
                        <div class="error">
                            <p>An error occurred while loading the page</p>
                            <p style="font-size: 0.8rem; margin-top: 0.5rem;">${this.escapeHTML(errorMessage)}</p>
                        </div>
                    `;
                }
                
                // Скрываем loader, если он показан
                this.hideLoader(mainContent);
            }
            
            // Объявляем для screen reader
            announceToScreenReader('Error loading data');
        };

        this.errorHandler = (e) => {
            // Показываем пользователю сообщение об ошибке только для критических ошибок
            if (e.error && !e.error.handled) {
                const mainContent = document.getElementById('main-content');
                if (mainContent && !mainContent.querySelector('.error')) {
                    mainContent.innerHTML = `
                        <div class="error">
                            <p>An unexpected error occurred</p>
                            <p style="font-size: 0.8rem; margin-top: 0.5rem;">Please refresh the page</p>
                        </div>
                    `;
                    
                    this.hideLoader(mainContent);
                }
            }
        };

        // Обработчик неотловленных Promise rejections
        window.addEventListener('unhandledrejection', this.unhandledRejectionHandler);

        // Обработчик глобальных ошибок JavaScript
        window.addEventListener('error', this.errorHandler);
    }

    /**
     * Показывает loader
     * @param {HTMLElement} container - контейнер для loader
     */
    showLoader(container) {
        if (this.LoaderAnimation && container && typeof this.LoaderAnimation.show === 'function') {
            this.LoaderAnimation.show(container);
        }
    }

    /**
     * Скрывает loader
     * @param {HTMLElement} container - контейнер для loader
     */
    hideLoader(container) {
        if (this.LoaderAnimation && container && typeof this.LoaderAnimation.hide === 'function') {
            this.LoaderAnimation.hide(container);
        }
    }

    /**
     * Экранирует HTML для безопасного отображения
     * @param {string} text - текст для экранирования
     * @returns {string}
     */
    escapeHTML(text) {
        if (text === null || text === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    /**
     * Отслеживает загрузку медиа контента на главной вкладке
     * @param {HTMLElement} mainContent - контейнер с контентом
     */
    trackMainPageMedia(mainContent) {
        if (!mainContent) return;
        
        // Находим все изображения и видео на главной вкладке
        const images = mainContent.querySelectorAll('img');
        const videos = mainContent.querySelectorAll('video');
        
        let loadedCount = 0;
        const totalMedia = images.length + videos.length;
        
        // Если медиа нет, сразу уведомляем о готовности
        if (totalMedia === 0) {
            if (typeof window !== 'undefined' && window.initialLoaderManager && 
                typeof window.initialLoaderManager.setMediaReady === 'function') {
                window.initialLoaderManager.setMediaReady();
            }
            return;
        }
        
        // Отслеживаем загрузку изображений
        images.forEach(img => {
            if (img.complete && img.naturalWidth > 0) {
                loadedCount++;
                checkAllMedia();
            } else {
                img.addEventListener('load', () => {
                    loadedCount++;
                    checkAllMedia();
                }, { once: true });
                img.addEventListener('error', () => {
                    loadedCount++;
                    checkAllMedia();
                }, { once: true });
            }
        });
        
        // Отслеживаем загрузку видео
        videos.forEach(video => {
            if (video.readyState >= 2) {
                loadedCount++;
                checkAllMedia();
            } else {
                video.addEventListener('loadeddata', () => {
                    loadedCount++;
                    checkAllMedia();
                }, { once: true });
                video.addEventListener('error', () => {
                    loadedCount++;
                    checkAllMedia();
                }, { once: true });
            }
        });
        
        // Проверяем готовность всех медиа
        function checkAllMedia() {
            if (loadedCount >= totalMedia) {
                if (typeof window !== 'undefined' && window.initialLoaderManager && 
                    typeof window.initialLoaderManager.setMediaReady === 'function') {
                    window.initialLoaderManager.setMediaReady();
                }
            }
        }
        
        // Таймаут на случай если некоторые медиа не загрузятся
        setTimeout(() => {
            if (loadedCount < totalMedia) {
                if (typeof window !== 'undefined' && window.initialLoaderManager && 
                    typeof window.initialLoaderManager.setMediaReady === 'function') {
                    window.initialLoaderManager.setMediaReady();
                }
            }
        }, 5000);
    }
    
    /**
     * Очищает все обработчики событий для предотвращения утечек памяти
     */
    cleanup() {
        // Удаляем глобальные обработчики ошибок
        if (this.unhandledRejectionHandler) {
            window.removeEventListener('unhandledrejection', this.unhandledRejectionHandler);
            this.unhandledRejectionHandler = null;
        }

        if (this.errorHandler) {
            window.removeEventListener('error', this.errorHandler);
            this.errorHandler = null;
        }

        // Очищаем router
        if (this.router && typeof this.router.cleanup === 'function') {
            this.router.cleanup();
        }

        // Очищаем modal
        if (this.modal && typeof this.modal.cleanup === 'function') {
            this.modal.cleanup();
        }

        // Очищаем все страницы
        Object.values(this.pages).forEach(page => {
            if (page && typeof page.cleanup === 'function') {
                page.cleanup();
            }
        });

        // Очищаем ссылки
        this.store = null;
        this.eventBus = null;
        this.dataValidator = null;
        this.preloader = null;
        this.modal = null;
        this.dataLoader = null;
        this.pages = {};
        this.router = null;
    }
}

// Инициализируем приложение после загрузки DOM
// Используем Dependency Injection для явной передачи зависимостей
let appInstance = null;

const domContentLoadedHandler = () => {
    // Создаем зависимости
    const store = new Store();
    const eventBus = new EventBus();
    const dataValidator = new DataValidator();
    const preloader = new Preloader();
    const modal = new Modal();
    
    // Создаем приложение с явной передачей зависимостей
    appInstance = new Application({
        store,
        eventBus,
        dataValidator,
        preloader,
        modal,
        LoaderAnimation
    });
    
    // Уведомляем InitialLoaderManager о готовности Application
    // Используем задержку чтобы убедиться что InitialLoaderManager инициализирован
    requestAnimationFrame(() => {
        if (typeof window !== 'undefined' && window.initialLoaderManager && 
            typeof window.initialLoaderManager.setApplicationReady === 'function') {
            window.initialLoaderManager.setApplicationReady();
        }
    });
    
    // Приложение создано, но не экспортируется в window.app
    // Все зависимости передаются через конструкторы компонентов
    
    // Удаляем обработчик после инициализации
    document.removeEventListener('DOMContentLoaded', domContentLoadedHandler);
};

document.addEventListener('DOMContentLoaded', domContentLoadedHandler);
