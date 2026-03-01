/**
 * storage.js — localStorage abstraction for user data
 * Handles: myCards, hiddenBenefits, redeemedBenefits, settings
 * Includes JSON export/import for device transfer
 */

const STORAGE_KEY = 'cardBenefitsTracker';

const DEFAULT_DATA = {
  myCards: [],
  hiddenBenefits: [],
  redeemedBenefits: {},
  settings: {
    notificationsEnabled: false,
    emailReminders: false,
    emailAddress: '',
    emailjsServiceId: '',
    emailjsTemplateId: '',
    emailjsPublicKey: '',
    reminderDaysBefore: 7
  }
};

const Storage = {
  _cache: null,

  load() {
    if (this._cache) return this._cache;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Merge with defaults to handle new fields
        this._cache = {
          ...DEFAULT_DATA,
          ...parsed,
          settings: { ...DEFAULT_DATA.settings, ...(parsed.settings || {}) }
        };
      } else {
        this._cache = JSON.parse(JSON.stringify(DEFAULT_DATA));
      }
    } catch (e) {
      console.error('Failed to load data:', e);
      this._cache = JSON.parse(JSON.stringify(DEFAULT_DATA));
    }
    return this._cache;
  },

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._cache));
    } catch (e) {
      console.error('Failed to save data:', e);
    }
  },

  // Card management
  getMyCards() {
    return this.load().myCards;
  },

  addCard(cardId) {
    const data = this.load();
    if (!data.myCards.includes(cardId)) {
      data.myCards.push(cardId);
      this.save();
    }
  },

  removeCard(cardId) {
    const data = this.load();
    data.myCards = data.myCards.filter(id => id !== cardId);
    // Also clean up hidden/redeemed for this card's benefits
    data.hiddenBenefits = data.hiddenBenefits.filter(id => !id.startsWith(cardId.replace('amex-', 'amex-plat-')));
    this.save();
  },

  hasCard(cardId) {
    return this.load().myCards.includes(cardId);
  },

  // Benefit visibility
  getHiddenBenefits() {
    return this.load().hiddenBenefits;
  },

  toggleBenefitVisibility(benefitId) {
    const data = this.load();
    const idx = data.hiddenBenefits.indexOf(benefitId);
    if (idx === -1) {
      data.hiddenBenefits.push(benefitId);
    } else {
      data.hiddenBenefits.splice(idx, 1);
    }
    this.save();
    return idx === -1; // true = now hidden
  },

  isBenefitHidden(benefitId) {
    return this.load().hiddenBenefits.includes(benefitId);
  },

  // Benefit redemption
  getRedeemedBenefits() {
    return this.load().redeemedBenefits;
  },

  /**
   * Generate a period key for a benefit based on its frequency and the current date.
   * E.g., "amex-plat-uber-2026-03" for monthly, "amex-plat-saks-2026-H1" for semi-annual
   */
  _periodKey(benefitId, benefit, date) {
    date = date || new Date();
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // 1-12

    switch (benefit.frequency) {
      case 'monthly':
        return `${benefitId}-${year}-${String(month).padStart(2, '0')}`;
      case 'quarterly': {
        const quarter = Math.ceil(month / 3);
        return `${benefitId}-${year}-Q${quarter}`;
      }
      case 'semi-annual': {
        const half = month <= 6 ? 'H1' : 'H2';
        return `${benefitId}-${year}-${half}`;
      }
      case 'annual':
        return `${benefitId}-${year}`;
      default:
        return `${benefitId}-${year}-${String(month).padStart(2, '0')}`;
    }
  },

  isBenefitRedeemed(benefitId, benefit, date) {
    const key = this._periodKey(benefitId, benefit, date);
    return this.load().redeemedBenefits[key] || false;
  },

  getRedemptionDate(benefitId, benefit, date) {
    const key = this._periodKey(benefitId, benefit, date);
    const val = this.load().redeemedBenefits[key];
    return typeof val === 'string' ? val : null;
  },

  toggleBenefitRedeemed(benefitId, benefit, date) {
    const data = this.load();
    const key = this._periodKey(benefitId, benefit, date);
    if (data.redeemedBenefits[key]) {
      delete data.redeemedBenefits[key];
      this.save();
      return false; // now unredeemed
    } else {
      data.redeemedBenefits[key] = new Date().toISOString().split('T')[0];
      this.save();
      return true; // now redeemed
    }
  },

  // Settings
  getSettings() {
    return this.load().settings;
  },

  updateSettings(updates) {
    const data = this.load();
    data.settings = { ...data.settings, ...updates };
    this.save();
  },

  // Export/Import
  exportData() {
    const data = this.load();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `card-benefits-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  importData(jsonString) {
    try {
      const imported = JSON.parse(jsonString);
      // Validate structure
      if (!imported.myCards || !Array.isArray(imported.myCards)) {
        throw new Error('Invalid data format');
      }
      this._cache = {
        ...DEFAULT_DATA,
        ...imported,
        settings: { ...DEFAULT_DATA.settings, ...(imported.settings || {}) }
      };
      this.save();
      return true;
    } catch (e) {
      console.error('Import failed:', e);
      return false;
    }
  },

  // Reset
  resetAll() {
    this._cache = JSON.parse(JSON.stringify(DEFAULT_DATA));
    this.save();
  },

  // Clean up old redeemed entries (older than 1 year)
  cleanupOldRedemptions() {
    const data = this.load();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const cutoff = oneYearAgo.toISOString().split('T')[0];

    let cleaned = false;
    for (const key in data.redeemedBenefits) {
      const dateStr = data.redeemedBenefits[key];
      if (typeof dateStr === 'string' && dateStr < cutoff) {
        delete data.redeemedBenefits[key];
        cleaned = true;
      }
    }
    if (cleaned) this.save();
  }
};
