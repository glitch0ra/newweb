// Parallax effect for background
class Parallax {
  constructor() {
    this.backgroundVideo = document.getElementById('background-video');
    this.init();
  }

  init() {
    if (!this.backgroundVideo) return;

    let ticking = false;

    const updateParallax = () => {
      const scrolled = window.pageYOffset;
      const rate = scrolled * 0.5;
      
      if (this.backgroundVideo) {
        this.backgroundVideo.style.transform = `translateY(${rate}px)`;
      }
      
      ticking = false;
    };

    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(updateParallax);
        ticking = true;
      }
    }, { passive: true });
  }
}

// Initialize parallax
const parallax = new Parallax();

