// Parallax effect for background with infinite scroll
class Parallax {
    constructor() {
        this.backgroundVideo = document.getElementById('background-video');
        this.videoHeight = window.innerHeight;
        this.container = null;
        this.scrollHandler = null;
        this.resizeHandler = null;
        this.loadedMetadataHandler = null;
        this.fallbackTimeout = null;
        this.init();
    }

    init() {
        if (!this.backgroundVideo || !this.backgroundVideo.parentNode) return;

        // Create container for videos
        this.container = document.createElement('div');
        this.container.className = 'background-video-container';
        if (this.backgroundVideo.parentNode && typeof this.backgroundVideo.parentNode.insertBefore === 'function') {
            this.backgroundVideo.parentNode.insertBefore(this.container, this.backgroundVideo);
        }
        if (this.container && typeof this.container.appendChild === 'function') {
            this.container.appendChild(this.backgroundVideo);
        }

        // Create duplicate video for seamless loop
        const duplicate = this.backgroundVideo.cloneNode(true);
        duplicate.classList.add('background-video-duplicate');
        duplicate.id = '';
        duplicate.removeAttribute('id');
        this.container.appendChild(duplicate);

        // Wait for video to load
        const setupParallax = () => {
            this.videoHeight = window.innerHeight;
            this.setupInfiniteScroll(this.container);
        };

        // Сохраняем ссылку на обработчик для последующего удаления
        this.loadedMetadataHandler = setupParallax;
        if (this.backgroundVideo && typeof this.backgroundVideo.addEventListener === 'function') {
            this.backgroundVideo.addEventListener('loadedmetadata', this.loadedMetadataHandler);
        }

        if (this.backgroundVideo.readyState >= 2) {
            setupParallax();
        }

        // Fallback - сохраняем timeout ID для очистки
        this.fallbackTimeout = setTimeout(setupParallax, 500);
    }

    setupInfiniteScroll(container) {
        let ticking = false;

        // Устанавливаем hardware acceleration для контейнера
        if (container) {
            container.style.willChange = 'transform';
            container.style.transform = 'translateZ(0)'; // Hardware acceleration
        }

        const updateParallax = () => {
            const scrolled = window.pageYOffset;
            const rate = scrolled * 0.5;
            const videoHeight = this.videoHeight;

            // Calculate wrapped position for infinite scroll
            // When rate reaches videoHeight, reset to 0 for seamless loop
            const wrappedPosition = rate % videoHeight;

            if (container) {
                // Move container up to create parallax effect
                // The duplicate video at 100vh creates seamless loop
                // When first video moves up by videoHeight, duplicate takes its place
                // Используем transform3d вместо translateY для лучшей производительности (hardware acceleration)
                container.style.transform = `translate3d(0, ${-wrappedPosition}px, 0)`;
            }

            ticking = false;
        };

        // Сохраняем ссылки на обработчики для последующего удаления
        // Ограничиваем частоту обновления с помощью requestAnimationFrame и флага ticking
        this.scrollHandler = () => {
            if (!ticking) {
                window.requestAnimationFrame(updateParallax);
                ticking = true;
            }
        };

        this.resizeHandler = () => {
            this.videoHeight = window.innerHeight;
        };

        if (typeof window.addEventListener === 'function') {
            window.addEventListener('scroll', this.scrollHandler, {
                passive: true
            });

            // Update on resize to recalculate video height
            window.addEventListener('resize', this.resizeHandler, {
                passive: true
            });
        }

        // Initial update
        updateParallax();
    }

    /**
     * Очищает все обработчики событий для предотвращения утечек памяти
     */
    cleanup() {
        // Удаляем обработчик loadedmetadata
        if (this.backgroundVideo && this.loadedMetadataHandler && typeof this.backgroundVideo.removeEventListener === 'function') {
            this.backgroundVideo.removeEventListener('loadedmetadata', this.loadedMetadataHandler);
            this.loadedMetadataHandler = null;
        }

        // Очищаем fallback timeout
        if (this.fallbackTimeout) {
            clearTimeout(this.fallbackTimeout);
            this.fallbackTimeout = null;
        }

        // Удаляем обработчики scroll и resize
        if (this.scrollHandler && typeof window.removeEventListener === 'function') {
            window.removeEventListener('scroll', this.scrollHandler);
            this.scrollHandler = null;
        }

        if (this.resizeHandler && typeof window.removeEventListener === 'function') {
            window.removeEventListener('resize', this.resizeHandler);
            this.resizeHandler = null;
        }

        // Очищаем ссылки
        this.backgroundVideo = null;
        this.container = null;
    }
}

// Initialize parallax after DOM is ready
// Сохраняем ссылку глобально для возможного cleanup (хотя обычно не требуется)
let parallaxInstance = null;

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        const initHandler = () => {
            parallaxInstance = new Parallax();
            if (typeof document.removeEventListener === 'function') {
                document.removeEventListener('DOMContentLoaded', initHandler);
            }
        };
        if (typeof document.addEventListener === 'function') {
            document.addEventListener('DOMContentLoaded', initHandler);
        }
    } else {
        parallaxInstance = new Parallax();
    }
}