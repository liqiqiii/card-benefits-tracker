/**
 * github-sync.js — Sync user data to/from GitHub repo
 * Stores data as data/my-data.json in the repo via GitHub API
 * Enables cross-device sync (phone + computer)
 */

const GitHubSync = {
  _syncing: false,
  _debounceTimer: null,

  /**
   * Get sync config from localStorage (token + repo info)
   */
  getConfig() {
    try {
      return JSON.parse(localStorage.getItem('githubSyncConfig') || 'null');
    } catch {
      return null;
    }
  },

  saveConfig(config) {
    localStorage.setItem('githubSyncConfig', JSON.stringify(config));
  },

  isConfigured() {
    const config = this.getConfig();
    return config && config.token && config.owner && config.repo;
  },

  /**
   * Auto-detect repo info from the page URL if hosted on GitHub Pages
   */
  detectRepo() {
    const host = window.location.hostname;
    if (host.endsWith('.github.io')) {
      const owner = host.replace('.github.io', '');
      const pathParts = window.location.pathname.split('/').filter(Boolean);
      const repo = pathParts[0] || '';
      return { owner, repo };
    }
    return null;
  },

  /**
   * Load user data from the repo (data/my-data.json)
   */
  async loadFromRepo() {
    const config = this.getConfig();
    if (!config) return null;

    try {
      const resp = await fetch(
        `https://api.github.com/repos/${config.owner}/${config.repo}/contents/data/my-data.json`,
        {
          headers: {
            'Authorization': `Bearer ${config.token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      if (resp.status === 404) {
        // File doesn't exist yet — that's fine
        return null;
      }

      if (!resp.ok) {
        console.error('GitHub API error:', resp.status);
        return null;
      }

      const fileData = await resp.json();
      const content = atob(fileData.content);
      const parsed = JSON.parse(content);
      // Store the SHA for future updates
      config.fileSha = fileData.sha;
      this.saveConfig(config);
      return parsed;
    } catch (e) {
      console.error('Failed to load from GitHub:', e);
      return null;
    }
  },

  /**
   * Save user data to the repo (data/my-data.json)
   */
  async saveToRepo(data) {
    const config = this.getConfig();
    if (!config) return false;

    if (this._syncing) return false;
    this._syncing = true;

    try {
      // Get current file SHA (needed for updates)
      let sha = config.fileSha;
      if (!sha) {
        try {
          const checkResp = await fetch(
            `https://api.github.com/repos/${config.owner}/${config.repo}/contents/data/my-data.json`,
            {
              headers: {
                'Authorization': `Bearer ${config.token}`,
                'Accept': 'application/vnd.github.v3+json'
              }
            }
          );
          if (checkResp.ok) {
            const existing = await checkResp.json();
            sha = existing.sha;
          }
        } catch { /* file doesn't exist yet */ }
      }

      const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));

      const body = {
        message: `Update my card data — ${new Date().toISOString().split('T')[0]}`,
        content: content,
        branch: 'main'
      };
      if (sha) body.sha = sha;

      const resp = await fetch(
        `https://api.github.com/repos/${config.owner}/${config.repo}/contents/data/my-data.json`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${config.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        }
      );

      if (resp.ok) {
        const result = await resp.json();
        config.fileSha = result.content.sha;
        this.saveConfig(config);
        this._syncing = false;
        return true;
      } else {
        const err = await resp.text();
        console.error('GitHub save failed:', resp.status, err);
        this._syncing = false;
        return false;
      }
    } catch (e) {
      console.error('Failed to save to GitHub:', e);
      this._syncing = false;
      return false;
    }
  },

  /**
   * Debounced save — waits 2 seconds after last change before syncing
   */
  debouncedSave(data) {
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      this.saveToRepo(data).then(ok => {
        if (ok) {
          UI._showSyncIndicator('synced');
        } else {
          UI._showSyncIndicator('error');
        }
      });
      UI._showSyncIndicator('syncing');
    }, 2000);
  },

  /**
   * Validate a GitHub token by making a simple API call
   */
  async validateToken(token) {
    try {
      const resp = await fetch('https://api.github.com/user', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resp.ok) {
        const user = await resp.json();
        return { valid: true, login: user.login };
      }
      return { valid: false };
    } catch {
      return { valid: false };
    }
  }
};
