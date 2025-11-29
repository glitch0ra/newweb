class AboutPage extends Page {
    constructor(store, dataLoader) {
        super(store);
        this.dataLoader = dataLoader;
    }

    getRoute() {
        return 'about';
    }

    async loadData(showLoader = true, forceReload = false, signal = null) {
        return await this.dataLoader.loadAbout(showLoader, signal);
    }

    renderContent() {
        if (!this.data) {
            return '<div class="error">No about data available</div>';
        }
        
        const {
            profile,
            timeline,
            links,
            stats,
            sections
        } = this.data;

        return `
      <div class="about-page">
        <div class="about-block glass">
          <div class="about-profile">
            <img src="${this.escapeAttribute(profile.avatar)}" alt="${this.escapeAttribute('Avatar')}" class="about-avatar" loading="lazy">
            <h1 class="about-nickname glitch" data-text="${this.escapeAttribute(profile.nickname)}">${this.escapeHTML(profile.nickname)}</h1>
            <div class="about-bio">
              <p>${this.escapeHTML(profile.bio)}</p>
              <p>${this.escapeHTML(profile.bioSecond)}</p>
            </div>
          </div>
          
          <div class="about-timeline">
            <h2 class="about-section-title">Creative History</h2>
            <div class="timeline">
              ${timeline.map(item => `
                <div class="timeline-item">
                  <div class="timeline-date">${this.escapeHTML(item.date)}</div>
                  <div class="timeline-event">${this.escapeHTML(item.event)}</div>
                </div>
              `).join('')}
            </div>
          </div>
          
          <div class="about-links">
            ${links.map(link => `
              <a href="${this.escapeURL(link.url)}" class="about-link" target="_blank" rel="noopener noreferrer">
                <span class="link-icon">${this.getIcon(link.icon)}</span>
                <span class="link-text">${this.escapeHTML(link.name)}</span>
              </a>
            `).join('')}
          </div>
          
          <div class="about-stats">
            ${stats.map(stat => `
              <div class="stat-card">
                <div class="stat-number">${this.escapeHTML(stat.number)}</div>
                <div class="stat-label">${this.escapeHTML(stat.label)}</div>
              </div>
            `).join('')}
          </div>
        </div>
        
        ${sections.map(section => `
          <div class="about-block glass">
            <h2 class="about-section-title">${this.escapeHTML(section.title)}</h2>
            <p class="about-section-description">${this.escapeHTML(section.description)}</p>
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

    cleanup() {
        // Вызываем cleanup родительского класса
        super.cleanup();
    }
}

// AboutPage будет создан в Application