// Global page loader
window.loadPage = async function(route) {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    // Show loading animation
    if (window.LoaderAnimation) {
        LoaderAnimation.show(mainContent);
    }

    try {
        switch (route) {
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

        // Hide loader after content is rendered
        setTimeout(() => {
            if (window.LoaderAnimation) {
                LoaderAnimation.hide(mainContent);
            }
        }, 100);
    } catch (error) {
        console.error('Error loading page:', error);
        if (window.LoaderAnimation) {
            LoaderAnimation.hide(mainContent);
        }
        mainContent.innerHTML = '<div class="error">Ошибка загрузки данных</div>';
    }
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    // Router will handle initial route
    console.log('App initialized');
});