/**
 * Базовый класс для всех страниц
 * Предоставляет общую функциональность и шаблонизацию
 */
class Page {
    // Приватный Symbol для опции safe в шаблонах
    // Используется для предотвращения XSS атак через инъекцию опций
    static SAFE_TEMPLATE = Symbol('safe');

    constructor(store = null) {
        this.store = store;
        this.data = null; // Локальная ссылка на данные из store
        this.eventHandlers = [];
        this.modalEventHandlers = [];
        this.observers = [];
        this.globalEventHandlers = []; // Обработчики на document/window
    }

    /**
     * Получить контейнер для контента страницы
     * @returns {HTMLElement|null}
     */
    getMainContent() {
        return document.getElementById('main-content');
    }

    /**
     * Экранирует HTML символы для защиты от XSS
     * @param {string} text - текст для экранирования
     * @returns {string} экранированный текст
     */
    escapeHTML(text) {
        if (text === null || text === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    /**
     * Экранирует текст для использования в атрибутах HTML
     * @param {string} text - текст для экранирования
     * @returns {string} экранированный текст
     */
    escapeAttribute(text) {
        if (text === null || text === undefined) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    /**
     * Валидирует и экранирует URL для защиты от XSS атак
     * Проверяет протокол и разрешает только безопасные: http, https, mailto, tel
     * Блокирует javascript:, data:, и другие опасные протоколы
     * @param {string} url - URL для валидации
     * @returns {string} безопасный URL или пустая строка
     */
    escapeURL(url) {
        if (!url || typeof url !== 'string') return '';

        const allowedProtocols = ['http:', 'https:', 'mailto:', 'tel:'];

        try {
            // Используем URL API для надежной проверки протокола
            // window.location.origin используется как база для относительных URL
            const parsed = new URL(url, window.location.origin);

            // Проверяем, что протокол в списке разрешенных
            if (!allowedProtocols.includes(parsed.protocol)) {
                return '';
            }

            // Возвращаем безопасный URL (href уже экранирован URL API)
            return parsed.href;
        } catch {
            // Если URL невалидный, возвращаем пустую строку
            return '';
        }
    }

    /**
     * Простая шаблонизация - заменяет плейсхолдеры в строке
     * ВАЖНО: По умолчанию все значения экранируются для защиты от XSS.
     * 
     * Для использования неэкранированного HTML используйте:
     * template(html, data, { [Page.SAFE_TEMPLATE]: true })
     * 
     * @param {string} template - шаблон с плейсхолдерами {{key}}
     * @param {Object} data - объект с данными для замены
     * @param {Object} options - опции (используйте Page.SAFE_TEMPLATE для неэкранированного HTML)
     * @returns {string}
     */
    template(template, data, options = {}) {
        // Безопасная проверка опций для предотвращения XSS через инъекцию опций
        // Используем Object.getOwnPropertyDescriptor() для безопасной проверки Symbol
        // Это предотвращает вызов кастомных toString() методов при конкатенации строк
        let safe = false;
        try {
            // Проверяем, что options - это объект
            if (options && typeof options === 'object' && !Array.isArray(options)) {
                // Используем безопасную проверку через Object.getOwnPropertyDescriptor()
                // Это предотвращает XSS через кастомные toString() методы
                const descriptor = Object.getOwnPropertyDescriptor(options, Page.SAFE_TEMPLATE);
                safe = descriptor && descriptor.value === true;
            }
        } catch (e) {
            // В случае ошибки считаем опцию небезопасной
            safe = false;
        }
        
        return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            // Если ключ отсутствует в данных, возвращаем пустую строку для предотвращения XSS
            // Возврат исходной строки {{key}} может быть использован для XSS-атак
            if (data[key] === undefined) {
                return '';
            }
            // По умолчанию экранируем все значения для защиты от XSS
            return safe ? data[key] : this.escapeHTML(data[key]);
        });
    }

    /**
     * Рендерит HTML из шаблона с данными
     * ВАЖНО: По умолчанию все значения экранируются для защиты от XSS.
     * 
     * Для использования неэкранированного HTML используйте:
     * renderTemplate(html, data, { [Page.SAFE_TEMPLATE]: true })
     * 
     * @param {string} html - HTML строка с плейсхолдерами
     * @param {Object} data - данные для замены
     * @param {Object} options - опции (используйте Page.SAFE_TEMPLATE для неэкранированного HTML)
     * @returns {string}
     */
    renderTemplate(html, data, options = {}) {
        // Безопасная проверка опций для предотвращения XSS через инъекцию опций
        // Используем Object.getOwnPropertyDescriptor() для безопасной проверки Symbol
        // Это предотвращает вызов кастомных toString() методов при конкатенации строк
        let safe = false;
        try {
            // Проверяем, что options - это объект
            if (options && typeof options === 'object' && !Array.isArray(options)) {
                // Используем безопасную проверку через Object.getOwnPropertyDescriptor()
                // Это предотвращает XSS через кастомные toString() методы
                const descriptor = Object.getOwnPropertyDescriptor(options, Page.SAFE_TEMPLATE);
                safe = descriptor && descriptor.value === true;
            }
        } catch (e) {
            // В случае ошибки считаем опцию небезопасной
            safe = false;
        }
        
        // Используем reduce() вместо цикла for...in для более эффективной обработки больших шаблонов
        // reduce() создает меньше промежуточных строк и работает быстрее
        return Object.entries(data).reduce((acc, [key, value]) => {
            // Если значение undefined, возвращаем пустую строку для предотвращения XSS
            if (value === undefined) {
                return acc.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), '');
            }
            // По умолчанию экранируем все значения для защиты от XSS
            const escapedValue = safe ? value : this.escapeHTML(value);
            return acc.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), escapedValue);
        }, html);
    }

    /**
     * Устанавливает HTML контент в main-content
     * Оптимизирует загрузку медиа, используя кэш браузера
     * @param {string} html - HTML строка
     */
    setContent(html) {
        const mainContent = this.getMainContent();
        if (mainContent) {
            mainContent.innerHTML = html;
            
            // Оптимизация: используем кэш браузера для уже загруженных медиа
            // Проверяем все изображения и видео после установки innerHTML
            this.optimizeMediaLoading(mainContent);
        }
    }

    /**
     * Оптимизирует загрузку медиа, используя кэш браузера
     * Проверяет, загружено ли уже изображение/видео, и использует кэш
     * @param {HTMLElement} container - контейнер с медиа-элементами
     */
    optimizeMediaLoading(container) {
        if (!container) return;

        // Оптимизация изображений
        const images = container.querySelectorAll('img');
        images.forEach(img => {
            const src = img.src || img.getAttribute('src');
            if (!src) return;

            // Проверяем, загружено ли уже изображение в браузере
            // Ищем существующие img элементы с таким же src в документе
            const existingImg = Array.from(document.querySelectorAll('img')).find(
                existing => existing !== img && 
                (existing.src === src || existing.getAttribute('src') === src) &&
                existing.complete &&
                existing.naturalWidth > 0
            );

            if (existingImg) {
                // Изображение уже загружено - используем кэш браузера
                // Устанавливаем src заново, чтобы браузер использовал кэш
                // Это предотвратит повторную загрузку
                img.loading = 'eager'; // Убираем lazy, так как изображение уже в кэше
                
                // Если изображение еще не загружено, но есть в кэше, браузер загрузит его из кэша
                // Это быстрее, чем загрузка с сервера
            }
        });

        // Оптимизация видео
        const videos = container.querySelectorAll('video');
        videos.forEach(video => {
            const source = video.querySelector('source');
            const src = source ? (source.src || source.getAttribute('src')) : (video.src || video.getAttribute('src'));
            if (!src) return;

            // Проверяем, загружено ли уже видео в браузере
            const existingVideo = Array.from(document.querySelectorAll('video')).find(
                existing => {
                    if (existing === video) return false;
                    const existingSource = existing.querySelector('source');
                    const existingSrc = existingSource 
                        ? (existingSource.src || existingSource.getAttribute('src'))
                        : (existing.src || existing.getAttribute('src'));
                    return existingSrc === src && existing.readyState >= 2;
                }
            );

            if (existingVideo) {
                // Видео уже загружено - используем кэш браузера
                video.preload = 'auto'; // Устанавливаем preload для использования кэша
            }
        });
    }

    /**
     * Абстрактный метод для получения route страницы
     * Должен быть переопределен в дочерних классах
     * @returns {string} route страницы
     */
    getRoute() {
        throw new Error('getRoute() must be implemented in child class');
    }

    /**
     * Абстрактный метод для загрузки данных
     * Должен быть переопределен в дочерних классах
     * @returns {Promise}
     */
    async loadData() {
        throw new Error('loadData() must be implemented in child class');
    }

    /**
     * Абстрактный метод для рендеринга контента
     * Должен быть переопределен в дочерних классах
     * @returns {string} HTML строка
     */
    renderContent() {
        throw new Error('renderContent() must be implemented in child class');
    }

    /**
     * Загружает данные и рендерит страницу
     * Использует Store для кэширования данных между переходами
     * @param {boolean} showLoader - показывать ли loader (по умолчанию true, если данные не в кэше)
     * @param {boolean} forceReload - принудительная перезагрузка данных
     * @param {AbortSignal} signal - сигнал для отмены запроса (опционально)
     */
    async load(showLoader = true, forceReload = false, signal = null) {
        try {
            // Проверяем, не отменен ли запрос
            if (signal && signal.aborted) {
                return;
            }

            const route = this.getRoute();
            
            // Если forceReload = true, очищаем кэш Store и загружаем новые данные
            if (forceReload && this.store) {
                this.store.clear(route);
            }
            
            // Проверяем, есть ли данные в Store (только если не forceReload)
            if (!forceReload && this.store && this.store.has(route)) {
                // Используем кэшированные данные из Store
                // Не показываем loader, так как данные уже загружены
                this.data = this.store.get(route);
                this.render();
            } else {
                // Проверяем, не отменен ли запрос перед загрузкой
                if (signal && signal.aborted) {
                    return;
                }

                // Загружаем данные (loader будет показан в loadData, если нужно)
                // Передаем forceReload и signal в loadData
                this.data = await this.loadData(showLoader, forceReload, signal);
                
                // Проверяем, не отменен ли запрос после загрузки
                if (signal && signal.aborted) {
                    return;
                }
                
                // Сохраняем в Store для переиспользования
                if (this.store) {
                    this.store.set(route, this.data);
                }
                
                this.render();
            }
        } catch (error) {
            // Игнорируем ошибки отмены запроса (AbortError)
            if (error && error.name === 'AbortError') {
                return;
            }
            this.renderError();
        }
    }

    /**
     * Рендерит страницу
     */
    render() {
        const mainContent = this.getMainContent();
        if (!mainContent) return;

        const html = this.renderContent();
        if (html) {
            this.setContent(html);
        }

        // Вызываем метод для настройки после рендеринга
        if (typeof this.afterRender === 'function') {
            this.afterRender();
        }
    }

    /**
     * Рендерит ошибку загрузки
     */
    renderError() {
        this.setContent('<div class="error">Error loading data</div>');
    }

    /**
     * Очищает все обработчики событий и наблюдатели
     */
    cleanup() {
        // Удаляем все обработчики событий
        this.eventHandlers.forEach(({ element, event, handler }) => {
            if (element && typeof element.removeEventListener === 'function') {
                // Проверяем, что элемент все еще существует или это глобальный объект
                if (element === document || element === window || element.parentNode || (document.body && document.body.contains(element))) {
                    element.removeEventListener(event, handler);
                }
            }
        });
        this.eventHandlers = [];

        // Удаляем обработчики модальных окон
        this.modalEventHandlers.forEach(({ element, event, handler }) => {
            if (element && typeof element.removeEventListener === 'function') {
                if (element === document || element === window || element.parentNode || (document.body && document.body.contains(element))) {
                    element.removeEventListener(event, handler);
                }
            }
        });
        this.modalEventHandlers = [];

        // Удаляем глобальные обработчики (document/window)
        this.globalEventHandlers.forEach(({ element, event, handler }) => {
            if (element && typeof element.removeEventListener === 'function') {
                element.removeEventListener(event, handler);
            }
        });
        this.globalEventHandlers = [];

        // Отключаем всех наблюдателей
        this.observers.forEach(observer => {
            if (observer && typeof observer.disconnect === 'function') {
                observer.disconnect();
            }
        });
        this.observers = [];

        // Очищаем локальную ссылку на данные
        // НЕ очищаем данные из Store, чтобы они были доступны при следующем переходе
        this.data = null;
    }

    /**
     * Добавляет обработчик события с автоматическим сохранением для cleanup
     * @param {HTMLElement} element - элемент
     * @param {string} event - тип события
     * @param {Function} handler - обработчик
     * @param {string} type - тип обработчика (для группировки)
     * @param {Object} metadata - дополнительные метаданные (например, groupId)
     */
    addEventListener(element, event, handler, type = 'default', metadata = {}) {
        if (!element || typeof element.addEventListener !== 'function') return;
        element.addEventListener(event, handler);
        this.eventHandlers.push({ element, event, handler, type, ...metadata });
    }

    /**
     * Добавляет обработчик события для модального окна
     * @param {HTMLElement} element - элемент
     * @param {string} event - тип события
     * @param {Function} handler - обработчик
     */
    addModalEventListener(element, event, handler) {
        if (!element || typeof element.addEventListener !== 'function') return;
        element.addEventListener(event, handler);
        this.modalEventHandlers.push({ element, event, handler });
    }

    /**
     * Добавляет наблюдатель для автоматической очистки
     * @param {IntersectionObserver|MutationObserver|etc} observer - наблюдатель
     */
    addObserver(observer) {
        if (observer) {
            this.observers.push(observer);
        }
    }

    /**
     * Добавляет обработчик события на document или window с автоматическим сохранением для cleanup
     * @param {Document|Window} element - document или window
     * @param {string} event - тип события
     * @param {Function} handler - обработчик
     */
    addGlobalEventListener(element, event, handler) {
        if (!element || (element !== document && element !== window) || typeof element.addEventListener !== 'function') {
            return;
        }
        element.addEventListener(event, handler);
        this.globalEventHandlers.push({ element, event, handler });
    }
}

