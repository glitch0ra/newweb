/**
 * Store - централизованное хранилище состояния приложения
 * Кэширует данные всех страниц для переиспользования при навигации
 * Использует sessionStorage для временных данных сессии (transientStore)
 * Использует localStorage для постоянных настроек пользователя (persistentStore)
 * Реализует LRU (Least Recently Used) механизм для управления памятью
 */
class Store {
    constructor(maxSize = 5 * 1024 * 1024, config = {}) { // 5MB лимит по умолчанию
        this.maxSize = maxSize;
        this.currentSize = 0; // Текущий размер данных в байтах
        this.lastUsed = {}; // Время последнего использования для каждого route
        
        // Разделяем хранилища:
        // transientStore - для временных данных сессии (sessionStorage)
        // persistentStore - для постоянных настроек пользователя (localStorage)
        this.transientStore = typeof sessionStorage !== 'undefined' ? sessionStorage : null;
        this.persistentStore = typeof localStorage !== 'undefined' ? localStorage : null;
        
        // Инициализируем state на основе конфигурации роутов из APP_CONFIG
        // Если APP_CONFIG не доступен, используем fallback
        const routesConfig = typeof window !== 'undefined' && window.APP_CONFIG?.ROUTES || {};
        this.state = {};
        Object.keys(routesConfig).forEach(route => {
            this.state[route] = null;
        });
        
        // Fallback для обратной совместимости, если APP_CONFIG не загружен
        if (Object.keys(this.state).length === 0) {
            this.state = {
                main: null,
                collections: null,
                screenshots: null,
                videos: null,
                history: null,
                about: null
            };
        }
        
        // Время последней загрузки данных для каждого route (в миллисекундах)
        // Используется для автоматического обновления устаревших данных
        this.lastLoadTime = {};
        
        // Максимальное время жизни кэша (по умолчанию 1 час)
        // Данные старше этого времени будут автоматически обновляться
        this.cacheMaxAge = config.cacheMaxAge || (60 * 60 * 1000); // 1 час в миллисекундах
        
        // Инициализируем данные из sessionStorage при создании
        this.loadFromSessionStorage();
    }

    /**
     * Загружает данные из transientStore (sessionStorage) в память
     * Вызывается при инициализации Store
     */
    loadFromSessionStorage() {
        if (!this.transientStore) {
            return;
        }
        const routes = Object.keys(this.state);
        routes.forEach(route => {
            try {
                const cached = this.transientStore.getItem(`spa-cache-${route}`);
                if (cached) {
                    const data = JSON.parse(cached);
                    this.state[route] = data;
                    // Обновляем размер и время использования
                    const dataSize = new Blob([cached]).size;
                    this.currentSize += dataSize;
                    this.lastUsed[route] = Date.now();
                    // Устанавливаем lastLoadTime при загрузке из sessionStorage
                    // Это позволяет использовать кэшированные данные без избыточных сетевых запросов
                    this.lastLoadTime[route] = Date.now();
                }
            } catch (e) {
                // Игнорируем ошибки парсинга или недоступности sessionStorage
            }
        });
    }

    /**
     * Получает данные для маршрута
     * Сначала проверяет память, затем sessionStorage
     * Обновляет время последнего использования для LRU
     * @param {string} route - маршрут страницы
     * @returns {*} данные страницы или null
     */
    get(route) {
        // Сначала проверяем память
        if (this.state[route]) {
            // Обновляем время последнего использования
            this.lastUsed[route] = Date.now();
            return this.state[route];
        }
        
        // Если нет в памяти, проверяем transientStore (sessionStorage)
        if (this.transientStore) {
            try {
                const cached = this.transientStore.getItem(`spa-cache-${route}`);
                if (cached) {
                    const data = JSON.parse(cached);
                    // Восстанавливаем в память для быстрого доступа
                    this.state[route] = data;
                    // Обновляем размер и время использования (только если еще не загружено)
                    if (!this.lastUsed[route]) {
                        const dataSize = new Blob([cached]).size;
                        this.currentSize += dataSize;
                    }
                    this.lastUsed[route] = Date.now();
                    // Устанавливаем lastLoadTime при загрузке из sessionStorage, если еще не установлен
                    if (!this.lastLoadTime[route]) {
                        this.lastLoadTime[route] = Date.now();
                    }
                    return data;
                }
            } catch (e) {
                // Игнорируем ошибки парсинга или недоступности sessionStorage
            }
        }
        
        return null;
    }

    /**
     * Устанавливает данные для маршрута
     * Сохраняет в память и sessionStorage
     * Проверяет лимит памяти и удаляет старые данные при необходимости
     * @param {string} route - маршрут страницы
     * @param {*} data - данные для сохранения
     */
    set(route, data) {
        if (!(route in this.state)) {
            return;
        }

        // Вычисляем размер новых данных
        const dataString = JSON.stringify(data);
        const dataSize = new Blob([dataString]).size; // Более точный размер в байтах
        
        // Вычисляем размер старых данных (если есть)
        let oldSize = 0;
        if (this.state[route] !== null && this.state[route] !== undefined) {
            if (this.transientStore) {
                try {
                    const oldString = this.transientStore.getItem(`spa-cache-${route}`);
                    if (oldString) {
                        oldSize = new Blob([oldString]).size;
                    }
                } catch (e) {
                    // Игнорируем ошибки
                }
            }
        }
        
        // Проверяем, не превысит ли новый размер лимит
        const newTotalSize = this.currentSize - oldSize + dataSize;
        if (newTotalSize > this.maxSize) {
            // Вычисляем необходимое свободное место
            const requiredSpace = Math.max(0, newTotalSize - this.maxSize);
            // Удаляем самые старые данные до тех пор, пока не освободится место
            // Исключаем текущий route, чтобы не удалить данные, которые мы сейчас сохраняем
            this.evictOldest(requiredSpace, route);
        }
        
        // Обновляем состояние
        this.state[route] = data;
        this.currentSize = this.currentSize - oldSize + dataSize;
        this.lastUsed[route] = Date.now();
        // Обновляем время последней загрузки для проверки устаревания
        this.lastLoadTime[route] = Date.now();
        
        // Сохраняем в transientStore (sessionStorage) для сохранения между перезагрузками
        if (this.transientStore) {
            try {
                this.transientStore.setItem(`spa-cache-${route}`, dataString);
            } catch (e) {
                // Если ошибка QuotaExceededError, пытаемся освободить место
                if (e.name === 'QuotaExceededError' || e.code === 22) {
                    // Освобождаем место и пробуем снова
                    // Исключаем текущий route из удаления
                    this.evictOldest(dataSize, route);
                    try {
                        this.transientStore.setItem(`spa-cache-${route}`, dataString);
                    } catch (e2) {
                        // Откатываем изменения в памяти
                        this.currentSize = this.currentSize - dataSize + oldSize;
                        this.state[route] = oldSize > 0 ? this.state[route] : null;
                    }
                }
            }
        }
    }

    /**
     * Проверяет, есть ли данные для маршрута
     * Проверяет память и sessionStorage
     * Также проверяет, не устарели ли данные (на основе cacheMaxAge)
     * @param {string} route - маршрут страницы
     * @returns {boolean}
     */
    has(route) {
        // Проверяем, есть ли данные в памяти
        const hasInMemory = this.state[route] !== null && this.state[route] !== undefined;
        
        // Проверяем transientStore (sessionStorage)
        let hasInStorage = false;
        if (this.transientStore) {
            try {
                const cached = this.transientStore.getItem(`spa-cache-${route}`);
                hasInStorage = cached !== null;
            } catch (e) {
                // Игнорируем ошибки
            }
        }
        
        // Если данных нет ни в памяти, ни в storage
        if (!hasInMemory && !hasInStorage) {
            return false;
        }
        
        // Если данные есть, проверяем, не устарели ли они
        const lastLoad = this.lastLoadTime[route];
        if (lastLoad) {
            const age = Date.now() - lastLoad;
            // Если данные старше cacheMaxAge, считаем их устаревшими
            if (age > this.cacheMaxAge) {
                // Очищаем устаревшие данные
                this.clear(route);
                return false;
            }
            return true;
        }
        
        // Если lastLoadTime не установлен (старые данные из sessionStorage без установки lastLoadTime),
        // но теперь мы устанавливаем lastLoadTime при загрузке из sessionStorage,
        // так что эта проверка не должна выполняться для новых данных
        // Оставляем для обратной совместимости со старыми данными
        if (hasInMemory || hasInStorage) {
            // Если lastLoadTime не установлен, это старые данные - считаем их устаревшими
            // Но теперь мы устанавливаем lastLoadTime при загрузке, так что это редко
            if (!this.lastLoadTime[route]) {
                this.clear(route);
                return false;
            }
            // Если lastLoadTime установлен, данные актуальны
            return true;
        }
        
        return false;
    }

    /**
     * Удаляет самые старые данные (LRU - Least Recently Used)
     * Используется при превышении лимита памяти
     * @param {number} requiredSpace - необходимое свободное место в байтах
     * @param {string} excludeRoute - route, который нужно исключить из удаления (опционально)
     */
    evictOldest(requiredSpace = 0, excludeRoute = null) {
        // Создаем массив routes с временем использования
        const routesWithTime = Object.keys(this.state)
            .filter(route => {
                // Пропускаем null/undefined данные и исключаемый route
                return route !== excludeRoute &&
                       this.state[route] !== null && 
                       this.state[route] !== undefined &&
                       this.lastUsed[route] !== undefined;
            })
            .map(route => ({
                route,
                lastUsed: this.lastUsed[route] || 0
            }))
            .sort((a, b) => a.lastUsed - b.lastUsed); // Сортируем по времени использования (старые первыми)
        
        let freedSpace = 0;
        
        // Удаляем самые старые данные пока не освободится достаточно места
        for (const { route } of routesWithTime) {
            if (freedSpace >= requiredSpace) {
                break;
            }
            
            try {
                // Вычисляем размер данных
                if (this.transientStore) {
                    const cached = this.transientStore.getItem(`spa-cache-${route}`);
                    if (cached) {
                        const dataSize = new Blob([cached]).size;
                        
                        // Удаляем из памяти и transientStore (sessionStorage)
                        this.state[route] = null;
                        delete this.lastUsed[route];
                        delete this.lastLoadTime[route];
                        this.transientStore.removeItem(`spa-cache-${route}`);
                        
                        // Обновляем размер
                        this.currentSize -= dataSize;
                        freedSpace += dataSize;
                    }
                }
            } catch (e) {
                // Игнорируем ошибки при удалении
            }
        }
    }

    /**
     * Очищает данные для маршрута
     * Очищает память и sessionStorage
     * @param {string} route - маршрут страницы (опционально, если не указан - очищает все)
     */
    clear(route) {
        if (route) {
            if (route in this.state) {
                // Вычисляем размер перед удалением
                if (this.transientStore) {
                    try {
                        const cached = this.transientStore.getItem(`spa-cache-${route}`);
                        if (cached) {
                            const dataSize = new Blob([cached]).size;
                            this.currentSize -= dataSize;
                        }
                    } catch (e) {
                        // Игнорируем ошибки
                    }
                }
                
                this.state[route] = null;
                delete this.lastUsed[route];
                delete this.lastLoadTime[route];
                
                // Очищаем из transientStore (sessionStorage)
                if (this.transientStore) {
                    try {
                        this.transientStore.removeItem(`spa-cache-${route}`);
                    } catch (e) {
                        // Игнорируем ошибки
                    }
                }
            }
        } else {
            // Очищаем все данные
            Object.keys(this.state).forEach(key => {
                // Вычисляем размер перед удалением
                if (this.transientStore) {
                    try {
                        const cached = this.transientStore.getItem(`spa-cache-${key}`);
                        if (cached) {
                            const dataSize = new Blob([cached]).size;
                            this.currentSize -= dataSize;
                        }
                    } catch (e) {
                        // Игнорируем ошибки
                    }
                }
                
                this.state[key] = null;
                delete this.lastUsed[key];
                delete this.lastLoadTime[key];
                
                // Очищаем из transientStore (sessionStorage)
                if (this.transientStore) {
                    try {
                        this.transientStore.removeItem(`spa-cache-${key}`);
                    } catch (e) {
                        // Игнорируем ошибки
                    }
                }
            });
        }
    }

    /**
     * Получает все состояние
     * @returns {Object}
     */
    getAll() {
        return { ...this.state };
    }

    /**
     * Получает настройку пользователя из persistentStore (localStorage)
     * @param {string} key - ключ настройки
     * @param {*} defaultValue - значение по умолчанию, если настройка не найдена
     * @returns {*} значение настройки или defaultValue
     */
    getSetting(key, defaultValue = null) {
        if (!this.persistentStore || !key || typeof key !== 'string') {
            return defaultValue;
        }
        
        try {
            const value = this.persistentStore.getItem(`spa-setting-${key}`);
            if (value === null) {
                return defaultValue;
            }
            return JSON.parse(value);
        } catch (e) {
            // Игнорируем ошибки парсинга
            return defaultValue;
        }
    }

    /**
     * Устанавливает настройку пользователя в persistentStore (localStorage)
     * @param {string} key - ключ настройки
     * @param {*} value - значение настройки
     * @returns {boolean} true если успешно, false при ошибке
     */
    setSetting(key, value) {
        if (!this.persistentStore || !key || typeof key !== 'string') {
            return false;
        }
        
        try {
            const valueString = JSON.stringify(value);
            this.persistentStore.setItem(`spa-setting-${key}`, valueString);
            return true;
        } catch (e) {
            // Обрабатываем ошибки переполнения localStorage
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                console.warn('Store: localStorage quota exceeded, cannot save setting:', key);
            }
            return false;
        }
    }

    /**
     * Удаляет настройку пользователя из persistentStore (localStorage)
     * @param {string} key - ключ настройки
     * @returns {boolean} true если успешно, false при ошибке
     */
    removeSetting(key) {
        if (!this.persistentStore || !key || typeof key !== 'string') {
            return false;
        }
        
        try {
            this.persistentStore.removeItem(`spa-setting-${key}`);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Очищает все настройки пользователя из persistentStore (localStorage)
     * @returns {boolean} true если успешно, false при ошибке
     */
    clearSettings() {
        if (!this.persistentStore) {
            return false;
        }
        
        try {
            // Удаляем только настройки приложения (с префиксом spa-setting-)
            const keysToRemove = [];
            for (let i = 0; i < this.persistentStore.length; i++) {
                const key = this.persistentStore.key(i);
                if (key && key.startsWith('spa-setting-')) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => {
                this.persistentStore.removeItem(key);
            });
            return true;
        } catch (e) {
            return false;
        }
    }
}

