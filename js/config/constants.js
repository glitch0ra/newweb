/**
 * Конфигурационные константы приложения
 * Содержит все магические числа с понятными именами и комментариями
 */

// Конфигурация для пагинации и виртуализации
const PAGINATION_CONFIG = {
    // Количество элементов на странице: 3 ряда × 6 колонок = 18 элементов
    ITEMS_PER_PAGE: 18,
    
    // Количество страниц для начальной загрузки (первая + следующая для предзагрузки)
    PAGES_TO_RENDER_INITIALLY: 2,
    
    // Количество элементов в preview-секции (6 колонок)
    PREVIEW_ITEMS_COUNT: 6,
    
    // Количество колонок в grid
    GRID_COLUMNS: 6
};

// Конфигурация для каруселей
const CAROUSEL_CONFIG = {
    // Фиксированная ширина для history-image и collection-image-card (в пикселях)
    FIXED_ITEM_WIDTH: 252,
    
    // Responsive itemsPerView для каруселей
    ITEMS_PER_VIEW: {
        DESKTOP: 3,    // > 1023px
        TABLET: 2,     // 768px - 1023px
        MOBILE: 1      // < 768px
    },
    
    // Порог для drag/swipe (в пикселях)
    DRAG_THRESHOLD: 50,
    
    // Минимальный интервал между свайпами (в миллисекундах)
    MIN_SWIPE_INTERVAL: 300,
    
    // Порог для определения клика vs свайпа (в пикселях)
    CLICK_DISTANCE_THRESHOLD: 10,
    
    // Максимальная длительность для клика (в миллисекундах)
    CLICK_DURATION_THRESHOLD: 300,
    
    // Длительность анимации перехода (в секундах)
    TRANSITION_DURATION: 0.4,
    
    // Задержка для resize handler (в миллисекундах)
    RESIZE_DEBOUNCE_DELAY: 100
};

// Конфигурация для предзагрузки
const PRELOADER_CONFIG = {
    // Размер батча для предзагрузки (оптимально для 3G сетей)
    BATCH_SIZE: 5
};

// Конфигурация для виртуализации
const VIRTUALIZATION_CONFIG = {
    // Отступ для IntersectionObserver (в пикселях)
    // Элементы начинают загружаться за 50px до попадания в viewport
    OBSERVER_ROOT_MARGIN: '50px'
};

// Конфигурация роутов приложения
// Централизованная конфигурация для избежания дублирования роутов в разных местах
// При добавлении новой страницы нужно обновить только этот объект
const ROUTES_CONFIG = {
    main: {
        path: 'main',
        title: 'Home',
        dataPath: 'data/main.json'
    },
    collections: {
        path: 'collections',
        title: 'Collections',
        dataPath: 'data/collections.json'
    },
    screenshots: {
        path: 'screenshots',
        title: 'Screenshots',
        dataPath: 'data/screenshots.json'
    },
    videos: {
        path: 'videos',
        title: 'Videos',
        dataPath: 'data/videos.json'
    },
    history: {
        path: 'history',
        title: 'History',
        dataPath: 'data/history.json'
    },
    about: {
        path: 'about',
        title: 'About',
        dataPath: 'data/about.json'
    }
};

// Экспортируем конфигурацию через глобальный объект для совместимости
// Если APP_CONFIG уже загружен из config.json, используем его
// Иначе создаем из локальных констант (fallback для обратной совместимости)
if (typeof window !== 'undefined') {
    // Если APP_CONFIG уже загружен из config.json, не перезаписываем его
    // Только дополняем, если каких-то секций не хватает
    if (!window.APP_CONFIG) {
        window.APP_CONFIG = {};
    }
    
    // Дополняем конфиг локальными константами, если они отсутствуют (fallback)
    if (!window.APP_CONFIG.PAGINATION) {
        window.APP_CONFIG.PAGINATION = PAGINATION_CONFIG;
    }
    if (!window.APP_CONFIG.CAROUSEL) {
        window.APP_CONFIG.CAROUSEL = CAROUSEL_CONFIG;
    }
    if (!window.APP_CONFIG.PRELOADER) {
        window.APP_CONFIG.PRELOADER = PRELOADER_CONFIG;
    }
    if (!window.APP_CONFIG.VIRTUALIZATION) {
        window.APP_CONFIG.VIRTUALIZATION = VIRTUALIZATION_CONFIG;
    }
    if (!window.APP_CONFIG.ROUTES) {
        window.APP_CONFIG.ROUTES = ROUTES_CONFIG;
    }
}

