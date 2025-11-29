/**
 * InitialLoaderManager - управляет начальным loader сайта
 * Отслеживает загрузку всех ресурсов и скрывает loader только когда все готово
 * Применяет минимальное время отображения в зависимости от наличия кэша
 */
class InitialLoaderManager {
    constructor() {
        this.loader = document.querySelector('.initial-loader');
        this.startTime = Date.now();
        this.minDisplayTime = null; // Будет установлено в зависимости от наличия кэша
        this.allResourcesLoaded = false;
        
        // Флаги готовности различных ресурсов
        this.resources = {
            fonts: false,
            scripts: false,
            application: false,
            mainData: false,
            media: false
        };
        
        // Проверяем наличие кэша для определения минимального времени
        this.checkCacheAndSetMinTime();
        
        // Начинаем отслеживание ресурсов
        this.startTracking();
    }
    
    /**
     * Проверяет наличие кэша в Store и устанавливает минимальное время отображения
     */
    checkCacheAndSetMinTime() {
        // Проверяем sessionStorage на наличие кэшированных данных
        // Используем тот же ключ что и Store
        let hasCache = false;
        
        try {
            if (typeof sessionStorage !== 'undefined') {
                // Проверяем наличие кэша для главной вкладки
                const mainCache = sessionStorage.getItem('spa-cache-main');
                if (mainCache) {
                    hasCache = true;
                }
            }
        } catch (e) {
            // Игнорируем ошибки доступа к sessionStorage
        }
        
        // Устанавливаем минимальное время: 3.5 сек для первого захода, 1 сек если есть кэш
        this.minDisplayTime = hasCache ? 1000 : 3500;
    }
    
    /**
     * Начинает отслеживание всех ресурсов
     */
    startTracking() {
        // Отслеживаем загрузку шрифтов
        this.trackFonts();
        
        // Отслеживаем загрузку скриптов
        this.trackScripts();
        
        // Отслеживаем загрузку Application (будет вызвано из app.js)
        // Отслеживаем загрузку данных главной вкладки (будет вызвано из app.js)
        // Отслеживаем загрузку медиа контента (будет вызвано из app.js)
    }
    
    /**
     * Отслеживает загрузку шрифтов
     */
    trackFonts() {
        if (typeof document !== 'undefined' && document.fonts && typeof document.fonts.ready === 'object') {
            document.fonts.ready.then(() => {
                this.resources.fonts = true;
                this.checkAllResources();
            }).catch(() => {
                // Если fonts.ready не поддерживается, считаем что шрифты загружены
                this.resources.fonts = true;
                this.checkAllResources();
            });
        } else {
            // Fallback: если document.fonts.ready не поддерживается, ждем window.load
            // или считаем что шрифты загружены через некоторое время
            setTimeout(() => {
                this.resources.fonts = true;
                this.checkAllResources();
            }, 500);
        }
    }
    
    /**
     * Отслеживает загрузку скриптов
     */
    trackScripts() {
        // Проверяем готовность скриптов через document.readyState
        // Реальная готовность Application будет установлена через setApplicationReady()
        const checkScripts = () => {
            if (document.readyState === 'complete') {
                this.resources.scripts = true;
                this.checkAllResources();
            }
        };
        
        if (document.readyState === 'complete') {
            checkScripts();
        } else {
            window.addEventListener('load', checkScripts);
        }
    }
    
    /**
     * Устанавливает флаг готовности Application
     * Вызывается из app.js после инициализации Application
     */
    setApplicationReady() {
        this.resources.application = true;
        this.checkAllResources();
    }
    
    /**
     * Устанавливает флаг готовности данных главной вкладки
     * Вызывается из app.js после загрузки данных главной вкладки
     */
    setMainDataReady() {
        this.resources.mainData = true;
        this.checkAllResources();
    }
    
    /**
     * Проверяет, установлен ли флаг готовности данных главной вкладки
     * @returns {boolean}
     */
    hasMainDataReady() {
        return this.resources.mainData === true;
    }
    
    /**
     * Устанавливает флаг готовности медиа контента
     * Вызывается после загрузки критичных медиа элементов
     */
    setMediaReady() {
        this.resources.media = true;
        this.checkAllResources();
    }
    
    /**
     * Проверяет готовность всех ресурсов и скрывает loader когда все готово
     */
    checkAllResources() {
        // Проверяем готовность всех ресурсов
        const allReady = Object.values(this.resources).every(ready => ready === true);
        
        if (allReady) {
            this.allResourcesLoaded = true;
            this.hideLoader();
        }
    }
    
    /**
     * Скрывает loader с учетом минимального времени отображения
     */
    hideLoader() {
        if (!this.loader) return;
        
        const elapsed = Date.now() - this.startTime;
        const remainingTime = Math.max(0, this.minDisplayTime - elapsed);
        
        // Если прошло меньше минимального времени, ждем
        if (remainingTime > 0) {
            setTimeout(() => {
                this.hideLoaderNow();
            }, remainingTime);
        } else {
            this.hideLoaderNow();
        }
    }
    
    /**
     * Скрывает loader немедленно с анимацией
     */
    hideLoaderNow() {
        if (!this.loader) return;
        
        this.loader.style.opacity = '0';
        this.loader.style.transition = 'opacity 0.3s ease';
        
        // Используем transitionend для удаления элемента
        const handleTransitionEnd = (e) => {
            if (e.propertyName === 'opacity' && e.target === this.loader) {
                this.loader.style.display = 'none';
                this.loader.removeEventListener('transitionend', handleTransitionEnd);
            }
        };
        
        this.loader.addEventListener('transitionend', handleTransitionEnd);
        
        // Fallback на случай если transitionend не сработает
        setTimeout(() => {
            if (this.loader && this.loader.style.display !== 'none') {
                this.loader.style.display = 'none';
            }
        }, 500);
    }
}

// Создаем глобальный экземпляр для доступа из других модулей
let initialLoaderManager = null;

// Инициализируем при загрузке скрипта
// Используем немедленную инициализацию, так как скрипт загружается с defer
// и DOM уже должен быть готов к моменту выполнения
if (typeof document !== 'undefined') {
    // Используем немедленную инициализацию если DOM готов, иначе ждем DOMContentLoaded
    const initLoader = () => {
        if (!initialLoaderManager) {
            initialLoaderManager = new InitialLoaderManager();
            
            // Экспортируем для использования в других модулях
            if (typeof window !== 'undefined') {
                window.InitialLoaderManager = InitialLoaderManager;
                window.initialLoaderManager = initialLoaderManager;
            }
        }
    };
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLoader);
    } else {
        // DOM уже готов, инициализируем немедленно
        initLoader();
    }
}

