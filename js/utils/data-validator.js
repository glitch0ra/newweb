/**
 * Валидатор данных для проверки структуры JSON перед использованием
 * Предотвращает ошибки при отсутствии полей или неверных типах данных
 */
class DataValidator {
    constructor() {
        this.errors = [];
    }

    /**
     * Проверяет, является ли значение строкой
     * @param {*} value - значение для проверки
     * @param {string} fieldName - имя поля для сообщения об ошибке
     * @param {boolean} required - обязательное ли поле
     * @returns {string|null} - валидная строка или null
     */
    validateString(value, fieldName, required = true) {
        if (value === undefined || value === null) {
            if (required) {
                this.errors.push(`Missing required field: ${fieldName}`);
                return '';
            }
            return null;
        }
        if (typeof value !== 'string') {
            this.errors.push(`Field ${fieldName} must be a string, got ${typeof value}`);
            return String(value);
        }
        return value;
    }

    /**
     * Проверяет, является ли значение массивом
     * @param {*} value - значение для проверки
     * @param {string} fieldName - имя поля для сообщения об ошибке
     * @param {boolean} required - обязательное ли поле
     * @returns {Array|null} - валидный массив или null
     */
    validateArray(value, fieldName, required = true) {
        if (value === undefined || value === null) {
            if (required) {
                this.errors.push(`Missing required field: ${fieldName}`);
                return [];
            }
            return null;
        }
        if (!Array.isArray(value)) {
            this.errors.push(`Field ${fieldName} must be an array, got ${typeof value}`);
            return [];
        }
        return value;
    }

    /**
     * Проверяет, является ли значение объектом
     * @param {*} value - значение для проверки
     * @param {string} fieldName - имя поля для сообщения об ошибке
     * @param {boolean} required - обязательное ли поле
     * @returns {Object|null} - валидный объект или null
     */
    validateObject(value, fieldName, required = true) {
        if (value === undefined || value === null) {
            if (required) {
                this.errors.push(`Missing required field: ${fieldName}`);
                return {};
            }
            return null;
        }
        if (typeof value !== 'object' || Array.isArray(value)) {
            this.errors.push(`Field ${fieldName} must be an object, got ${typeof value}`);
            return {};
        }
        return value;
    }

    /**
     * Валидирует структуру поста (main.json)
     * @param {Object} post - объект поста
     * @returns {Object} - валидированный пост
     */
    validatePost(post) {
        if (!post || typeof post !== 'object') {
            this.errors.push('Post must be an object');
            return null;
        }

        const validated = {
            id: this.validateString(post.id, 'post.id'),
            date: this.validateString(post.date, 'post.date'),
            title: this.validateString(post.title, 'post.title'),
            description: this.validateString(post.description, 'post.description', false) || '',
            mainImage: this.validateString(post.mainImage, 'post.mainImage'),
            screenshots: this.validateArray(post.screenshots, 'post.screenshots', false) || [],
            video: this.validateVideo(post.video, 'post.video')
        };

        return validated;
    }

    /**
     * Валидирует структуру видео
     * @param {Object} video - объект видео
     * @param {string} fieldName - имя поля для сообщения об ошибке
     * @returns {Object} - валидированное видео
     */
    validateVideo(video, fieldName = 'video') {
        const videoObj = this.validateObject(video, fieldName);
        if (!videoObj) {
            return {
                url: '',
                thumbnail: '',
                duration: ''
            };
        }

        return {
            url: this.validateString(videoObj.url, `${fieldName}.url`),
            thumbnail: this.validateString(videoObj.thumbnail, `${fieldName}.thumbnail`, false) || '',
            duration: this.validateString(videoObj.duration, `${fieldName}.duration`, false) || ''
        };
    }

    /**
     * Валидирует структуру изображения в коллекции
     * @param {Object} image - объект изображения
     * @returns {Object} - валидированное изображение
     */
    validateCollectionImage(image) {
        if (!image || typeof image !== 'object') {
            this.errors.push('Collection image must be an object');
            return null;
        }

        const validated = {
            id: this.validateString(image.id, 'image.id'),
            url: this.validateString(image.url, 'image.url'),
            title: this.validateString(image.title, 'image.title', false) || '',
            description: this.validateString(image.description, 'image.description', false) || '',
            screenshots: this.validateArray(image.screenshots, 'image.screenshots', false) || [],
            videos: this.validateArray(image.videos, 'image.videos', false) || [],
            downloadLink: this.validateString(image.downloadLink, 'image.downloadLink', false) || ''
        };

        // Валидируем видео в массиве
        if (validated.videos.length > 0) {
            validated.videos = validated.videos.map((video, idx) => 
                this.validateVideo(video, `image.videos[${idx}]`)
            );
        }

        return validated;
    }

    /**
     * Валидирует структуру коллекции
     * @param {Object} collection - объект коллекции
     * @returns {Object} - валидированная коллекция
     */
    validateCollection(collection) {
        if (!collection || typeof collection !== 'object') {
            this.errors.push('Collection must be an object');
            return null;
        }

        const validated = {
            id: this.validateString(collection.id, 'collection.id'),
            title: this.validateString(collection.title, 'collection.title'),
            date: this.validateString(collection.date, 'collection.date', false) || null,
            description: this.validateString(collection.description, 'collection.description', false) || '',
            images: this.validateArray(collection.images, 'collection.images', false) || []
        };

        // Валидируем изображения в массиве
        if (validated.images.length > 0) {
            validated.images = validated.images
                .map(img => this.validateCollectionImage(img))
                .filter(img => img !== null);
        }

        return validated;
    }

    /**
     * Валидирует структуру группы скриншотов/видео
     * @param {Object} group - объект группы
     * @param {string} type - тип группы ('screenshots' или 'videos')
     * @returns {Object} - валидированная группа
     */
    validateGroup(group, type = 'screenshots') {
        if (!group || typeof group !== 'object') {
            this.errors.push(`Group must be an object`);
            return null;
        }

        const validated = {
            id: this.validateString(group.id, 'group.id'),
            title: this.validateString(group.title, 'group.title'),
            date: this.validateString(group.date, 'group.date', false) || null,
            description: this.validateString(group.description, 'group.description', false) || ''
        };

        if (type === 'screenshots') {
            validated.screenshots = this.validateArray(group.screenshots, 'group.screenshots', false) || [];
        } else if (type === 'videos') {
            validated.videos = this.validateArray(group.videos, 'group.videos', false) || [];
            // Валидируем видео в массиве
            if (validated.videos.length > 0) {
                validated.videos = validated.videos.map((video, idx) => {
                    if (!video || typeof video !== 'object') {
                        this.errors.push(`Group video[${idx}] must be an object`);
                        return {
                            url: '',
                            thumbnail: '',
                            duration: '',
                            title: ''
                        };
                    }
                    return {
                        url: this.validateString(video.url, `group.videos[${idx}].url`),
                        thumbnail: this.validateString(video.thumbnail, `group.videos[${idx}].thumbnail`, false) || '',
                        duration: this.validateString(video.duration, `group.videos[${idx}].duration`, false) || '',
                        title: this.validateString(video.title, `group.videos[${idx}].title`, false) || ''
                    };
                });
            }
        }

        return validated;
    }

    /**
     * Валидирует структуру записи истории
     * @param {Object} entry - объект записи
     * @returns {Object} - валидированная запись
     */
    validateHistoryEntry(entry) {
        if (!entry || typeof entry !== 'object') {
            this.errors.push('History entry must be an object');
            return null;
        }

        return {
            id: this.validateString(entry.id, 'entry.id'),
            date: this.validateString(entry.date, 'entry.date'),
            title: this.validateString(entry.title, 'entry.title'),
            description: this.validateString(entry.description, 'entry.description', false) || '',
            images: this.validateArray(entry.images, 'entry.images', false) || []
        };
    }

    /**
     * Валидирует структуру данных about.json
     * @param {Object} data - данные about
     * @returns {Object} - валидированные данные
     */
    validateAbout(data) {
        if (!data || typeof data !== 'object') {
            this.errors.push('About data must be an object');
            return null;
        }

        const profile = this.validateObject(data.profile, 'profile');
        const validated = {
            profile: profile ? {
                avatar: this.validateString(profile.avatar, 'profile.avatar', false) || '',
                nickname: this.validateString(profile.nickname, 'profile.nickname', false) || '',
                bio: this.validateString(profile.bio, 'profile.bio', false) || '',
                bioSecond: this.validateString(profile.bioSecond, 'profile.bioSecond', false) || ''
            } : {},
            timeline: this.validateArray(data.timeline, 'timeline', false) || [],
            links: this.validateArray(data.links, 'links', false) || [],
            stats: this.validateArray(data.stats, 'stats', false) || [],
            sections: this.validateArray(data.sections, 'sections', false) || []
        };

        // Валидируем элементы timeline
        if (validated.timeline.length > 0) {
            validated.timeline = validated.timeline.map((item, idx) => {
                if (!item || typeof item !== 'object') {
                    this.errors.push(`Timeline item[${idx}] must be an object`);
                    return { date: '', event: '' };
                }
                return {
                    date: this.validateString(item.date, `timeline[${idx}].date`, false) || '',
                    event: this.validateString(item.event, `timeline[${idx}].event`, false) || ''
                };
            });
        }

        // Валидируем ссылки
        if (validated.links.length > 0) {
            validated.links = validated.links.map((link, idx) => {
                if (!link || typeof link !== 'object') {
                    this.errors.push(`Link[${idx}] must be an object`);
                    return { name: '', url: '', icon: '' };
                }
                return {
                    name: this.validateString(link.name, `links[${idx}].name`, false) || '',
                    url: this.validateString(link.url, `links[${idx}].url`, false) || '',
                    icon: this.validateString(link.icon, `links[${idx}].icon`, false) || ''
                };
            });
        }

        // Валидируем статистику
        if (validated.stats.length > 0) {
            validated.stats = validated.stats.map((stat, idx) => {
                if (!stat || typeof stat !== 'object') {
                    this.errors.push(`Stat[${idx}] must be an object`);
                    return { number: '', label: '' };
                }
                return {
                    number: this.validateString(stat.number, `stats[${idx}].number`, false) || '',
                    label: this.validateString(stat.label, `stats[${idx}].label`, false) || ''
                };
            });
        }

        // Валидируем секции
        if (validated.sections.length > 0) {
            validated.sections = validated.sections.map((section, idx) => {
                if (!section || typeof section !== 'object') {
                    this.errors.push(`Section[${idx}] must be an object`);
                    return { title: '', description: '' };
                }
                return {
                    title: this.validateString(section.title, `sections[${idx}].title`, false) || '',
                    description: this.validateString(section.description, `sections[${idx}].description`, false) || ''
                };
            });
        }

        return validated;
    }

    /**
     * Валидирует данные main.json
     * @param {Object} data - данные main
     * @returns {Object} - валидированные данные
     */
    validateMain(data) {
        this.errors = [];
        if (!data || typeof data !== 'object') {
            this.errors.push('Main data must be an object');
            return null;
        }

        const posts = this.validateArray(data.posts, 'posts', false) || [];
        const validatedPosts = posts
            .map(post => this.validatePost(post))
            .filter(post => post !== null);

        return {
            posts: validatedPosts
        };
    }

    /**
     * Валидирует данные collections.json
     * @param {Object} data - данные collections
     * @returns {Object} - валидированные данные
     */
    validateCollections(data) {
        this.errors = [];
        if (!data || typeof data !== 'object') {
            this.errors.push('Collections data must be an object');
            return null;
        }

        const collections = this.validateArray(data.collections, 'collections', false) || [];
        const validatedCollections = collections
            .map(collection => this.validateCollection(collection))
            .filter(collection => collection !== null);

        return {
            collections: validatedCollections
        };
    }

    /**
     * Валидирует данные screenshots.json
     * @param {Object} data - данные screenshots
     * @returns {Object} - валидированные данные
     */
    validateScreenshots(data) {
        this.errors = [];
        if (!data || typeof data !== 'object') {
            this.errors.push('Screenshots data must be an object');
            return null;
        }

        const groups = this.validateArray(data.groups, 'groups', false) || [];
        const validatedGroups = groups
            .map(group => this.validateGroup(group, 'screenshots'))
            .filter(group => group !== null);

        return {
            groups: validatedGroups
        };
    }

    /**
     * Валидирует данные videos.json
     * @param {Object} data - данные videos
     * @returns {Object} - валидированные данные
     */
    validateVideos(data) {
        this.errors = [];
        if (!data || typeof data !== 'object') {
            this.errors.push('Videos data must be an object');
            return null;
        }

        const groups = this.validateArray(data.groups, 'groups', false) || [];
        const validatedGroups = groups
            .map(group => this.validateGroup(group, 'videos'))
            .filter(group => group !== null);

        return {
            groups: validatedGroups
        };
    }

    /**
     * Валидирует данные history.json
     * @param {Object} data - данные history
     * @returns {Object} - валидированные данные
     */
    validateHistory(data) {
        this.errors = [];
        if (!data || typeof data !== 'object') {
            this.errors.push('History data must be an object');
            return null;
        }

        const entries = this.validateArray(data.entries, 'entries', false) || [];
        const validatedEntries = entries
            .map(entry => this.validateHistoryEntry(entry))
            .filter(entry => entry !== null);

        return {
            entries: validatedEntries
        };
    }

    /**
     * Получить список ошибок валидации
     * @returns {Array<string>} - массив сообщений об ошибках
     */
    getErrors() {
        return this.errors;
    }

    /**
     * Очистить список ошибок
     */
    clearErrors() {
        this.errors = [];
    }

    /**
     * Проверить, есть ли ошибки валидации
     * @returns {boolean} - true если есть ошибки
     */
    hasErrors() {
        return this.errors.length > 0;
    }
}

// DataValidator будет создан в Application

