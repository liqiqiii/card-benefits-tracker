/**
 * app.js — Main application logic, routing, initialization
 */

// ========================
// CONFETTI ENGINE
// ========================
const Confetti = {
  canvas: null,
  ctx: null,
  particles: [],
  animating: false,

  init() {
    this.canvas = document.getElementById('confetti-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  },

  burst() {
    const colors = ['#ff5252', '#ffab00', '#00c853', '#4f8cff', '#e040fb', '#00e5ff'];
    for (let i = 0; i < 40; i++) {
      this.particles.push({
        x: window.innerWidth / 2 + (Math.random() - 0.5) * 200,
        y: window.innerHeight / 2,
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 0.8) * 12,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 6 + 3,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        gravity: 0.3,
        life: 1
      });
    }
    if (!this.animating) {
      this.animating = true;
      this.animate();
    }
  },

  animate() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.rotation += p.rotationSpeed;
      p.life -= 0.015;
      p.vx *= 0.99;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate(p.rotation * Math.PI / 180);
      this.ctx.globalAlpha = p.life;
      this.ctx.fillStyle = p.color;
      this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      this.ctx.restore();
    }

    if (this.particles.length > 0) {
      requestAnimationFrame(() => this.animate());
    } else {
      this.animating = false;
    }
  }
};

// ========================
// APP CONTROLLER
// ========================
const App = {
  currentTab: 'dashboard',

  async init() {
    // Init confetti
    Confetti.init();

    // Check for auto-setup token in URL (?token=xxx)
    this._handleTokenFromUrl();

    // Load card catalog data
    await UI.loadCardData();
    UI.loadCustomCards();

    // Initialize storage (tries GitHub sync, falls back to localStorage)
    await Storage.init();

    // Clean up old redemption records
    Storage.cleanupOldRedemptions();

    // Set up tab navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });

    // Set up modal overlay click to close
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'modal-overlay') this.closeModal();
    });

    // Show hidden benefits toggle
    document.getElementById('btn-show-hidden').addEventListener('click', () => {
      UI.toggleShowHidden();
    });

    // Render initial view
    this.switchTab('dashboard');

    // Check for notifications
    this.checkNotifications();

    // Register service worker
    this.registerSW();
  },

  /**
   * Auto-configure sync from URL parameter: ?token=xxx
   * Clears the token from URL immediately after reading.
   */
  _handleTokenFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      const detected = GitHubSync.detectRepo();
      const config = GitHubSync.getConfig() || {};
      config.token = token;
      config.owner = config.owner || detected?.owner;
      config.repo = config.repo || detected?.repo;
      GitHubSync.saveConfig(config);

      // Clean the URL (remove token from browser history)
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, '', cleanUrl);

      // Show a toast after init completes
      setTimeout(() => {
        App.showToast('🔗 Sync connected! Your data will sync across devices.', 'success');
        UI._showSyncIndicator('synced');
      }, 500);
    }
  },

  switchTab(tab) {
    this.currentTab = tab;

    // Update tab button states
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    // Render the appropriate view
    switch (tab) {
      case 'dashboard':
        UI.renderDashboard();
        break;
      case 'wallet':
        UI.renderWallet();
        break;
      case 'catalog':
        UI.renderCatalog();
        break;
      case 'settings':
        UI.renderSettings();
        break;
    }

    // Scroll to top
    document.getElementById('main-content').scrollTop = 0;
  },

  openModal() {
    document.getElementById('modal-overlay').classList.remove('hidden');
  },

  closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
  },

  showToast(message, type) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type || ''}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  },

  checkNotifications() {
    const settings = Storage.getSettings();
    if (!settings.notificationsEnabled) return;

    const activeBenefits = UI.getActiveBenefits();
    Notifications.checkAndNotify(activeBenefits, settings.reminderDaysBefore);

    // Also check email reminders
    if (settings.emailReminders) {
      const needsReminder = Benefits.getBenefitsNeedingReminder(
        activeBenefits,
        settings.reminderDaysBefore
      );
      if (needsReminder.length > 0) {
        // Only send email once per day
        const lastEmail = localStorage.getItem('lastEmailReminder');
        const today = new Date().toISOString().split('T')[0];
        if (lastEmail !== today) {
          Notifications.sendEmailReminder(settings, needsReminder);
          localStorage.setItem('lastEmailReminder', today);
        }
      }
    }
  },

  async registerSW() {
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('sw.js');
      } catch (e) {
        console.log('SW registration skipped:', e.message);
      }
    }
  }
};

// Boot the app
document.addEventListener('DOMContentLoaded', () => App.init());
