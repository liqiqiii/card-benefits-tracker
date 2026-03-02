/**
 * ui.js — DOM rendering & event handlers for all views
 */

const ISSUER_LOGOS = {
  'American Express': { emoji: '🔷', abbr: 'AMEX', color: '#006FCF' },
  'Chase': { emoji: '🏦', abbr: 'CHASE', color: '#124A8C' },
  'Citi': { emoji: '🔵', abbr: 'CITI', color: '#003B70' },
  'Capital One': { emoji: '🅾️', abbr: 'CAP1', color: '#004977' },
  'Discover': { emoji: '🟠', abbr: 'DISC', color: '#FF6B00' },
  'U.S. Bank': { emoji: '🏛️', abbr: 'USB', color: '#1B365D' },
  'Bank of America': { emoji: '🔴', abbr: 'BOA', color: '#C41230' },
  'Wells Fargo': { emoji: '🟡', abbr: 'WF', color: '#CD1309' },
  'Bilt / Wells Fargo': { emoji: '⬛', abbr: 'BILT', color: '#000000' },
};

const UI = {
  cardData: [],
  showHidden: false,

  getIssuerInfo(issuer) {
    return ISSUER_LOGOS[issuer] || { emoji: '💳', abbr: issuer.substring(0, 4).toUpperCase(), color: '#666' };
  },

  _showSyncIndicator(state) {
    const el = document.getElementById('sync-indicator');
    if (!el) return;
    el.classList.remove('hidden', 'syncing', 'synced', 'error');
    el.classList.add(state);
    switch (state) {
      case 'syncing': el.textContent = '⟳ Syncing...'; break;
      case 'synced': el.textContent = '✓ Synced'; setTimeout(() => el.classList.add('hidden'), 2000); break;
      case 'error': el.textContent = '✗ Sync failed'; setTimeout(() => el.classList.add('hidden'), 3000); break;
    }
  },

  async loadCardData() {
    try {
      const resp = await fetch('data/cards.json');
      const data = await resp.json();
      this.cardData = data.cards;
    } catch (e) {
      console.error('Failed to load card data:', e);
      this.cardData = [];
    }
  },

  getCard(cardId) {
    return this.cardData.find(c => c.id === cardId);
  },

  /**
   * Get all active benefits for the user's cards
   */
  getActiveBenefits() {
    const myCards = Storage.getMyCards();
    const hidden = Storage.getHiddenBenefits();
    const results = [];

    for (const cardId of myCards) {
      const card = this.getCard(cardId);
      if (!card) continue;

      for (const benefit of card.benefits) {
        const isHidden = hidden.includes(benefit.id);
        const isRedeemed = Storage.isBenefitRedeemed(benefit.id, benefit);
        const redemptionDate = Storage.getRedemptionDate(benefit.id, benefit);

        results.push({
          cardId: card.id,
          cardName: `${card.issuer} ${card.name}`,
          cardColor: card.color,
          benefit,
          hidden: isHidden,
          redeemed: isRedeemed,
          redemptionDate
        });
      }
    }
    return results;
  },

  // ========================
  // DASHBOARD VIEW
  // ========================
  renderDashboard() {
    const main = document.getElementById('main-content');
    const allBenefits = this.getActiveBenefits();
    const visibleBenefits = this.showHidden
      ? allBenefits
      : allBenefits.filter(b => !b.hidden);

    if (Storage.getMyCards().length === 0) {
      this._renderCardPicker(main);
      this.updateSummary(allBenefits);
      return;
    }

    if (visibleBenefits.length === 0) {
      main.innerHTML = `
        <div class="empty-state">
          <span class="icon">✅</span>
          <div class="title">All Benefits Hidden</div>
          <div class="desc">You've hidden all benefits. Tap the eye icon to show them.</div>
        </div>
      `;
      this.updateSummary(allBenefits);
      return;
    }

    const groups = Benefits.groupByUrgency(visibleBenefits);
    let html = '';

    // Hidden toggle
    const hiddenCount = allBenefits.filter(b => b.hidden).length;
    if (hiddenCount > 0) {
      html += `
        <div class="show-hidden-bar" onclick="UI.toggleShowHidden()">
          ${this.showHidden ? '👁️ Showing' : '🙈 Hiding'} ${hiddenCount} hidden benefit${hiddenCount !== 1 ? 's' : ''}
        </div>
      `;
    }

    if (groups.critical.length > 0) {
      html += this._renderSection('🔴 Expiring in ≤ 3 Days', groups.critical);
    }
    if (groups.warning.length > 0) {
      html += this._renderSection('🟡 Expiring in ≤ 7 Days', groups.warning);
    }
    if (groups.soon.length > 0) {
      html += this._renderSection('🟠 Expiring in ≤ 14 Days', groups.soon);
    }
    if (groups.ok.length > 0) {
      html += this._renderSection('🟢 Plenty of Time', groups.ok);
    }

    main.innerHTML = html;
    this.updateSummary(allBenefits);
  },

  _renderSection(title, items) {
    return `
      <div class="section-header">
        <span class="section-title">${title}</span>
        <span class="section-badge">${items.length}</span>
      </div>
      ${items.map(item => this._renderBenefitCard(item)).join('')}
    `;
  },

  _renderBenefitCard(item) {
    const days = Benefits.getDaysRemaining(item.benefit);
    const urgency = Benefits.getUrgency(item.benefit);
    const value = Benefits.getEffectiveValue(item.benefit);
    const period = Benefits.getPeriodLabel(item.benefit);
    const freqLabel = Benefits.getFrequencyLabel(item.benefit.frequency);

    const urgencyClass = item.redeemed ? '' : `urgency-${urgency}`;
    const redeemedClass = item.redeemed ? 'redeemed' : '';
    const hiddenOpacity = item.hidden ? 'opacity: 0.4;' : '';
    const daysClass = urgency === 'critical' ? 'critical' : urgency === 'warning' ? 'warning' : 'ok';

    let daysLabel;
    if (days === 0) daysLabel = 'Expires today!';
    else if (days === 1) daysLabel = '1 day left';
    else daysLabel = `${days} days left`;

    let redeemedLabel = '';
    if (item.redeemed && item.redemptionDate) {
      const d = new Date(item.redemptionDate + 'T00:00:00');
      const formatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      redeemedLabel = `<div class="benefit-redeemed-label">✅ Redeemed on ${formatted}</div>`;
    }

    return `
      <div class="benefit-card ${urgencyClass} ${redeemedClass}"
           style="${hiddenOpacity}"
           onclick="UI.onBenefitClick('${item.benefit.id}', '${item.cardId}')"
           data-benefit-id="${item.benefit.id}">
        <div class="benefit-card-top">
          <div class="benefit-card-check" onclick="event.stopPropagation(); UI.toggleRedeem('${item.benefit.id}', '${item.cardId}', this.closest('.benefit-card'))"></div>
          <div class="benefit-card-info">
            <div class="benefit-card-header">
              <span class="benefit-card-name">${item.benefit.name}</span>
              <span class="benefit-card-value">$${value}</span>
            </div>
            <div class="benefit-card-desc">${item.benefit.description}</div>
            <div class="benefit-card-meta">
              <span class="benefit-tag card-tag" style="background:${item.cardColor}">${item.cardName}</span>
              <span class="benefit-tag">${freqLabel}</span>
              <span class="benefit-tag">${period}</span>
              <span class="benefit-days ${daysClass}">${item.redeemed ? '' : daysLabel}</span>
            </div>
            ${redeemedLabel}
          </div>
        </div>
      </div>
    `;
  },

  toggleRedeem(benefitId, cardId, cardEl) {
    const card = this.getCard(cardId);
    const benefit = card.benefits.find(b => b.id === benefitId);
    const nowRedeemed = Storage.toggleBenefitRedeemed(benefitId, benefit);

    if (nowRedeemed) {
      // Celebration animation
      cardEl.classList.add('just-redeemed');
      setTimeout(() => cardEl.classList.remove('just-redeemed'), 600);

      // Confetti
      Confetti.burst();

      // Toast
      App.showToast(`✅ ${benefit.name} redeemed!`, 'success');
    } else {
      App.showToast(`↩️ ${benefit.name} un-redeemed`, 'warning');
    }

    // Re-render after brief animation
    setTimeout(() => this.renderDashboard(), 400);
  },

  onBenefitClick(benefitId, cardId) {
    const card = this.getCard(cardId);
    const benefit = card.benefits.find(b => b.id === benefitId);
    const isRedeemed = Storage.isBenefitRedeemed(benefitId, benefit);
    const isHidden = Storage.isBenefitHidden(benefitId);
    const value = Benefits.getEffectiveValue(benefit);
    const period = Benefits.getPeriodLabel(benefit);
    const days = Benefits.getDaysRemaining(benefit);
    const redemptionDate = Storage.getRedemptionDate(benefitId, benefit);

    let redeemDateStr = '';
    if (isRedeemed && redemptionDate) {
      const d = new Date(redemptionDate + 'T00:00:00');
      redeemDateStr = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }

    const modal = document.getElementById('modal-content');
    modal.innerHTML = `
      <div class="modal-header">
        <span class="modal-title">${benefit.name}</span>
        <button class="modal-close" onclick="App.closeModal()">✕</button>
      </div>
      <div style="font-size:0.8rem; color:var(--text-muted);">${card.issuer} ${card.name}</div>
      <div class="benefit-detail-value">$${value}</div>
      <div class="benefit-detail-period">${Benefits.getFrequencyLabel(benefit.frequency)} • ${period} • ${days} days left</div>
      <div class="benefit-detail-tip">
        <strong>💡 How to redeem:</strong><br>
        ${benefit.redeemTip || benefit.description}
      </div>
      ${benefit.note ? `<div class="benefit-detail-tip"><strong>📌 Note:</strong><br>${benefit.note}</div>` : ''}
      ${isRedeemed ? `<div class="benefit-detail-tip" style="border-left:3px solid var(--success); padding-left:12px"><strong>✅ Redeemed</strong> on ${redeemDateStr}</div>` : ''}
      <div class="benefit-detail-actions">
        <button class="btn ${isRedeemed ? 'secondary' : 'primary'}" onclick="UI.toggleRedeemFromModal('${benefitId}','${cardId}')">
          ${isRedeemed ? '↩️ Un-Redeem' : '✅ Mark as Redeemed'}
        </button>
        <button class="btn secondary" onclick="UI.toggleHideFromModal('${benefitId}')">
          ${isHidden ? '👁️ Unhide' : '🙈 Hide'}
        </button>
      </div>
    `;
    App.openModal();
  },

  toggleRedeemFromModal(benefitId, cardId) {
    const card = this.getCard(cardId);
    const benefit = card.benefits.find(b => b.id === benefitId);
    const nowRedeemed = Storage.toggleBenefitRedeemed(benefitId, benefit);

    if (nowRedeemed) {
      Confetti.burst();
      App.showToast(`✅ ${benefit.name} redeemed!`, 'success');
    } else {
      App.showToast(`↩️ ${benefit.name} un-redeemed`, 'warning');
    }
    App.closeModal();
    this.renderDashboard();
  },

  toggleHideFromModal(benefitId) {
    const nowHidden = Storage.toggleBenefitVisibility(benefitId);
    App.showToast(nowHidden ? '🙈 Benefit hidden' : '👁️ Benefit visible', 'success');
    App.closeModal();
    this.renderDashboard();
  },

  toggleShowHidden() {
    this.showHidden = !this.showHidden;
    this.renderDashboard();
  },

  updateSummary(allBenefits) {
    const visible = allBenefits.filter(b => !b.hidden);
    const redeemed = visible.filter(b => b.redeemed);
    const totalSaved = redeemed.reduce((sum, b) => sum + Benefits.getEffectiveValue(b.benefit), 0);
    const expiringSoon = visible.filter(b => !b.redeemed && Benefits.getDaysRemaining(b.benefit) <= 7);

    document.getElementById('summary-redeemed').textContent = `${redeemed.length}/${visible.length}`;
    document.getElementById('summary-saved').textContent = `$${totalSaved.toFixed(0)}`;
    document.getElementById('summary-expiring').textContent = expiringSoon.length;

    // Update ring
    const pct = visible.length > 0 ? (redeemed.length / visible.length * 100) : 0;
    const ringFill = document.getElementById('summary-ring-fill');
    if (ringFill) {
      ringFill.setAttribute('stroke-dasharray', `${pct}, 100`);
    }
  },

  // ========================
  // FIRST-RUN CARD PICKER
  // ========================
  _renderCardPicker(container) {
    const selected = this._pickerSelected || new Set();
    let cardsHtml = '';

    // Group cards by issuer
    const byIssuer = {};
    for (const card of this.cardData) {
      if (!byIssuer[card.issuer]) byIssuer[card.issuer] = [];
      byIssuer[card.issuer].push(card);
    }

    for (const [issuer, cards] of Object.entries(byIssuer)) {
      const issuerInfo = this.getIssuerInfo(issuer);
      cardsHtml += `<div class="picker-issuer-label">${issuerInfo.emoji} ${issuer}</div>`;
      for (const card of cards) {
        const isSelected = selected.has(card.id);
        const totalValue = card.benefits.reduce((sum, b) => sum + b.value, 0);
        cardsHtml += `
          <div class="picker-card ${isSelected ? 'selected' : ''}"
               onclick="UI._togglePickerCard('${card.id}')"
               style="--card-color: ${card.color}">
            <div class="picker-card-check">${isSelected ? '✓' : ''}</div>
            <div class="picker-card-info">
              <div class="picker-card-name">${card.name}</div>
              <div class="picker-card-detail">$${card.annualFee}/yr • ${card.benefits.length} benefits • ~$${totalValue}/period</div>
            </div>
          </div>
        `;
      }
    }

    container.innerHTML = `
      <div class="card-picker">
        <div class="picker-header">
          <span class="picker-icon">💳</span>
          <h2 class="picker-title">Select Your Cards</h2>
          <p class="picker-subtitle">Tap the cards you own to start tracking benefits</p>
        </div>
        <div class="picker-list">
          ${cardsHtml}
        </div>
        ${selected.size > 0 ? `
          <div class="picker-footer">
            <button class="btn primary picker-done-btn" onclick="UI._finishCardPicker()">
              Start Tracking ${selected.size} Card${selected.size !== 1 ? 's' : ''} →
            </button>
          </div>
        ` : ''}
      </div>
    `;
  },

  _pickerSelected: null,

  _togglePickerCard(cardId) {
    if (!this._pickerSelected) this._pickerSelected = new Set();
    if (this._pickerSelected.has(cardId)) {
      this._pickerSelected.delete(cardId);
    } else {
      this._pickerSelected.add(cardId);
    }
    this._renderCardPicker(document.getElementById('main-content'));
  },

  _finishCardPicker() {
    if (!this._pickerSelected || this._pickerSelected.size === 0) return;
    for (const cardId of this._pickerSelected) {
      Storage.addCard(cardId);
    }
    this._pickerSelected = null;
    App.showToast(`✅ ${Storage.getMyCards().length} cards added to your wallet!`, 'success');
    Confetti.burst();
    this.renderDashboard();
  },

  // ========================
  // WALLET VIEW
  // ========================
  renderWallet() {
    const main = document.getElementById('main-content');
    const myCards = Storage.getMyCards();

    let html = '<div class="card-grid">';

    for (const cardId of myCards) {
      const card = this.getCard(cardId);
      if (!card) continue;

      const activeBenefits = card.benefits.filter(b => !Storage.isBenefitHidden(b.id));
      const redeemedCount = card.benefits.filter(b =>
        !Storage.isBenefitHidden(b.id) && Storage.isBenefitRedeemed(b.id, b)
      ).length;
      const totalVisible = activeBenefits.length;
      const progressPct = totalVisible > 0 ? (redeemedCount / totalVisible * 100) : 0;

      html += `
        <div class="credit-card" style="background:${card.color}; color:${card.textColor || '#fff'}"
             onclick="UI.showCardDetail('${card.id}')">
          <button class="card-action-btn" onclick="event.stopPropagation(); UI.removeCard('${card.id}')" title="Remove card">✕</button>
          <div>
            <div class="credit-card-issuer-row">
              <span class="credit-card-logo">${this.getIssuerInfo(card.issuer).emoji}</span>
              <span class="credit-card-issuer">${card.issuer}</span>
            </div>
            <div class="credit-card-name">${card.name}</div>
          </div>
          <div class="credit-card-bottom">
            <span class="credit-card-fee">$${card.annualFee}/yr</span>
            <div class="credit-card-progress">
              <div class="progress-bar">
                <div class="progress-bar-fill" style="width:${progressPct}%"></div>
              </div>
              <span>${redeemedCount}/${totalVisible}</span>
            </div>
          </div>
        </div>
      `;
    }

    html += `
      <button class="add-card-btn" onclick="App.switchTab('catalog')">
        <span class="icon">+</span>
        Add a Card
      </button>
    `;

    html += '</div>';
    main.innerHTML = html;
  },

  showCardDetail(cardId) {
    const card = this.getCard(cardId);
    if (!card) return;

    const modal = document.getElementById('modal-content');
    let benefitsHtml = '';

    for (const benefit of card.benefits) {
      const isHidden = Storage.isBenefitHidden(benefit.id);
      const isRedeemed = Storage.isBenefitRedeemed(benefit.id, benefit);
      const value = Benefits.getEffectiveValue(benefit);
      const days = Benefits.getDaysRemaining(benefit);
      const freq = Benefits.getFrequencyLabel(benefit.frequency);

      benefitsHtml += `
        <div class="benefit-card ${isRedeemed ? 'redeemed' : ''}" style="${isHidden ? 'opacity:0.4' : ''}"
             onclick="event.stopPropagation(); UI.onBenefitClick('${benefit.id}','${cardId}'); App.closeModal();">
          <div class="benefit-card-top">
            <div class="benefit-card-check"></div>
            <div class="benefit-card-info">
              <div class="benefit-card-header">
                <span class="benefit-card-name">${benefit.name}</span>
                <span class="benefit-card-value">$${value}</span>
              </div>
              <div class="benefit-card-meta">
                <span class="benefit-tag">${freq}</span>
                <span class="benefit-days">${days}d left</span>
              </div>
            </div>
          </div>
          <div style="display:flex; gap:8px; margin-top:8px;">
            <button class="btn secondary" style="flex:1; padding:6px; font-size:0.75rem; border-radius:6px; border:1px solid var(--border); background:var(--bg-primary); color:var(--text-secondary); cursor:pointer"
                    onclick="event.stopPropagation(); UI.toggleHideBenefit('${benefit.id}', '${cardId}')">
              ${isHidden ? '👁️ Show' : '🙈 Hide'}
            </button>
          </div>
        </div>
      `;
    }

    modal.innerHTML = `
      <div class="modal-header">
        <span class="modal-title">${card.issuer} ${card.name}</span>
        <button class="modal-close" onclick="App.closeModal()">✕</button>
      </div>
      <div style="margin-bottom:16px; color:var(--text-muted); font-size:0.85rem;">
        $${card.annualFee}/year • ${card.benefits.length} benefits
      </div>
      ${benefitsHtml}
    `;
    App.openModal();
  },

  toggleHideBenefit(benefitId, cardId) {
    const nowHidden = Storage.toggleBenefitVisibility(benefitId);
    App.showToast(nowHidden ? '🙈 Benefit hidden' : '👁️ Benefit shown', 'success');
    // Refresh the card detail modal
    this.showCardDetail(cardId);
  },

  removeCard(cardId) {
    const card = this.getCard(cardId);
    if (confirm(`Remove ${card.issuer} ${card.name} from your wallet?`)) {
      Storage.removeCard(cardId);
      App.showToast(`Removed ${card.name}`, 'warning');
      this.renderWallet();
    }
  },

  // ========================
  // CATALOG VIEW
  // ========================
  renderCatalog(searchQuery) {
    const main = document.getElementById('main-content');
    const query = (searchQuery || '').toLowerCase();
    this._catalogQuery = searchQuery || '';

    let filteredCards = this.cardData;
    if (query) {
      filteredCards = this.cardData.filter(c =>
        c.name.toLowerCase().includes(query) ||
        c.issuer.toLowerCase().includes(query) ||
        c.benefits.some(b => b.name.toLowerCase().includes(query))
      );
    }

    // Only re-render the card list if search bar already exists
    const existingSearch = main.querySelector('.search-bar input');
    if (existingSearch && searchQuery !== undefined) {
      // Just update the card list, keep the search bar intact
      const listEl = document.getElementById('catalog-card-list');
      if (listEl) {
        listEl.innerHTML = this._renderCatalogCards(filteredCards);
        return;
      }
    }

    main.innerHTML = `
      <div class="search-bar">
        <span class="search-icon">🔍</span>
        <input type="text" placeholder="Search cards or benefits..."
               value="${this._catalogQuery}"
               oninput="UI._onCatalogSearch(this.value)">
      </div>
      <div class="card-grid" id="catalog-card-list">
        ${this._renderCatalogCards(filteredCards)}
      </div>
      <div style="margin-top:20px; text-align:center;">
        <button class="add-card-btn" onclick="UI.showCustomCardForm()" style="max-width:300px; margin:0 auto;">
          <span class="icon">✏️</span>
          Add Custom Card
        </button>
      </div>
    `;
  },

  _onCatalogSearch(value) {
    this._catalogQuery = value;
    const query = value.toLowerCase();

    let filteredCards = this.cardData;
    if (query) {
      filteredCards = this.cardData.filter(c =>
        c.name.toLowerCase().includes(query) ||
        c.issuer.toLowerCase().includes(query) ||
        c.benefits.some(b => b.name.toLowerCase().includes(query))
      );
    }

    const listEl = document.getElementById('catalog-card-list');
    if (listEl) {
      listEl.innerHTML = this._renderCatalogCards(filteredCards);
    }
  },

  _renderCatalogCards(cards) {
    let html = '';
    for (const card of cards) {
      const isOwned = Storage.hasCard(card.id);
      const totalValue = card.benefits.reduce((sum, b) => sum + b.value, 0);
      const issuerInfo = this.getIssuerInfo(card.issuer);

      html += `
        <div class="catalog-card">
          <div class="catalog-card-color" style="background:${card.color}">
            <span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:1rem;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5))">${issuerInfo.emoji}</span>
          </div>
          <div class="catalog-card-info">
            <div class="catalog-card-name">${card.name}</div>
            <div class="catalog-card-issuer">${card.issuer} • $${card.annualFee}/yr</div>
          </div>
          <div class="catalog-card-meta">
            <div class="catalog-card-benefits-count">${card.benefits.length} benefits</div>
          </div>
          <button class="catalog-card-action ${isOwned ? 'added' : ''}"
                  onclick="UI.toggleCatalogCard('${card.id}')">
            ${isOwned ? '✓ Added' : '+ Add'}
          </button>
        </div>
      `;
    }
    return html;
  },

  toggleCatalogCard(cardId) {
    if (Storage.hasCard(cardId)) {
      Storage.removeCard(cardId);
      App.showToast('Card removed from wallet', 'warning');
    } else {
      Storage.addCard(cardId);
      const card = this.getCard(cardId);
      App.showToast(`✅ ${card.issuer} ${card.name} added!`, 'success');
    }
    // Only update the card list, not the search input
    this._onCatalogSearch(this._catalogQuery || '');
  },

  // ========================
  // CUSTOM CARD FORM
  // ========================
  showCustomCardForm() {
    const modal = document.getElementById('modal-content');
    modal.innerHTML = `
      <div class="modal-header">
        <span class="modal-title">Add Custom Card</span>
        <button class="modal-close" onclick="App.closeModal()">✕</button>
      </div>
      <div class="form-group">
        <label class="form-label">Card Issuer</label>
        <input class="form-input" id="custom-issuer" placeholder="e.g., American Express">
      </div>
      <div class="form-group">
        <label class="form-label">Card Name</label>
        <input class="form-input" id="custom-name" placeholder="e.g., Gold Card">
      </div>
      <div class="form-group">
        <label class="form-label">Annual Fee ($)</label>
        <input class="form-input" id="custom-fee" type="number" placeholder="0">
      </div>
      <div class="form-group">
        <label class="form-label">Card Color</label>
        <input class="form-input" id="custom-color" type="color" value="#4f8cff" style="height:40px; padding:4px;">
      </div>
      <div id="custom-benefits-list"></div>
      <button class="settings-btn secondary" onclick="UI.addCustomBenefitRow()" style="margin-top:8px;">
        + Add Benefit
      </button>
      <div class="form-actions">
        <button class="btn cancel" onclick="App.closeModal()">Cancel</button>
        <button class="btn primary" onclick="UI.saveCustomCard()">Save Card</button>
      </div>
    `;
    App.openModal();
    this.customBenefitCount = 0;
    this.addCustomBenefitRow();
  },

  customBenefitCount: 0,

  addCustomBenefitRow() {
    const idx = this.customBenefitCount++;
    const container = document.getElementById('custom-benefits-list');
    const row = document.createElement('div');
    row.style.cssText = 'background:var(--bg-card); padding:12px; border-radius:8px; margin-top:10px;';
    row.innerHTML = `
      <div class="form-group" style="margin-bottom:8px">
        <label class="form-label">Benefit Name</label>
        <input class="form-input custom-benefit-name" placeholder="e.g., Uber Cash">
      </div>
      <div style="display:flex; gap:8px;">
        <div class="form-group" style="flex:1; margin-bottom:0">
          <label class="form-label">Value ($)</label>
          <input class="form-input custom-benefit-value" type="number" placeholder="15">
        </div>
        <div class="form-group" style="flex:1; margin-bottom:0">
          <label class="form-label">Frequency</label>
          <select class="form-input custom-benefit-freq">
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="semi-annual">Semi-Annual</option>
            <option value="annual">Annual</option>
          </select>
        </div>
      </div>
    `;
    container.appendChild(row);
  },

  saveCustomCard() {
    const issuer = document.getElementById('custom-issuer').value.trim();
    const name = document.getElementById('custom-name').value.trim();
    const fee = parseInt(document.getElementById('custom-fee').value) || 0;
    const color = document.getElementById('custom-color').value;

    if (!issuer || !name) {
      App.showToast('Please enter card issuer and name', 'warning');
      return;
    }

    const id = `custom-${issuer.toLowerCase().replace(/\s+/g, '-')}-${name.toLowerCase().replace(/\s+/g, '-')}`;

    const benefitNames = document.querySelectorAll('.custom-benefit-name');
    const benefitValues = document.querySelectorAll('.custom-benefit-value');
    const benefitFreqs = document.querySelectorAll('.custom-benefit-freq');

    const benefits = [];
    for (let i = 0; i < benefitNames.length; i++) {
      const bName = benefitNames[i].value.trim();
      const bValue = parseFloat(benefitValues[i].value) || 0;
      const bFreq = benefitFreqs[i].value;
      if (bName && bValue > 0) {
        benefits.push({
          id: `${id}-benefit-${i}`,
          name: bName,
          description: `$${bValue} ${Benefits.getFrequencyLabel(bFreq).toLowerCase()} benefit`,
          value: bValue,
          frequency: bFreq,
          category: 'custom',
          resetDay: 1,
          resetMonth: 1,
          resetMonths: [1, 7]
        });
      }
    }

    const newCard = { id, name, issuer, annualFee: fee, color, textColor: '#FFFFFF', benefits };
    this.cardData.push(newCard);
    Storage.addCard(id);

    // Save custom cards to localStorage
    const customCards = JSON.parse(localStorage.getItem('customCards') || '[]');
    customCards.push(newCard);
    localStorage.setItem('customCards', JSON.stringify(customCards));

    App.showToast(`✅ ${issuer} ${name} added!`, 'success');
    App.closeModal();
    this.renderCatalog();
  },

  loadCustomCards() {
    try {
      const customCards = JSON.parse(localStorage.getItem('customCards') || '[]');
      this.cardData = this.cardData.concat(customCards);
    } catch (e) {
      console.error('Failed to load custom cards:', e);
    }
  },

  // ========================
  // SETTINGS VIEW
  // ========================
  renderSettings() {
    const main = document.getElementById('main-content');
    const settings = Storage.getSettings();

    main.innerHTML = `
      <div class="settings-section">
        <div class="settings-section-title">Notifications</div>
        <div class="settings-row">
          <div>
            <div class="settings-row-label">Browser Notifications</div>
            <div class="settings-row-desc">Get reminders before benefits expire</div>
          </div>
          <label class="toggle">
            <input type="checkbox" ${settings.notificationsEnabled ? 'checked' : ''} onchange="UI.toggleNotifications(this.checked)">
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="settings-row">
          <div>
            <div class="settings-row-label">Remind me</div>
            <div class="settings-row-desc">Days before benefit expires</div>
          </div>
          <select class="form-input" style="width:80px" onchange="UI.updateReminderDays(this.value)">
            <option value="3" ${settings.reminderDaysBefore === 3 ? 'selected' : ''}>3 days</option>
            <option value="5" ${settings.reminderDaysBefore === 5 ? 'selected' : ''}>5 days</option>
            <option value="7" ${settings.reminderDaysBefore === 7 ? 'selected' : ''}>7 days</option>
            <option value="14" ${settings.reminderDaysBefore === 14 ? 'selected' : ''}>14 days</option>
          </select>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Email Reminders (Optional)</div>
        <div class="settings-row" style="flex-direction:column; align-items:stretch; gap:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div class="settings-row-label">Email Reminders</div>
              <div class="settings-row-desc">Powered by EmailJS (free tier)</div>
            </div>
            <label class="toggle">
              <input type="checkbox" ${settings.emailReminders ? 'checked' : ''} onchange="UI.toggleEmailReminders(this.checked)">
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div id="email-settings" style="${settings.emailReminders ? '' : 'display:none'}">
            <input class="settings-input" placeholder="Your email address" value="${settings.emailAddress || ''}"
                   onchange="Storage.updateSettings({emailAddress: this.value})">
            <input class="settings-input" placeholder="EmailJS Service ID" value="${settings.emailjsServiceId || ''}"
                   onchange="Storage.updateSettings({emailjsServiceId: this.value})">
            <input class="settings-input" placeholder="EmailJS Template ID" value="${settings.emailjsTemplateId || ''}"
                   onchange="Storage.updateSettings({emailjsTemplateId: this.value})">
            <input class="settings-input" placeholder="EmailJS Public Key" value="${settings.emailjsPublicKey || ''}"
                   onchange="Storage.updateSettings({emailjsPublicKey: this.value})">
            <div style="margin-top:8px;">
              <button class="settings-btn secondary" onclick="UI.testEmail()">📧 Send Test Email</button>
            </div>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">☁️ GitHub Sync (Cross-Device)</div>
        <div class="settings-row" style="flex-direction:column; align-items:stretch; gap:8px;">
          <div style="font-size:0.8rem; color:var(--text-secondary); line-height:1.5; margin-bottom:4px;">
            Sync your data across phone & computer via your GitHub repo.
            Your data is stored as <code style="color:var(--accent)">data/my-data.json</code> in the repo.
          </div>
          <div id="github-sync-status"></div>
          <input class="settings-input" id="github-token-input" type="password"
                 placeholder="GitHub Personal Access Token (repo scope)"
                 value="${GitHubSync.getConfig()?.token || ''}">
          <div style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">
            Create a token at <a href="https://github.com/settings/tokens/new" target="_blank" style="color:var(--accent)">github.com/settings/tokens</a> with <b>repo</b> scope
          </div>
          <button class="settings-btn primary" onclick="UI.setupGitHubSync()" style="margin-top:8px">
            🔗 Connect & Sync
          </button>
          ${GitHubSync.isConfigured() ? '<button class="settings-btn secondary" onclick="UI.syncNow()">⟳ Sync Now</button>' : ''}
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Data Management</div>
        <button class="settings-btn primary" onclick="Storage.exportData()">📥 Export Data (JSON Backup)</button>
        <button class="settings-btn secondary" onclick="UI.importData()">📤 Import Data</button>
        <input type="file" id="import-file" accept=".json" style="display:none" onchange="UI.handleImportFile(this)">
        <button class="settings-btn danger" onclick="UI.resetData()">🗑️ Reset All Data</button>
      </div>

      <div class="settings-section" style="text-align:center; padding:20px 0;">
        <div style="color:var(--text-muted); font-size:0.75rem;">
          💳 Card Benefits Tracker<br>
          <a href="https://github.com/liqiqiii/card-benefits-tracker" target="_blank" style="color:var(--accent); text-decoration:none;">Fork on GitHub</a>
          • Open Source • MIT License
        </div>
      </div>
    `;
  },

  async setupGitHubSync() {
    const token = document.getElementById('github-token-input').value.trim();
    if (!token) {
      App.showToast('Please enter a GitHub token', 'warning');
      return;
    }

    const statusEl = document.getElementById('github-sync-status');
    statusEl.innerHTML = '<span style="color:var(--warning)">⏳ Validating token...</span>';

    const result = await GitHubSync.validateToken(token);
    if (!result.valid) {
      statusEl.innerHTML = '<span style="color:var(--critical)">❌ Invalid token</span>';
      return;
    }

    // Auto-detect repo from page URL
    const detected = GitHubSync.detectRepo();
    const config = {
      token,
      owner: detected?.owner || result.login,
      repo: detected?.repo || 'card-benefits-tracker'
    };
    GitHubSync.saveConfig(config);

    statusEl.innerHTML = `<span style="color:var(--success)">✅ Connected as ${result.login}</span>`;

    // Now sync
    await this.syncNow();
    this.renderSettings();
  },

  async syncNow() {
    if (!GitHubSync.isConfigured()) {
      App.showToast('Set up GitHub sync first', 'warning');
      return;
    }

    this._showSyncIndicator('syncing');

    // First, pull latest from repo
    const remoteData = await GitHubSync.loadFromRepo();
    if (remoteData) {
      const localData = Storage.load();
      // If remote has more recent data, use it
      Storage._cache = {
        ...DEFAULT_DATA,
        ...remoteData,
        settings: { ...DEFAULT_DATA.settings, ...localData.settings, ...(remoteData.settings || {}) }
      };
      Storage._saveLocal();
    }

    // Then push current data
    const ok = await GitHubSync.saveToRepo(Storage.load());
    if (ok) {
      this._showSyncIndicator('synced');
      App.showToast('✅ Data synced to GitHub!', 'success');
    } else {
      this._showSyncIndicator('error');
      App.showToast('❌ Sync failed — check token permissions', 'warning');
    }

    // Re-render current view
    App.switchTab(App.currentTab);
  },

  async toggleNotifications(enabled) {
    if (enabled) {
      const permission = await Notifications.requestPermission();
      if (permission === 'denied') {
        App.showToast('❌ Notifications blocked by browser', 'warning');
        Storage.updateSettings({ notificationsEnabled: false });
        this.renderSettings();
        return;
      }
      if (permission === 'unsupported') {
        App.showToast('❌ Browser doesn\'t support notifications', 'warning');
        Storage.updateSettings({ notificationsEnabled: false });
        this.renderSettings();
        return;
      }
    }
    Storage.updateSettings({ notificationsEnabled: enabled });
    App.showToast(enabled ? '🔔 Notifications enabled' : '🔕 Notifications disabled', 'success');
  },

  updateReminderDays(value) {
    Storage.updateSettings({ reminderDaysBefore: parseInt(value) });
    App.showToast(`⏰ Reminders set to ${value} days before`, 'success');
  },

  toggleEmailReminders(enabled) {
    Storage.updateSettings({ emailReminders: enabled });
    const el = document.getElementById('email-settings');
    if (el) el.style.display = enabled ? '' : 'none';
  },

  async testEmail() {
    const settings = Storage.getSettings();
    const result = await Notifications.sendEmailReminder(settings, [
      { cardName: 'Test Card', benefit: { name: 'Test Benefit', value: 10, frequency: 'monthly' } }
    ]);
    App.showToast(result ? '✅ Test email sent!' : '❌ Email failed — check settings', result ? 'success' : 'warning');
  },

  importData() {
    document.getElementById('import-file').click();
  },

  handleImportFile(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const success = Storage.importData(e.target.result);
      if (success) {
        App.showToast('✅ Data imported successfully!', 'success');
        App.switchTab('dashboard');
      } else {
        App.showToast('❌ Invalid data file', 'warning');
      }
    };
    reader.readAsText(file);
  },

  resetData() {
    if (confirm('Are you sure you want to reset all data? This cannot be undone.')) {
      Storage.resetAll();
      localStorage.removeItem('customCards');
      App.showToast('🗑️ All data reset', 'warning');
      App.switchTab('dashboard');
    }
  }
};
