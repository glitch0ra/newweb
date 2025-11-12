class Router {
  constructor() {
    this.routes = {
      'main': 'main',
      'collections': 'collections',
      'screenshots': 'screenshots',
      'videos': 'videos',
      'history': 'history',
      'about': 'about'
    };
    this.currentRoute = null;
    this.init();
  }

  init() {
    window.addEventListener('hashchange', () => this.handleRoute());
    window.addEventListener('load', () => this.handleRoute());
    
    // Prevent default navigation for nav links
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const route = link.getAttribute('data-route');
        if (route) {
          window.location.hash = `#/${route}`;
        }
      });
    });
  }

  handleRoute() {
    const hash = window.location.hash.slice(2) || 'main';
    const route = this.routes[hash] || 'main';
    
    if (route !== this.currentRoute) {
      this.currentRoute = route;
      this.navigate(route);
    }
  }

  navigate(route) {
    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('data-route') === route) {
        link.classList.add('active');
      }
    });

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Load page content
    if (window.loadPage) {
      window.loadPage(route);
    }
  }

  getCurrentRoute() {
    return this.currentRoute || 'main';
  }
}

// Initialize router
const router = new Router();

