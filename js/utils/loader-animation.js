// Loading animation component
class LoaderAnimation {
  static create() {
    return `
      <div class="loader-container">
        <div class="loader-spinner">
          <div class="spinner-ring"></div>
          <div class="spinner-ring"></div>
          <div class="spinner-ring"></div>
          <div class="spinner-ring"></div>
        </div>
      </div>
    `;
  }

  static show(container) {
    if (!container) return;
    container.innerHTML = this.create();
  }

  static hide(container) {
    if (!container) return;
    const loader = container.querySelector('.loader-container');
    if (loader) {
      loader.style.opacity = '0';
      setTimeout(() => {
        if (loader.parentNode) {
          loader.remove();
        }
      }, 300);
    }
  }
}

