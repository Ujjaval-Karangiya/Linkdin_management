/**
 * LinkPilot - Background Service Worker (Manifest V3)
 * Orchestrates background alarms, daily reset logic, anti-ban protection,
 * message dispatching, and follow-up alerts.
 */

try {
  importScripts('../lib/storage.js', '../lib/ai-engine.js');
} catch (e) {
  console.error('Failed to import scripts in service worker:', e);
}

// Initialize on extension installation
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('LinkPilot installed/updated:', details.reason);

  // Set up periodic alarm for checking daily resets and due follow-ups
  chrome.alarms.create('linkpilot_daily_check', {
    periodInMinutes: 30
  });

  chrome.alarms.create('linkpilot_followup_monitor', {
    periodInMinutes: 60
  });

  await updateExtensionBadge();
});

// Periodic alarm handler
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'linkpilot_daily_check') {
    if (typeof LinkPilotStorage !== 'undefined') {
      await LinkPilotStorage.getDailyStats();
      await updateExtensionBadge();
    }
  } else if (alarm.name === 'linkpilot_followup_monitor') {
    if (typeof LinkPilotStorage !== 'undefined') {
      const pending = await LinkPilotStorage.getPendingFollowups();
      if (pending.length > 0) {
        console.log(`[LinkPilot] ${pending.length} follow-up(s) currently due.`);
      }
      await updateExtensionBadge();
    }
  }
});

/**
 * Updates extension action badge with today's count or due follow-ups
 */
async function updateExtensionBadge() {
  try {
    if (typeof LinkPilotStorage === 'undefined') return;
    const stats = await LinkPilotStorage.getDailyStats();
    const settings = await LinkPilotStorage.getSettings();
    const pending = await LinkPilotStorage.getPendingFollowups();

    const count = stats.requestsSentToday || 0;
    const limit = settings.dailyRequestLimit || 25;

    // Show badge: if follow-ups due, show "!N" or just today's count
    if (pending.length > 0) {
      chrome.action.setBadgeText({ text: `${pending.length}F` });
      chrome.action.setBadgeBackgroundColor({ color: '#E02424' }); // Red for action needed
    } else if (count > 0) {
      chrome.action.setBadgeText({ text: `${count}` });
      if (count >= limit) {
        chrome.action.setBadgeBackgroundColor({ color: '#DC2626' }); // Danger/Limit reached
      } else if (count >= limit * 0.8) {
        chrome.action.setBadgeBackgroundColor({ color: '#F59E0B' }); // Warning/Close to limit
      } else {
        chrome.action.setBadgeBackgroundColor({ color: '#0A66C2' }); // LinkedIn Blue
      }
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  } catch (err) {
    console.error('Badge update error:', err);
  }
}

// Runtime message listener for content script & UI coordination
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      switch (message.type) {
        case 'OPEN_DASHBOARD': {
          const tabUrl = chrome.runtime.getURL('dashboard/dashboard.html' + (message.tab ? `?tab=${message.tab}` : ''));
          chrome.tabs.create({ url: tabUrl });
          sendResponse({ success: true });
          break;
        }

        case 'GET_DAILY_STATS': {
          const stats = await LinkPilotStorage.getDailyStats();
          const settings = await LinkPilotStorage.getSettings();
          sendResponse({ stats, settings });
          break;
        }

        case 'RECORD_REQUEST_SENT': {
          const stats = await LinkPilotStorage.incrementRequestsSent(message.leadName);
          const settings = await LinkPilotStorage.getSettings();
          await updateExtensionBadge();

          const limitReached = stats.requestsSentToday >= settings.dailyRequestLimit;
          sendResponse({ success: true, stats, limitReached });
          break;
        }

        case 'RECORD_ACCEPTED': {
          const stats = await LinkPilotStorage.incrementAccepted(message.leadName);
          await updateExtensionBadge();
          sendResponse({ success: true, stats });
          break;
        }

        case 'CALL_AI_REVIEW': {
          const settings = await LinkPilotStorage.getSettings();
          const review = await LinkPilotAI.reviewProfile(message.profile, {
            apiKey: settings.geminiApiKey,
            model: settings.geminiModel
          });
          sendResponse({ success: true, review });
          break;
        }

        case 'CALL_AI_FOLLOWUP': {
          const settings = await LinkPilotStorage.getSettings();
          const followup = await LinkPilotAI.generateFollowup(message.lead, message.followUpType, {
            apiKey: settings.geminiApiKey,
            model: settings.geminiModel,
            customGoal: message.customGoal
          });
          sendResponse({ success: true, followup });
          break;
        }

        case 'UPDATE_BADGE': {
          await updateExtensionBadge();
          sendResponse({ success: true });
          break;
        }

        default:
          sendResponse({ error: 'Unknown message type' });
      }
    } catch (err) {
      console.error('Message handler error:', err);
      sendResponse({ error: err.message });
    }
  })();

  return true; // Keep asynchronous channel open
});
