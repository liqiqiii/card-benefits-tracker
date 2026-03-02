/**
 * github-sync.js — Sync user data to/from GitHub repo
 * Stores data as data/my-data.json in the repo via GitHub API
 * Enables cross-device sync (phone + computer)
 *
 * Two-layer approach:
 *  READ: Always fetch data/my-data.json from GitHub raw URL (no auth needed, public repo)
 *  WRITE: Use GitHub API with PAT to commit changes back
 */

const GitHubSync = {
  _syncing: false,
  _debounceTimer: null,
  _writeQueue: null,

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
   * READ: Fetch user data from the repo.
   * Try 1: raw GitHub URL (no auth, works for public repos, always fresh)
   * Try 2: GitHub API with PAT (works for private repos too)
   * Try 3: local path (works when running locally / on Pages after deploy)
   */
  async loadFromRepo() {
    // Determine repo info
    const detected = this.detectRepo();
    const config = this.getConfig();
    const owner = config?.owner || detected?.owner;
    const repo = config?.repo || detected?.repo;

    if (owner && repo) {
      // Try 1: GitHub API (always fresh, no CDN cache)
      // Works without auth for public repos (60 req/hr rate limit)
      try {
        const headers = { 'Accept': 'application/vnd.github.v3+json' };
        if (config?.token) headers['Authorization'] = `Bearer ${config.token}`;

        const resp = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/data/my-data.json`,
          { headers, cache: 'no-store' }
        );
        if (resp.ok) {
          const fileData = await resp.json();
          const content = atob(fileData.content);
          // Save SHA for future writes
          if (config) {
            config.fileSha = fileData.sha;
            config.owner = owner;
            config.repo = repo;
            this.saveConfig(config);
          } else {
            this.saveConfig({ owner, repo, fileSha: fileData.sha });
          }
          return JSON.parse(content);
        }
      } catch (e) {
        console.log('API fetch failed, trying raw URL:', e.message);
      }

      // Try 2: raw.githubusercontent.com (may be CDN-cached up to 5 min)
      try {
        const cacheBust = Date.now();
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/data/my-data.json?cb=${cacheBust}`;
        const resp = await fetch(rawUrl, { cache: 'no-store' });
        if (resp.ok) {
          return await resp.json();
        }
      } catch (e) {
        console.log('Raw URL fetch failed:', e.message);
      }
    }

    // Try 3: local path (works on GitHub Pages after deploy, or local dev)
    try {
      const resp = await fetch('data/my-data.json?cb=' + Date.now(), { cache: 'no-store' });
      if (resp.ok) {
        return await resp.json();
      }
    } catch (e) {
      console.log('Local fetch failed:', e.message);
    }

    return null;
  },

  /**
   * Fetch file SHA in the background (needed for writes)
   */
  async _fetchSha(config) {
    if (config.fileSha) return;
    try {
      const resp = await fetch(
        `https://api.github.com/repos/${config.owner}/${config.repo}/contents/data/my-data.json`,
        {
          headers: {
            'Authorization': `Bearer ${config.token}`,
            'Accept': 'application/vnd.github.v3+json'
          },
          cache: 'no-store'
        }
      );
      if (resp.ok) {
        const fileData = await resp.json();
        config.fileSha = fileData.sha;
        this.saveConfig(config);
      }
    } catch { /* ignore */ }
  },

  /**
   * WRITE: Save user data to the repo (data/my-data.json)
   */
  async saveToRepo(data) {
    const config = this.getConfig();
    if (!config?.token) return false;

    if (this._syncing) {
      // Queue the latest data so we don't lose changes
      this._writeQueue = data;
      return false;
    }
    this._syncing = true;

    try {
      // Get current file SHA if we don't have it
      if (!config.fileSha) {
        await this._fetchSha(config);
      }

      const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));

      const body = {
        message: `Sync card data — ${new Date().toISOString().replace('T', ' ').substring(0, 19)}`,
        content: content,
        branch: 'main'
      };
      if (config.fileSha) body.sha = config.fileSha;

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

        // Process queued write if any
        if (this._writeQueue) {
          const queued = this._writeQueue;
          this._writeQueue = null;
          return this.saveToRepo(queued);
        }
        return true;
      } else {
        // SHA conflict — re-fetch SHA and retry once
        const err = await resp.json().catch(() => ({}));
        if (resp.status === 409 || (err.message && err.message.includes('sha'))) {
          config.fileSha = null;
          this.saveConfig(config);
          this._syncing = false;
          return this.saveToRepo(data);
        }
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
   * Debounced save — waits 1.5 seconds after last change before syncing
   */
  debouncedSave(data) {
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      UI._showSyncIndicator('syncing');
      this.saveToRepo(data).then(ok => {
        if (ok) {
          UI._showSyncIndicator('synced');
        } else {
          UI._showSyncIndicator('error');
        }
      });
    }, 1500);
  },

  /**
   * Validate a GitHub token
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
