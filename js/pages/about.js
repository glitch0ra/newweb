class AboutPage {
    constructor() {
        this.data = null;
    }

    async load() {
        try {
            this.data = await dataLoader.loadAbout(true);
            this.render();
        } catch (error) {
            this.renderError();
        }
    }

    render() {
        const mainContent = document.getElementById('main-content');
        if (!mainContent) return;

        const {
            profile,
            timeline,
            links,
            stats,
            sections
        } = this.data;

        mainContent.innerHTML = `
      <div class="about-page">
        <div class="about-block glass">
          <div class="about-profile">
            <img src="${profile.avatar}" alt="Avatar" class="about-avatar">
            <h1 class="about-nickname glitch" data-text="${profile.nickname}">${profile.nickname}</h1>
            <div class="about-bio">
              <p>${profile.bio}</p>
              <p>${profile.bioSecond}</p>
            </div>
          </div>
          
          <div class="about-timeline">
            <h2 class="about-section-title">История творчества</h2>
            <div class="timeline">
              ${timeline.map(item => `
                <div class="timeline-item">
                  <div class="timeline-date">${item.date}</div>
                  <div class="timeline-event">${item.event}</div>
                </div>
              `).join('')}
            </div>
          </div>
          
          <div class="about-links">
            ${links.map(link => `
              <a href="${link.url}" class="about-link" target="_blank" rel="noopener noreferrer">
                <span class="link-icon">${this.getIcon(link.icon)}</span>
                <span class="link-text">${link.name}</span>
              </a>
            `).join('')}
          </div>
          
          <div class="about-stats">
            ${stats.map(stat => `
              <div class="stat-card">
                <div class="stat-number">${stat.number}</div>
                <div class="stat-label">${stat.label}</div>
              </div>
            `).join('')}
          </div>
        </div>
        
        ${sections.map(section => `
          <div class="about-block glass">
            <h2 class="about-section-title">${section.title}</h2>
            <p class="about-section-description">${section.description}</p>
          </div>
        `).join('')}
      </div>
    `;
    }

    getIcon(iconName) {
        const icons = {
            instagram: '📷',
            behance: '🎨',
            artstation: '🖼️',
            email: '✉️'
        };
        return icons[iconName] || '🔗';
    }

    renderError() {
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.innerHTML = '<div class="error">Ошибка загрузки данных</div>';
        }
    }
}

const aboutPage = new AboutPage();