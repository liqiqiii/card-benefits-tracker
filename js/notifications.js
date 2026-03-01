/**
 * notifications.js — Browser notifications + email reminders
 */

const Notifications = {
  /**
   * Request browser notification permission
   */
  async requestPermission() {
    if (!('Notification' in window)) {
      return 'unsupported';
    }
    if (Notification.permission === 'granted') {
      return 'granted';
    }
    if (Notification.permission === 'denied') {
      return 'denied';
    }
    const result = await Notification.requestPermission();
    return result;
  },

  /**
   * Show a browser notification
   */
  show(title, body, tag) {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }
    try {
      new Notification(title, {
        body,
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">💳</text></svg>',
        tag: tag || 'card-benefit',
        requireInteraction: false
      });
    } catch (e) {
      console.warn('Notification failed:', e);
    }
  },

  /**
   * Check and send reminders for expiring benefits
   */
  checkAndNotify(activeBenefits, reminderDays) {
    const needsReminder = Benefits.getBenefitsNeedingReminder(activeBenefits, reminderDays);
    if (needsReminder.length === 0) return;

    // Group by days remaining
    const urgent = needsReminder.filter(b => Benefits.getDaysRemaining(b.benefit) <= 3);
    const warning = needsReminder.filter(b => {
      const d = Benefits.getDaysRemaining(b.benefit);
      return d > 3 && d <= reminderDays;
    });

    if (urgent.length > 0) {
      const names = urgent.map(b => b.benefit.name).join(', ');
      this.show(
        '🚨 Benefits Expiring Soon!',
        `${urgent.length} benefit${urgent.length > 1 ? 's' : ''} expiring in ≤3 days: ${names}`,
        'urgent-benefits'
      );
    }

    if (warning.length > 0) {
      const names = warning.map(b => b.benefit.name).join(', ');
      this.show(
        '⏰ Benefits Reminder',
        `${warning.length} benefit${warning.length > 1 ? 's' : ''} expiring soon: ${names}`,
        'warning-benefits'
      );
    }
  },

  /**
   * Send email reminder via EmailJS (free tier: 200 emails/month)
   * Requires EmailJS script loaded and configured
   */
  async sendEmailReminder(settings, benefitsList) {
    if (!settings.emailReminders || !settings.emailAddress) return false;
    if (!settings.emailjsServiceId || !settings.emailjsTemplateId || !settings.emailjsPublicKey) return false;

    try {
      // Dynamically load EmailJS if not already loaded
      if (!window.emailjs) {
        await this._loadEmailJS();
      }

      const benefitLines = benefitsList.map(b => {
        const days = Benefits.getDaysRemaining(b.benefit);
        return `• ${b.cardName} — ${b.benefit.name} ($${Benefits.getEffectiveValue(b.benefit)}) — ${days} days left`;
      }).join('\n');

      await emailjs.send(settings.emailjsServiceId, settings.emailjsTemplateId, {
        to_email: settings.emailAddress,
        subject: `💳 ${benefitsList.length} Card Benefits Expiring Soon`,
        benefits_list: benefitLines,
        date: new Date().toLocaleDateString()
      }, settings.emailjsPublicKey);

      return true;
    } catch (e) {
      console.error('Email send failed:', e);
      return false;
    }
  },

  _loadEmailJS() {
    return new Promise((resolve, reject) => {
      if (window.emailjs) return resolve();
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
};
