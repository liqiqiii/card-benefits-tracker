/**
 * benefits.js — Benefit expiration calculation engine
 * Computes deadlines, urgency levels, and period info for each benefit
 */

const Benefits = {
  /**
   * Get the current period's deadline for a benefit.
   * Returns a Date object for when the current benefit period expires.
   */
  getDeadline(benefit, now) {
    now = now || new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-11

    switch (benefit.frequency) {
      case 'monthly': {
        // Expires at end of current month
        return new Date(year, month + 1, 0, 23, 59, 59);
      }
      case 'quarterly': {
        // Quarters: Jan-Mar, Apr-Jun, Jul-Sep, Oct-Dec
        const quarterEnd = Math.ceil((month + 1) / 3) * 3;
        return new Date(year, quarterEnd, 0, 23, 59, 59);
      }
      case 'semi-annual': {
        // H1: Jan-Jun, H2: Jul-Dec
        if (month < 6) {
          return new Date(year, 6, 0, 23, 59, 59); // June 30
        } else {
          return new Date(year + 1, 0, 0, 23, 59, 59); // Dec 31
        }
      }
      case 'annual': {
        return new Date(year, 12, 0, 23, 59, 59); // Dec 31
      }
      default:
        return new Date(year, month + 1, 0, 23, 59, 59);
    }
  },

  /**
   * Get days remaining until benefit expires
   */
  getDaysRemaining(benefit, now) {
    now = now || new Date();
    const deadline = this.getDeadline(benefit, now);
    const diff = deadline.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  },

  /**
   * Get urgency level for a benefit
   * Returns: 'critical' (≤3 days), 'warning' (≤7 days), 'soon' (≤14 days), 'ok'
   */
  getUrgency(benefit, now) {
    const days = this.getDaysRemaining(benefit, now);
    if (days <= 3) return 'critical';
    if (days <= 7) return 'warning';
    if (days <= 14) return 'soon';
    return 'ok';
  },

  /**
   * Get the current period label (e.g., "March 2026", "Q1 2026", "H1 2026", "2026")
   */
  getPeriodLabel(benefit, now) {
    now = now || new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];

    switch (benefit.frequency) {
      case 'monthly':
        return `${monthNames[month]} ${year}`;
      case 'quarterly': {
        const quarter = Math.ceil((month + 1) / 3);
        return `Q${quarter} ${year}`;
      }
      case 'semi-annual':
        return month < 6 ? `H1 ${year} (Jan–Jun)` : `H2 ${year} (Jul–Dec)`;
      case 'annual':
        return `${year}`;
      default:
        return `${monthNames[month]} ${year}`;
    }
  },

  /**
   * Get the effective value for a benefit (handles special cases like Dec Uber)
   */
  getEffectiveValue(benefit, now) {
    now = now || new Date();
    if (benefit.valueDec && now.getMonth() === 11) {
      return benefit.valueDec;
    }
    return benefit.value;
  },

  /**
   * Get a human-readable frequency label
   */
  getFrequencyLabel(frequency) {
    const labels = {
      'monthly': 'Monthly',
      'quarterly': 'Quarterly',
      'semi-annual': 'Semi-Annual',
      'annual': 'Annual'
    };
    return labels[frequency] || frequency;
  },

  /**
   * Sort benefits by urgency (most urgent first)
   */
  sortByUrgency(benefitsList, now) {
    return benefitsList.sort((a, b) => {
      const daysA = this.getDaysRemaining(a.benefit, now);
      const daysB = this.getDaysRemaining(b.benefit, now);
      // Unredeemed first, then by days remaining
      if (a.redeemed !== b.redeemed) return a.redeemed ? 1 : -1;
      return daysA - daysB;
    });
  },

  /**
   * Group benefits into urgency categories
   */
  groupByUrgency(benefitsList, now) {
    const groups = {
      critical: [],  // ≤3 days
      warning: [],   // ≤7 days
      soon: [],      // ≤14 days
      ok: []         // >14 days
    };

    for (const item of benefitsList) {
      const urgency = this.getUrgency(item.benefit, now);
      groups[urgency].push(item);
    }

    // Sort within each group
    for (const key in groups) {
      groups[key] = this.sortByUrgency(groups[key], now);
    }

    return groups;
  },

  /**
   * Check which benefits need reminder notifications
   * Returns benefits expiring within reminderDays that haven't been redeemed
   */
  getBenefitsNeedingReminder(allBenefits, reminderDays, now) {
    now = now || new Date();
    return allBenefits.filter(item => {
      if (item.redeemed || item.hidden) return false;
      const days = this.getDaysRemaining(item.benefit, now);
      return days <= reminderDays && days > 0;
    });
  }
};
