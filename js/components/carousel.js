class Carousel {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            itemsPerView: options.itemsPerView || 1,
            loop: options.loop !== false,
            draggable: options.draggable !== false,
            ...options
        };

        this.currentIndex = 0;
        this.items = [];
        this.isDragging = false;
        this.startX = 0;
        this.currentX = 0;
        this.offset = 0;

        this.init();
    }

    init() {
        if (!this.container) return;

        const carouselContainer = this.container.querySelector('.carousel-container');
        if (!carouselContainer) return;

        this.items = Array.from(carouselContainer.children);
        this.totalItems = this.items.length;

        if (this.totalItems === 0) return;

        // Create navigation
        this.createNavigation();

        // Setup drag
        if (this.options.draggable) {
            this.setupDrag();
        }

        // Setup touch
        this.setupTouch();

        // Wait for images to load before calculating sizes
        const images = carouselContainer.querySelectorAll('img');
        if (images.length > 0) {
            let loadedCount = 0;
            const totalImages = images.length;

            images.forEach(img => {
                if (img.complete) {
                    loadedCount++;
                } else {
                    img.addEventListener('load', () => {
                        loadedCount++;
                        if (loadedCount === totalImages) {
                            this.update();
                        }
                    });
                }
            });

            if (loadedCount === totalImages) {
                this.update();
            }
        } else {
            this.update();
        }

        // Update on resize
        window.addEventListener('resize', () => {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = setTimeout(() => this.update(), 100);
        });
    }

    createNavigation() {
        const prevBtn = document.createElement('button');
        prevBtn.className = 'carousel-nav prev';
        prevBtn.setAttribute('aria-label', 'Предыдущий');
        prevBtn.addEventListener('click', () => this.prev());

        const nextBtn = document.createElement('button');
        nextBtn.className = 'carousel-nav next';
        nextBtn.setAttribute('aria-label', 'Следующий');
        nextBtn.addEventListener('click', () => this.next());

        // Check if there's a wrapper (for collections)
        const wrapper = this.container.parentElement;
        if (wrapper && wrapper.classList.contains('collection-carousel-wrapper')) {
            wrapper.insertBefore(prevBtn, this.container);
            wrapper.appendChild(nextBtn);
        } else {
            this.container.appendChild(prevBtn);
            this.container.appendChild(nextBtn);
        }
    }

    setupDrag() {
        this.container.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.startX = e.pageX - this.container.offsetLeft;
            this.currentX = this.startX;
            this.container.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            e.preventDefault();
            this.currentX = e.pageX - this.container.offsetLeft;
            this.offset = this.currentX - this.startX;
            this.updateTransform();
        });

        document.addEventListener('mouseup', () => {
            if (!this.isDragging) return;
            this.isDragging = false;
            this.container.style.cursor = '';

            const threshold = 50;
            if (Math.abs(this.offset) > threshold) {
                if (this.offset > 0) {
                    this.prev();
                } else {
                    this.next();
                }
            }
            this.offset = 0;
            this.update();
        });
    }

    setupTouch() {
        let touchStartX = 0;
        let touchEndX = 0;

        this.container.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, {
            passive: true
        });

        this.container.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            const diff = touchStartX - touchEndX;
            if (Math.abs(diff) > 50) {
                if (diff > 0) {
                    this.next();
                } else {
                    this.prev();
                }
            }
        }, {
            passive: true
        });
    }

    updateTransform() {
        const carouselContainer = this.container.querySelector('.carousel-container');
        if (!carouselContainer) return;

        if (this.items.length === 0) return;

        let itemWidth;
        const firstItem = this.items[0];

        if (firstItem && firstItem.classList.contains('history-image')) {
            itemWidth = 252;
        } else if (firstItem && firstItem.classList.contains('collection-image-card')) {
            // Fixed width for collection images (252px) + margin
            const itemMargin = parseFloat(getComputedStyle(firstItem).marginRight) || 0;
            itemWidth = 252 + itemMargin;
        } else {
            const containerWidth = this.container.offsetWidth;
            itemWidth = containerWidth / this.options.itemsPerView;
        }

        const translateX = -(this.currentIndex * itemWidth) + this.offset;
        carouselContainer.style.transform = `translateX(${translateX}px)`;
        carouselContainer.style.transition = 'none';
    }

    update() {
        const carouselContainer = this.container.querySelector('.carousel-container');
        if (!carouselContainer) return;

        if (this.items.length === 0) return;

        // Check if items have fixed width (for history carousel)
        const firstItem = this.items[0];
        let itemWidth;

        if (firstItem && firstItem.classList.contains('history-image')) {
            // Fixed width for history images
            itemWidth = 252;
        } else if (firstItem && firstItem.classList.contains('collection-image-card')) {
            // Fixed width for collection images (252px) + margin
            const itemMargin = parseFloat(getComputedStyle(firstItem).marginRight) || 0;
            itemWidth = 252 + itemMargin;
        } else {
            // Set item width based on itemsPerView
            const containerWidth = this.container.offsetWidth;
            itemWidth = containerWidth / this.options.itemsPerView;
        }

        this.items.forEach(item => {
            item.style.width = `${itemWidth}px`;
            item.style.flexShrink = '0';
        });

        const translateX = -(this.currentIndex * itemWidth);
        carouselContainer.style.transform = `translateX(${translateX}px)`;
        carouselContainer.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
    }

    next() {
        if (this.options.loop) {
            this.currentIndex = (this.currentIndex + 1) % this.totalItems;
        } else {
            this.currentIndex = Math.min(this.currentIndex + 1, this.totalItems - this.options.itemsPerView);
        }
        this.update();
    }

    prev() {
        if (this.options.loop) {
            this.currentIndex = (this.currentIndex - 1 + this.totalItems) % this.totalItems;
        } else {
            this.currentIndex = Math.max(this.currentIndex - 1, 0);
        }
        this.update();
    }

    goTo(index) {
        if (index >= 0 && index < this.totalItems) {
            this.currentIndex = index;
            this.update();
        }
    }

    getCurrentIndex() {
        return this.currentIndex;
    }
}