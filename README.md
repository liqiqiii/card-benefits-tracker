# 💳 Card Benefits Tracker

Never miss a credit card perk again. Track, check off, and get reminded about your recurring credit card benefits.

![License](https://img.shields.io/badge/license-MIT-blue)

## ✨ Features

- **📊 Dashboard** — See all your benefits sorted by urgency (expiring soon → later)
- **✅ Check-off redemption** — Tap to mark benefits as redeemed with satisfying confetti animation
- **👛 My Wallet** — Pick the cards you own, see progress per card
- **📚 Card Catalog** — Pre-built database of popular US premium cards
- **🔔 Reminders** — Browser notifications + optional email reminders before benefits expire
- **🙈 Hide benefits** — Toggle off perks you don't use
- **📱 Mobile-first PWA** — Install on your phone's home screen
- **💾 Export/Import** — JSON backup for device transfer
- **🍴 Forkable** — Clone, customize, and deploy your own version

## 🃏 Pre-Built Cards

| Card | Issuer | Benefits |
|------|--------|----------|
| The Platinum Card | American Express | Uber Cash, Digital Entertainment, Walmart+, Equinox+, Saks, Resy, Airline Fee, FHR, CLEAR, Global Entry |
| Gold Card | American Express | Uber Cash, Dining Credit, Dunkin' |
| Sapphire Reserve | Chase | Travel Credit, DoorDash, Lyft Pink, Instacart+, Global Entry |
| Sapphire Preferred | Chase | Hotel Credit, Peloton, Instacart+ |
| Venture X | Capital One | Travel Credit, Anniversary Bonus, Global Entry |
| Strata Premier | Citi | Hotel Credit, Global Entry |

## 🚀 Quick Start

### Use it directly
1. Visit the [live site](https://liqiqiii.github.io/card-benefits-tracker/)
2. Add cards from the catalog
3. Check off benefits as you use them

### Fork & deploy your own
1. **Fork** this repository
2. Go to **Settings → Pages → Source → GitHub Actions**
3. Push any change (or manually trigger the workflow)
4. Your site is live at `https://YOUR_USERNAME.github.io/card-benefits-tracker/`

## 🛠️ Customize

### Add a new card
Edit `data/cards.json` and add a new entry:

```json
{
  "id": "my-new-card",
  "name": "My Card",
  "issuer": "Bank Name",
  "annualFee": 95,
  "color": "#1a3c6e",
  "textColor": "#FFFFFF",
  "benefits": [
    {
      "id": "my-card-benefit-1",
      "name": "Monthly Perk",
      "description": "$10/month dining credit",
      "value": 10,
      "frequency": "monthly",
      "category": "dining",
      "resetDay": 1,
      "redeemTip": "How to use this benefit"
    }
  ]
}
```

### Benefit frequencies
- `monthly` — Resets on the 1st of each month
- `quarterly` — Resets Jan 1, Apr 1, Jul 1, Oct 1
- `semi-annual` — Resets Jan 1, Jul 1
- `annual` — Resets Jan 1

### You can also add custom cards directly in the app
Go to **Catalog → Add Custom Card** to create cards without editing JSON.

## 📧 Email Reminders (Optional)

Uses [EmailJS](https://www.emailjs.com/) (free tier: 200 emails/month, no backend needed):

1. Create a free account at [emailjs.com](https://www.emailjs.com/)
2. Create an email service and template
3. Go to **Settings** in the app and enter your Service ID, Template ID, and Public Key

## 🏗️ Tech Stack

- Pure **HTML / CSS / JavaScript** — no framework, no build step
- **localStorage** for data persistence
- **Service Worker** for offline support
- **PWA** manifest for phone installation
- **GitHub Pages** for free hosting

## 📁 Project Structure

```
├── index.html          # Single page app
├── css/styles.css      # Mobile-first responsive styles
├── js/
│   ├── app.js          # Main app logic & confetti
│   ├── ui.js           # All view rendering
│   ├── storage.js      # localStorage abstraction
│   ├── benefits.js     # Expiration calculation engine
│   └── notifications.js # Browser & email notifications
├── data/cards.json     # Card catalog database
├── sw.js               # Service worker
├── manifest.json       # PWA manifest
└── .github/workflows/  # Auto-deploy to GitHub Pages
```

## 📄 License

MIT — use it, fork it, make it yours.
