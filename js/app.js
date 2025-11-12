// Global page loader
window.loadPage = async function(route) {
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;

  // Show loading
  mainContent.innerHTML = '<div class="loading">Загрузка...</div>';

  try {
    switch(route) {
      case 'main':
        await mainPage.load();
        break;
      case 'collections':
        await collectionsPage.load();
        break;
      case 'screenshots':
        await screenshotsPage.load();
        break;
      case 'videos':
        await videosPage.load();
        break;
      case 'history':
        await historyPage.load();
        break;
      case 'about':
        await aboutPage.load();
        break;
      default:
        window.location.hash = '#/main';
        await mainPage.load();
    }
  } catch (error) {
    console.error('Error loading page:', error);
    mainContent.innerHTML = '<div class="error">Ошибка загрузки данных</div>';
  }
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  // Router will handle initial route
  console.log('App initialized');
});

