class DataLoader {
    constructor(dataValidator = null, preloader = null, store = null, loaderAnimation = null) {
        this.dataValidator = dataValidator;
        this.preloader = preloader;
        this.store = store; // Store для кэширования по route (единственный источник кэша)
        this.loaderAnimation = loaderAnimation; // LoaderAnimation для показа/скрытия загрузчика
        
        // Маппинг путей к маршрутам для использования Store
        // Используем конфигурацию роутов из APP_CONFIG
        const routesConfig = typeof window !== 'undefined' && window.APP_CONFIG?.ROUTES || {};
        this.pathToRouteMap = {};
        Object.keys(routesConfig).forEach(route => {
            if (routesConfig[route] && routesConfig[route].dataPath) {
                this.pathToRouteMap[routesConfig[route].dataPath] = route;
            }
        });
        
        // Fallback для обратной совместимости, если APP_CONFIG не загружен
        if (Object.keys(this.pathToRouteMap).length === 0) {
            this.pathToRouteMap = {
                'data/main.json': 'main',
                'data/collections.json': 'collections',
                'data/screenshots.json': 'screenshots',
                'data/videos.json': 'videos',
                'data/history.json': 'history',
                'data/about.json': 'about'
            };
        }
    }
    
    /**
     * Получает route из path для использования Store
     * @param {string} path - путь к JSON файлу
     * @returns {string|null} - route или null если не найден
     */
    getRouteFromPath(path) {
        // Убираем query параметры если есть
        const cleanPath = path.split('?')[0];
        return this.pathToRouteMap[cleanPath] || null;
    }

    /**
     * Внутренний метод для выполнения одного запроса загрузки JSON
     * @param {string} path - путь к JSON файлу
     * @param {boolean} showLoader - показывать ли loader
     * @param {boolean} forceReload - принудительная перезагрузка
     * @param {AbortSignal|null} signal - сигнал для отмены запроса
     * @param {string} route - route для кэширования
     * @param {boolean} wasInStore - были ли данные в Store до загрузки
     * @returns {Promise<Object>} - загруженные и валидированные данные
     * @private
     */
    async _loadJSON(path, showLoader, forceReload, signal, route, wasInStore) {
        const mainContent = document.getElementById('main-content');
        if (!mainContent) {
            throw new Error('main-content element not found');
        }

        // Показываем loader если нужно
        if (showLoader && this.loaderAnimation && typeof this.loaderAnimation.show === 'function') {
            this.loaderAnimation.show(mainContent);
        }

        try {
            // Проверяем, не отменен ли запрос перед fetch
            if (signal && signal.aborted) {
                throw new DOMException('The operation was aborted.', 'AbortError');
            }

            // Добавляем версионирование данных для предотвращения использования старых кэшированных данных
            // Версия берется из APP_CONFIG.VERSION или используется значение по умолчанию
            const version = (typeof window !== 'undefined' && window.APP_CONFIG?.VERSION) || 'v1.0.1';
            
            // Формируем URL с версией и опциональным timestamp для forceReload
            // Версия гарантирует, что после деплоя новой версии пользователи получат свежие данные
            let url = path;
            const separator = path.includes('?') ? '&' : '?';
            
            if (forceReload) {
                // Для forceReload добавляем и версию, и timestamp
                url = `${path}${separator}v=${version}&t=${Date.now()}`;
            } else {
                // Для обычных запросов добавляем только версию
                url = `${path}${separator}v=${version}`;
            }
            
            // Для JSON файлов всегда используем 'no-cache' для гарантии актуальности данных
            const response = await fetch(url, {
                // no-cache: проверяет с сервером, но может использовать кэш если данные актуальны
                // no-store: полностью обходит кэш (используем для forceReload)
                cache: forceReload ? 'no-store' : 'no-cache',
                // Добавляем заголовок для предотвращения кэширования браузером
                headers: {
                    'Cache-Control': 'no-cache'
                },
                // Передаем signal для возможности отмены запроса
                signal: signal
            });
            
            if (!response.ok) {
                // Логируем HTTP ошибки для отладки
                const errorMessage = `HTTP error! status: ${response.status}, path: ${path}`;
                console.error(`DataLoader: ${errorMessage}`);
                throw new Error(errorMessage);
            }

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const errorMessage = `Invalid content type: ${contentType}, path: ${path}`;
                console.error(`DataLoader: ${errorMessage}`);
                throw new Error(errorMessage);
            }

            // Проверяем, не отменен ли запрос перед парсингом
            if (signal && signal.aborted) {
                throw new DOMException('The operation was aborted.', 'AbortError');
            }

            const data = await response.json();
            
            // Проверяем, не отменен ли запрос после парсинга
            if (signal && signal.aborted) {
                throw new DOMException('The operation was aborted.', 'AbortError');
            }
            
            // Валидация данных перед кэшированием
            const validatedData = this.validateData(path, data);
            if (!validatedData) {
                const errorMessage = `Data validation failed for path: ${path}`;
                console.error(`DataLoader: ${errorMessage}`);
                throw new Error(errorMessage);
            }
            
            // Проверяем, не отменен ли запрос перед кэшированием
            if (signal && signal.aborted) {
                throw new DOMException('The operation was aborted.', 'AbortError');
            }
            
            // Сохраняем данные в Store (единственный источник кэша)
            if (route && this.store) {
                this.store.set(route, validatedData);
            }

            // Preload media from validated data
            // НЕ загружаем медиа повторно, если данные уже были в Store
            // Это предотвращает повторную загрузку медиа при переключении вкладок
            if (this.preloader && typeof this.preloader.preloadFromData === 'function') {
                // Загружаем медиа только если это НЕ повторная загрузка из Store
                // wasInStore = true означает, что данные были в Store и мы их вернули раньше
                // В этом случае медиа уже загружены, не загружаем их повторно
                if (!wasInStore) {
                    // Don't await to not block rendering
                    this.preloader.preloadFromData(validatedData).catch(() => {
                        // Игнорируем ошибки предзагрузки
                    });
                }
            }

            // Скрываем loader если был показан
            if (showLoader && this.loaderAnimation && typeof this.loaderAnimation.hide === 'function') {
                this.loaderAnimation.hide(mainContent);
            }

            // Возвращаем валидированные данные, а не исходные
            return validatedData;
        } catch (error) {
            // Скрываем loader при ошибке если был показан
            if (showLoader && this.loaderAnimation && typeof this.loaderAnimation.hide === 'function') {
                this.loaderAnimation.hide(mainContent);
            }
            
            // Пробрасываем ошибку дальше для обработки retry-логикой
            throw error;
        }
    }

    /**
     * Загружает JSON данные с retry-логикой для обработки сетевых ошибок
     * @param {string} path - путь к JSON файлу
     * @param {boolean} showLoader - показывать ли loader
     * @param {boolean} forceReload - принудительная перезагрузка
     * @param {AbortSignal|null} signal - сигнал для отмены запроса
     * @param {number} retries - количество попыток повтора (по умолчанию 3)
     * @returns {Promise<Object>} - загруженные и валидированные данные
     */
    async loadJSON(path, showLoader = false, forceReload = false, signal = null, retries = 3) {
        if (!path || typeof path !== 'string') {
            throw new Error('Invalid path provided to loadJSON');
        }

        // Проверяем, не отменен ли запрос
        if (signal && signal.aborted) {
            throw new DOMException('The operation was aborted.', 'AbortError');
        }

        // Получаем route из path для использования Store
        const route = this.getRouteFromPath(path);
        
        // Проверяем, были ли данные в Store до загрузки (для определения необходимости предзагрузки медиа)
        const wasInStore = route && this.store && !forceReload && this.store.has(route);

        // Если forceReload = false и данные есть в Store, используем Store
        // Если forceReload = true, всегда загружаем новые данные
        if (!forceReload && route && this.store && this.store.has(route)) {
            // Данные уже в Store - возвращаем их без сетевого запроса
            const cachedData = this.store.get(route);
            if (cachedData) {
                return cachedData;
            }
        }
        
        // Если forceReload = true, очищаем кэш в Store
        if (forceReload && route && this.store) {
            this.store.clear(route);
        }

        // Retry-логика для обработки сетевых ошибок
        for (let i = 0; i < retries; i++) {
            try {
                return await this._loadJSON(path, showLoader, forceReload, signal, route, wasInStore);
            } catch (error) {
                // Не повторяем запрос для AbortError (отмена запроса пользователем)
                if (error && error.name === 'AbortError') {
                    throw error;
                }

                // Если это последняя попытка, пробрасываем ошибку
                if (i === retries - 1) {
                    console.error(`DataLoader: Failed to load ${path} after ${retries} attempts. Last error:`, error);
                    throw error;
                }

                // Логируем попытку повтора
                const delay = 1000 * (i + 1); // Экспоненциальная задержка: 1s, 2s, 3s
                console.warn(`DataLoader: Retry ${i + 1}/${retries - 1} for ${path} after ${delay}ms. Error:`, error.message || error);

                // Проверяем, не отменен ли запрос перед задержкой
                if (signal && signal.aborted) {
                    throw new DOMException('The operation was aborted.', 'AbortError');
                }

                // Ждем перед следующей попыткой (экспоненциальная задержка)
                await new Promise(resolve => setTimeout(resolve, delay));

                // Проверяем, не отменен ли запрос после задержки
                if (signal && signal.aborted) {
                    throw new DOMException('The operation was aborted.', 'AbortError');
                }
            }
        }
    }

    async loadMain(showLoader = true, signal = null) {
        return this.loadJSON('data/main.json', showLoader, false, signal);
    }

    async loadCollections(showLoader = true, forceReload = false, signal = null) {
        return this.loadJSON('data/collections.json', showLoader, forceReload, signal);
    }

    async loadScreenshots(showLoader = true, signal = null) {
        return this.loadJSON('data/screenshots.json', showLoader, false, signal);
    }

    async loadVideos(showLoader = true, signal = null) {
        return this.loadJSON('data/videos.json', showLoader, false, signal);
    }

    async loadHistory(showLoader = true, signal = null) {
        return this.loadJSON('data/history.json', showLoader, false, signal);
    }

    async loadAbout(showLoader = true, signal = null) {
        return this.loadJSON('data/about.json', showLoader, false, signal);
    }

    /**
     * Валидирует данные в зависимости от пути файла
     * @param {string} path - путь к JSON файлу
     * @param {Object} data - данные для валидации
     * @returns {Object|null} - валидированные данные или null при ошибке
     */
    validateData(path, data) {
        if (!this.dataValidator) {
            return data;
        }

        const validator = this.dataValidator;

        // Маппинг путей к методам валидации
        const validationMap = {
            'main.json': 'validateMain',
            'collections.json': 'validateCollections',
            'screenshots.json': 'validateScreenshots',
            'videos.json': 'validateVideos',
            'history.json': 'validateHistory',
            'about.json': 'validateAbout'
        };

        try {
            // Находим соответствующий метод валидации
            const validationMethod = Object.keys(validationMap).find(key => path.includes(key));
            
            if (!validationMethod) {
                // Для неизвестных файлов возвращаем данные как есть
                return data;
            }

            const methodName = validationMap[validationMethod];
            if (typeof validator[methodName] !== 'function') {
                return data;
            }

            const validatedData = validator[methodName](data);

            // Проверяем ошибки валидации
            if (validator.hasErrors()) {
                // Валидатор уже вернул данные с значениями по умолчанию
                // Продолжаем работу с валидированными данными
            }

            return validatedData;
        } catch (error) {
            // В случае критической ошибки валидации возвращаем null
            return null;
        }
    }
}

// DataLoader будет создан в Application