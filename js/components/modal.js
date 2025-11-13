class Modal {
  constructor() {
    this.modal = document.getElementById('modal');
    this.modalContent = document.getElementById('modal-content');
    this.modalClose = document.getElementById('modal-close');
    this.modalOverlay = this.modal?.querySelector('.modal-overlay');
    
    this.init();
  }

  init() {
    if (this.modalClose) {
      this.modalClose.addEventListener('click', () => this.close());
    }

    if (this.modalOverlay) {
      this.modalOverlay.addEventListener('click', () => this.close());
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        this.close();
      }
    });
  }

  open(content) {
    if (!this.modal || !this.modalContent) return;
    
    this.modalContent.innerHTML = content;
    this.modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Prevent scroll on modal content
    this.modalContent.scrollTop = 0;
  }

  close() {
    if (!this.modal) return;
    
    this.modal.classList.remove('active');
    document.body.style.overflow = '';
    
    // Clear content after animation
    setTimeout(() => {
      if (this.modalContent) {
        this.modalContent.innerHTML = '';
      }
    }, 300);
  }

  isOpen() {
    return this.modal?.classList.contains('active');
  }

  setContent(content) {
    if (this.modalContent) {
      this.modalContent.innerHTML = content;
    }
  }
}

const modal = new Modal();


