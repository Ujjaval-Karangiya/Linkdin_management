/**
 * LinkPilot - Storage & State Management Module
 * Handles local storage synchronization, daily metrics, CRM lead database,
 * high-value lead separation, and follow-up queues.
 */

const StorageKeys = {
  DAILY_STATS: 'lp_daily_stats',
  LEADS: 'lp_leads',
  SETTINGS: 'lp_settings',
  ACTIVITY_LOG: 'lp_activity_log',
  TEMPLATES: 'lp_templates'
};

const DefaultSettings = {
  dailyRequestLimit: 25,
  dailyMessageLimit: 40,
  followup1DelayDays: 1, // Follow-up 1 after 1 day
  followup2DelayDays: 2, // Follow-up 2 after 2 days
  aiProvider: 'gemini',  // 'gemini' or 'builtin'
  geminiApiKey: '',
  geminiModel: 'gemini-1.5-flash',
  autoTagHighValue: true,
  enableAntiBanProtection: true,
  safeDelayMinSeconds: 3,
  safeDelayMaxSeconds: 7,
  workingHoursOnly: false,
  workingHoursStart: '09:00',
  workingHoursEnd: '18:00'
};

const DefaultTemplates = {
  connectionNote: "Hi {{firstName}}, noticed your work in {{headline}} at {{company}}. Would love to connect and follow your journey!",
  followupDay1: "Hi {{firstName}}, thanks for connecting! I saw your experience in {{headline}} and wanted to ask: are you currently exploring new initiatives around this quarter?",
  followupDay2: "Hey {{firstName}}, quick bump on my previous note. Hope you're having a productive week! Happy to share a few quick ideas whenever convenient.",
  chatAwareFollowup: "Hi {{firstName}}, following up on our previous conversation regarding {{chatTopic}}. Looking forward to hearing your thoughts!"
};

class LinkPilotStorage {
  static getTodayDateStr() {
    const today = new Date();
    return today.toISOString().split('T')[0]; // "YYYY-MM-DD"
  }

  static async getFromStorage(key, fallback) {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get([key], (result) => {
          if (chrome.runtime.lastError) {
            console.error('Storage read error:', chrome.runtime.lastError);
            resolve(fallback);
          } else {
            resolve(result[key] !== undefined ? result[key] : fallback);
          }
        });
      } else {
        // Fallback for non-extension testing environments
        const val = localStorage.getItem(key);
        resolve(val ? JSON.parse(val) : fallback);
      }
    });
  }

  static async setToStorage(key, value) {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [key]: value }, () => {
          if (chrome.runtime.lastError) {
            console.error('Storage write error:', chrome.runtime.lastError);
          }
          resolve(true);
        });
      } else {
        localStorage.setItem(key, JSON.stringify(value));
        resolve(true);
      }
    });
  }

  // --- Daily Metrics & Anti-Ban Counter ---

  static async getDailyStats() {
    const todayStr = this.getTodayDateStr();
    const stats = await this.getFromStorage(StorageKeys.DAILY_STATS, {
      date: todayStr,
      requestsSentToday: 0,
      acceptedToday: 0,
      messagesSentToday: 0,
      history: {}
    });

    // Check if new day, reset counter and save previous day to history
    if (stats.date !== todayStr) {
      if (!stats.history) stats.history = {};
      stats.history[stats.date] = {
        requestsSent: stats.requestsSentToday,
        accepted: stats.acceptedToday,
        messagesSent: stats.messagesSentToday
      };
      stats.date = todayStr;
      stats.requestsSentToday = 0;
      stats.acceptedToday = 0;
      stats.messagesSentToday = 0;
      await this.setToStorage(StorageKeys.DAILY_STATS, stats);
    }

    return stats;
  }

  static async incrementRequestsSent(leadName = '') {
    const stats = await this.getDailyStats();
    stats.requestsSentToday = (stats.requestsSentToday || 0) + 1;
    await this.setToStorage(StorageKeys.DAILY_STATS, stats);
    
    await this.logActivity(
      'REQUEST_SENT', 
      `Connection request sent to ${leadName || 'Contact'} (${stats.requestsSentToday} today)`
    );

    return stats;
  }

  static async incrementAccepted(leadName = '') {
    const stats = await this.getDailyStats();
    stats.acceptedToday = (stats.acceptedToday || 0) + 1;
    await this.setToStorage(StorageKeys.DAILY_STATS, stats);
    
    await this.logActivity(
      'REQUEST_ACCEPTED',
      `Connection request accepted by ${leadName || 'Contact'}`
    );

    return stats;
  }

  static async incrementMessagesSent(leadName = '') {
    const stats = await this.getDailyStats();
    stats.messagesSentToday = (stats.messagesSentToday || 0) + 1;
    await this.setToStorage(StorageKeys.DAILY_STATS, stats);
    
    await this.logActivity(
      'MESSAGE_SENT',
      `Message sent to ${leadName || 'Contact'}`
    );

    return stats;
  }

  // --- Leads CRM Management ---

  static async getAllLeads() {
    return await this.getFromStorage(StorageKeys.LEADS, []);
  }

  /**
   * Specifically returns leads that have a Phone Number or Portfolio/Website
   * Separates first name, email, number, portfolio and linkedin URL as requested by user.
   */
  static async getHighValueLeads() {
    const leads = await this.getAllLeads();
    return leads.filter(l => Boolean(l.phone || l.portfolio || l.hasPhoneOrPortfolio));
  }

  static async saveLead(leadData) {
    const leads = await this.getAllLeads();
    const settings = await this.getSettings();

    // Clean and normalize LinkedIn URL or ID
    const cleanUrl = leadData.linkedinUrl ? leadData.linkedinUrl.split('?')[0].replace(/\/$/, '') : '';
    const id = leadData.id || cleanUrl.split('/in/')[1] || `lead_${Date.now()}`;

    // Has phone or portfolio detection
    const phone = (leadData.phone || '').trim();
    const portfolio = (leadData.portfolio || '').trim();
    const hasPhoneOrPortfolio = Boolean(phone || portfolio);

    const now = new Date();
    const followup1Date = new Date(now.getTime() + (settings.followup1DelayDays || 1) * 24 * 60 * 60 * 1000).toISOString();
    const followup2Date = new Date(now.getTime() + ((settings.followup1DelayDays || 1) + (settings.followup2DelayDays || 2)) * 24 * 60 * 60 * 1000).toISOString();

    const existingIndex = leads.findIndex(l => l.id === id || (cleanUrl && l.linkedinUrl === cleanUrl));

    const standardizedLead = {
      id,
      firstName: leadData.firstName || '',
      lastName: leadData.lastName || '',
      fullName: leadData.fullName || `${leadData.firstName || ''} ${leadData.lastName || ''}`.trim(),
      headline: leadData.headline || '',
      company: leadData.company || '',
      location: leadData.location || '',
      email: (leadData.email || '').trim(),
      phone: phone,
      portfolio: portfolio,
      linkedinUrl: cleanUrl,
      hasPhoneOrPortfolio: hasPhoneOrPortfolio,
      status: leadData.status || 'not_contacted', // 'not_contacted' | 'request_sent' | 'accepted' | 'followup1_due' | 'followup2_due' | 'replied'
      requestSentDate: leadData.requestSentDate || null,
      acceptedDate: leadData.acceptedDate || null,
      followup1Date: leadData.followup1Date || followup1Date,
      followup1Sent: leadData.followup1Sent || false,
      followup2Date: leadData.followup2Date || followup2Date,
      followup2Sent: leadData.followup2Sent || false,
      aiReview: leadData.aiReview || null,
      chatHistory: leadData.chatHistory || [],
      lastChatDate: leadData.lastChatDate || null,
      lastMessage: leadData.lastMessage || null,
      tags: leadData.tags || (hasPhoneOrPortfolio ? ['High-Value Lead'] : []),
      notes: leadData.notes || '',
      createdAt: existingIndex >= 0 ? leads[existingIndex].createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      // Merge existing lead
      leads[existingIndex] = {
        ...leads[existingIndex],
        ...standardizedLead,
        tags: Array.from(new Set([...(leads[existingIndex].tags || []), ...(standardizedLead.tags || [])]))
      };
    } else {
      leads.unshift(standardizedLead);
    }

    await this.setToStorage(StorageKeys.LEADS, leads);

    if (hasPhoneOrPortfolio) {
      await this.logActivity(
        'HIGH_VALUE_EXTRACTED',
        `High-Value Lead captured: ${standardizedLead.fullName} (Phone: ${phone || 'N/A'}, Portfolio: ${portfolio || 'N/A'})`
      );
    } else {
      await this.logActivity(
        'LEAD_SAVED',
        `Lead saved: ${standardizedLead.fullName}`
      );
    }

    return standardizedLead;
  }

  static async updateLead(leadId, updates) {
    const leads = await this.getAllLeads();
    const index = leads.findIndex(l => l.id === leadId || l.linkedinUrl.includes(leadId));
    if (index >= 0) {
      leads[index] = {
        ...leads[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      // Re-evaluate hasPhoneOrPortfolio if phone or portfolio modified
      if (updates.phone !== undefined || updates.portfolio !== undefined) {
        leads[index].hasPhoneOrPortfolio = Boolean(leads[index].phone || leads[index].portfolio);
      }
      await this.setToStorage(StorageKeys.LEADS, leads);
      return leads[index];
    }
    return null;
  }

  static async deleteLead(leadId) {
    let leads = await this.getAllLeads();
    leads = leads.filter(l => l.id !== leadId);
    await this.setToStorage(StorageKeys.LEADS, leads);
    return true;
  }

  // --- Follow-ups Due Engine ---

  static async getPendingFollowups() {
    const leads = await this.getAllLeads();
    const now = Date.now();
    const pendingList = [];

    for (const lead of leads) {
      // If lead already replied, no automated follow-up needed
      if (lead.status === 'replied') continue;

      // Follow-up 1 check (1 day after accepted or request sent)
      if (!lead.followup1Sent && (lead.status === 'accepted' || lead.status === 'request_sent')) {
        const dueTime = new Date(lead.followup1Date).getTime();
        if (now >= dueTime) {
          pendingList.push({
            lead,
            type: 'followup_1',
            dayLabel: 'Day 1 Follow-up',
            dueDate: lead.followup1Date,
            reason: 'No response after 1 day from connection'
          });
          continue; // Check one follow-up stage at a time
        }
      }

      // Follow-up 2 check (2 days after follow-up 1)
      if (lead.followup1Sent && !lead.followup2Sent) {
        const dueTime = new Date(lead.followup2Date).getTime();
        if (now >= dueTime) {
          pendingList.push({
            lead,
            type: 'followup_2',
            dayLabel: 'Day 2 Follow-up',
            dueDate: lead.followup2Date,
            reason: 'No response after 2 days from first follow-up'
          });
        }
      }
    }

    return pendingList;
  }

  // --- Settings & Configuration ---

  static async getSettings() {
    return await this.getFromStorage(StorageKeys.SETTINGS, DefaultSettings);
  }

  static async saveSettings(newSettings) {
    const current = await this.getSettings();
    const merged = { ...current, ...newSettings };
    await this.setToStorage(StorageKeys.SETTINGS, merged);
    return merged;
  }

  // --- Templates ---

  static async getTemplates() {
    return await this.getFromStorage(StorageKeys.TEMPLATES, DefaultTemplates);
  }

  static async saveTemplates(newTemplates) {
    const current = await this.getTemplates();
    const merged = { ...current, ...newTemplates };
    await this.setToStorage(StorageKeys.TEMPLATES, merged);
    return merged;
  }

  // --- Activity Log ---

  static async logActivity(type, message) {
    const logs = await this.getFromStorage(StorageKeys.ACTIVITY_LOG, []);
    logs.unshift({
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      type,
      message,
      timestamp: new Date().toISOString()
    });
    // Keep last 200 logs
    const trimmed = logs.slice(0, 200);
    await this.setToStorage(StorageKeys.ACTIVITY_LOG, trimmed);
    return trimmed;
  }

  static async getActivityLogs() {
    return await this.getFromStorage(StorageKeys.ACTIVITY_LOG, []);
  }

  // --- CSV Export (Standard and Separated High-Value Leads) ---

  static generateCsv(leads, onlyHighValue = false) {
    const dataToExport = onlyHighValue 
      ? leads.filter(l => l.hasPhoneOrPortfolio || l.phone || l.portfolio)
      : leads;

    if (onlyHighValue) {
      // User specific requirement: "saperate that id first name email number and linkdin url and portfolio"
      const headers = ['First Name', 'Last Name', 'Email', 'Phone Number', 'Portfolio', 'LinkedIn URL', 'Status', 'Date Captured'];
      const rows = dataToExport.map(l => [
        `"${(l.firstName || '').replace(/"/g, '""')}"`,
        `"${(l.lastName || '').replace(/"/g, '""')}"`,
        `"${(l.email || '').replace(/"/g, '""')}"`,
        `"${(l.phone || '').replace(/"/g, '""')}"`,
        `"${(l.portfolio || '').replace(/"/g, '""')}"`,
        `"${(l.linkedinUrl || '').replace(/"/g, '""')}"`,
        `"${(l.status || '').replace(/"/g, '""')}"`,
        `"${(l.createdAt ? l.createdAt.split('T')[0] : '').replace(/"/g, '""')}"`
      ]);
      return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    } else {
      const headers = ['First Name', 'Last Name', 'Full Name', 'Headline', 'Company', 'Email', 'Phone', 'Portfolio', 'LinkedIn URL', 'Status', 'Has Phone or Portfolio', 'Follow-up 1 Sent', 'Follow-up 2 Sent', 'Date Added'];
      const rows = dataToExport.map(l => [
        `"${(l.firstName || '').replace(/"/g, '""')}"`,
        `"${(l.lastName || '').replace(/"/g, '""')}"`,
        `"${(l.fullName || '').replace(/"/g, '""')}"`,
        `"${(l.headline || '').replace(/"/g, '""')}"`,
        `"${(l.company || '').replace(/"/g, '""')}"`,
        `"${(l.email || '').replace(/"/g, '""')}"`,
        `"${(l.phone || '').replace(/"/g, '""')}"`,
        `"${(l.portfolio || '').replace(/"/g, '""')}"`,
        `"${(l.linkedinUrl || '').replace(/"/g, '""')}"`,
        `"${(l.status || '').replace(/"/g, '""')}"`,
        `"${l.hasPhoneOrPortfolio ? 'YES' : 'NO'}"`,
        `"${l.followup1Sent ? 'YES' : 'NO'}"`,
        `"${l.followup2Sent ? 'YES' : 'NO'}"`,
        `"${(l.createdAt ? l.createdAt.split('T')[0] : '').replace(/"/g, '""')}"`
      ]);
      return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }
  }
}

// Make available in module and window contexts
if (typeof window !== 'undefined') {
  window.LinkPilotStorage = LinkPilotStorage;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LinkPilotStorage, StorageKeys, DefaultSettings, DefaultTemplates };
}
