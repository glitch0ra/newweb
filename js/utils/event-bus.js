/**
 * EventBus - централизованная система событий для устранения циклических зависимостей
 * Использует паттерн Observer для связи между модулями
 */
class EventBus {
    constructor() {
        this.listeners = new Map();
    }

    /**
     * Подписывается на событие
     * @param {string} event - название события
     * @param {Function} callback - функция-обработчик
     * @returns {Function} функция для отписки
     */
    on(event, callback) {
        if (!event || typeof event !== 'string') return () => {};
        if (!callback || typeof callback !== 'function') return () => {};
        
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);

        // Возвращаем функцию для отписки
        return () => this.off(event, callback);
    }

    /**
     * Отписывается от события
     * @param {string} event - название события
     * @param {Function} callback - функция-обработчик для удаления
     */
    off(event, callback) {
        if (!event || typeof event !== 'string') return;
        if (!callback || typeof callback !== 'function') return;
        if (!this.listeners.has(event)) return;

        const callbacks = this.listeners.get(event);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
            callbacks.splice(index, 1);
        }

        // Удаляем массив, если он пуст
        if (callbacks.length === 0) {
            this.listeners.delete(event);
        }
    }

    /**
     * Эмитирует событие
     * @param {string} event - название события
     * @param {*} data - данные для передачи обработчикам
     */
    emit(event, data) {
        if (!event || typeof event !== 'string') return;
        if (!this.listeners.has(event)) return;

        const callbacks = this.listeners.get(event);
        // Вызываем все обработчики
        callbacks.forEach(callback => {
            if (callback && typeof callback === 'function') {
                try {
                    callback(data);
                } catch (error) {
                    // Игнорируем ошибки в обработчиках
                }
            }
        });
    }

    /**
     * Подписывается на событие один раз
     * @param {string} event - название события
     * @param {Function} callback - функция-обработчик
     */
    once(event, callback) {
        if (!event || typeof event !== 'string') return;
        if (!callback || typeof callback !== 'function') return;
        
        const wrapper = (data) => {
            if (callback && typeof callback === 'function') {
                callback(data);
            }
            this.off(event, wrapper);
        };
        this.on(event, wrapper);
    }

    /**
     * Очищает все подписки на событие
     * @param {string} event - название события (опционально, если не указано - очищает все)
     */
    clear(event) {
        if (event && typeof event === 'string') {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
        }
    }
}

// EventBus будет создан в Application

