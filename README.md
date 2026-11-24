# LinkPilot - LinkedIn Lead Management & Automation Suite 🚀

**LinkPilot** is a production-grade, Manifest V3 Chrome Extension built to manage, track, and scale your LinkedIn outreach safely and intelligently.

---

## ✨ Key Features

### 1. ⚡ Daily Connection Request Counter & Anti-Ban Guard
- **Accurate Real-Time Tracking**: Automatically detects when connection requests are sent and updates today's counter.
- **Daily Safe Limit Protection**: Configurable daily caps (e.g., 20–25 requests/day) with a color-coded gauge (Safe, Caution, Danger) to protect your account from LinkedIn restrictions.
- **Accepted Request Metrics**: Tracks accepted connections and response conversions.

### 2. ⭐ High-Value Lead Vault (Phone & Portfolio Separation)
- **Automatic Detection**: When a profile includes a **Phone Number** or **Portfolio / Website URL**, LinkPilot isolates that contact into a dedicated high-value view.
- **Dedicated Structured Fields**:
  - `First Name`
  - `Last Name`
  - `Email Address`
  - `Phone Number`
  - `Portfolio / Website URL`
  - `LinkedIn Profile URL`
  - `Status` & `Date Captured`
- **One-Click CSV Export**: Exports these separated fields cleanly for CRM import (HubSpot, Salesforce, Notion, Google Sheets).

### 3. ⏱️ 1-Day & 2-Day Follow-Up Sequences
- **Automated Cadence Tracking**:
  - **Day 1 Follow-up**: Alerts you 24 hours after connecting if no response has been received.
  - **Day 2 Follow-up**: Bumps after 48 hours with a value-driven question or resource.
- **Chat-Aware Smart Follow-ups**: Evaluates previous messaging history to generate contextual messages that advance the conversation.
- **Follow-up Queue**: Dedicated dashboard tab with 1-click "Mark Sent" or "Lead Replied".

### 4. 🧠 AI Profile Review & Message Crafter
- **Executive Profile Analysis**: Evaluates headlines, summaries, and experience to find key talking points and probable business pain points.
- **Connection Notes (< 300 Chars)**: Generates hyper-personalized connection requests that fit within LinkedIn's character limit.
- **Dual AI Engine**:
  - **Google Gemini API**: Connect your Gemini API key (`gemini-1.5-flash`, `gemini-2.0-flash`, `gemini-1.5-pro`) for dynamic deep reasoning.
  - **Built-in Heuristic NLP Engine**: Operates immediately out-of-the-box with zero configuration required.

### 5. 🎯 In-Page Floating Assistant on LinkedIn
- **Floating HUD**: Injects a sleek floating widget on LinkedIn profile pages showing real-time metrics (`⚡ 14/25`), profile contact status, and 1-click actions:
  - 💾 *Save Lead to CRM*
  - 🧠 *AI Profile Review & Connect Note*
  - 📋 *Copy Note to Clipboard*
- **Injected Chat Follow-up Button**: Directly injects a `✨ AI Follow-Up` button inside LinkedIn messaging threads.

### 6. 📊 Full-Featured CRM & Analytics Dashboard
- Full-page interface (`dashboard/dashboard.html`) featuring:
  - **Daily Analytics**: Live activity stream, progress meters, and historical stats.
  - **High-Value Vault**: Filtered list of contacts with phone numbers and portfolios.
  - **All Contacts CRM**: Filter by status (`Request Sent`, `Accepted`, `Follow-up 1 Due`, `Follow-up 2 Due`, `Replied`).
  - **AI Studio**: Test AI prompts and generate personalized messages for any contact.
  - **Settings & Backup**: Configure caps, test Gemini API key, export JSON backups.

---

## 🚀 How to Install & Use in Chrome / Edge / Brave

1. Open your browser and navigate to:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Brave: `brave://extensions`
2. Turn on **Developer mode** (toggle in the top-right corner).
3. Click the **"Load unpacked"** button in the top-left.
4. Select this project folder:
   ```
   c:\Users\karan\OneDrive\Desktop\Linkdin_management
   ```
5. Click the puzzle icon in your browser toolbar and **pin LinkPilot** (`⚡`).
6. Open [LinkedIn](https://www.linkedin.com) — you will see the **🚀 LinkPilot** floating widget in the bottom-right corner!

---

## 📁 Project Structure

```
Linkdin_management/
├── manifest.json              # Chrome Extension Manifest V3 configuration
├── background/
│   └── service-worker.js      # Background alarms, daily resets & badge coordinator
├── content/
│   ├── content.js             # LinkedIn DOM extractor, watcher & in-page UI
│   └── content.css            # Scoped modern styles for in-page HUD
├── popup/
│   ├── popup.html             # Browser action popup UI
│   ├── popup.css              # Popup styling & progress bar
│   └── popup.js               # Quick stats & tab monitor
├── dashboard/
│   ├── dashboard.html         # Full CRM dashboard with 6 specialized tabs
│   ├── dashboard.css          # SaaS CRM design system
│   └── dashboard.js           # Lead management, CSV exporter & AI studio
├── lib/
│   ├── storage.js             # Chrome storage manager & daily counters
│   └── ai-engine.js           # Gemini API & heuristic analysis engine
├── icons/                     # Extension icons (16px, 48px, 128px)
└── generate_icons.py          # Icon generation script
```

---

## 💡 Quick Tips

- **Testing without browsing**: Open the Dashboard and click **"🎲 Load Sample Data"** in the top bar to immediately explore sample leads with phone numbers, portfolios, and pending follow-up sequences.
- **Gemini API Setup**: Go to **Settings & Anti-Ban** tab in the dashboard, paste your Google Gemini API key, and click **"Test Connection"**.
- **Exporting Leads**: Use **"Export High-Value CSV"** on the Phone & Portfolio tab to download your enriched leads ready for cold calling or WhatsApp outreach.
