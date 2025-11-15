// Parallax effect for background with infinite scroll
class Parallax {
    constructor() {
        this.backgroundVideo = document.getElementById('background-video');
        this.videoHeight = window.innerHeight;
        this.init();
    }

    init() {
        if (!this.backgroundVideo) return;

        // Create container for videos
        const container = document.createElement('div');
        container.className = 'background-video-container';
        this.backgroundVideo.parentNode.insertBefore(container, this.backgroundVideo);
        container.appendChild(this.backgroundVideo);

        // Create duplicate video for seamless loop
        const duplicate = this.backgroundVideo.cloneNode(true);
        duplicate.classList.add('background-video-duplicate');
        duplicate.id = '';
        duplicate.removeAttribute('id');
        container.appendChild(duplicate);

        // Wait for video to load
        const setupParallax = () => {
            this.videoHeight = window.innerHeight;
            this.setupInfiniteScroll(container);
        };

        this.backgroundVideo.addEventListener('loadedmetadata', setupParallax);

        if (this.backgroundVideo.readyState >= 2) {
            setupParallax();
        }

        // Fallback
        setTimeout(setupParallax, 500);
    }

    setupInfiniteScroll(container) {
        let ticking = false;

        const updateParallax = () => {
            const scrolled = window.pageYOffset;
            const rate = scrolled * 0.5;
            const videoHeight = this.videoHeight;

            // Calculate wrapped position for infinite scroll
            // This ensures the video loops seamlessly
            const wrappedPosition = ((rate % videoHeight) + videoHeight) % videoHeight;

            if (container) {
                // Move container up to create parallax effect
                // The duplicate video at 100vh creates seamless loop
                container.style.transform = `translateY(${-wrappedPosition}px)`;
            }

            ticking = false;
        };

        window.addEventListener('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(updateParallax);
                ticking = true;
            }
        }, {
            passive: true
        });

        // Update on resize to recalculate video height
        window.addEventListener('resize', () => {
            this.videoHeight = window.innerHeight;
        }, {
            passive: true
        });

        // Initial update
        updateParallax();
    }
}

// Initialize parallax after DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const parallax = new Parallax();
    });
} else {
    const parallax = new Parallax();
}