/**
 * LinkPilot - Popup Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  await loadMetrics();
  await checkActiveTab();
  setupEventListeners();
});

async function loadMetrics() {
  if (typeof LinkPilotStorage === 'undefined') return;

  const stats = await LinkPilotStorage.getDailyStats();
  const settings = await LinkPilotStorage.getSettings();
  const leads = await LinkPilotStorage.getAllLeads();
  const pendingFollowups = await LinkPilotStorage.getPendingFollowups();

  const sent = stats.requestsSentToday || 0;
  const limit = settings.dailyRequestLimit || 25;
  const accepted = stats.acceptedToday || 0;
  const messages = stats.messagesSentToday || 0;

  // Update DOM counts
  document.getElementById('sent-count').innerText = sent;
  document.getElementById('limit-label').innerText = `/ ${limit} limit today`;
  document.getElementById('accepted-count').innerText = accepted;
  document.getElementById('messages-count').innerText = messages;

  // High-value leads count (with phone or portfolio)
  const highValueLeads = leads.filter(l => l.hasPhoneOrPortfolio || l.phone || l.portfolio);
  document.getElementById('high-value-count').innerText = highValueLeads.length;
  document.getElementById('followup-count').innerText = pendingFollowups.length;

  // Calculate percentage & safety indicator
  const pct = Math.min(100, Math.round((sent / limit) * 100));
  const fillEl = document.getElementById('progress-bar-fill');
  const safetyTag = document.getElementById('safety-tag');

  fillEl.style.width = `${pct}%`;

  fillEl.className = 'progress-bar-fill';
  safetyTag.className = 'safety-tag';

  if (sent >= limit) {
    fillEl.classList.add('danger');
    safetyTag.classList.add('danger');
    safetyTag.innerText = 'Limit Reached';
  } else if (pct >= 80) {
    fillEl.classList.add('warning');
    safetyTag.classList.add('warning');
    safetyTag.innerText = 'Caution Zone';
  } else {
    safetyTag.classList.add('safe');
    safetyTag.innerText = 'Safe Mode';
  }
}

async function checkActiveTab() {
  const statusIcon = document.getElementById('tab-status-icon');
  const statusText = document.getElementById('tab-status-text');
  const extractBtn = document.getElementById('btn-quick-extract');

  if (typeof chrome === 'undefined' || !chrome.tabs) {
    statusText.innerText = 'Extension mode active';
    return;
  }

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (activeTab && activeTab.url && activeTab.url.includes('linkedin.com/in/')) {
      statusIcon.classList.add('active');
      statusText.innerText = 'LinkedIn Profile Detected';
      extractBtn.disabled = false;
    } else if (activeTab && activeTab.url && activeTab.url.includes('linkedin.com')) {
      statusIcon.classList.add('active');
      statusText.innerText = 'On LinkedIn (Open a profile)';
      extractBtn.disabled = true;
    } else {
      statusIcon.classList.remove('active');
      statusText.innerText = 'LinkedIn tab not active';
      extractBtn.disabled = true;
    }
  });
}

function setupEventListeners() {
  // Open full dashboard
  document.getElementById('btn-open-full-dashboard').addEventListener('click', () => {
    openDashboard();
  });

  document.getElementById('btn-view-crm').addEventListener('click', () => {
    openDashboard();
  });

  // Open high-value leads tab
  document.getElementById('card-high-value').addEventListener('click', () => {
    openDashboard('high-value');
  });

  // Open follow-ups tab
  document.getElementById('card-followups').addEventListener('click', () => {
    openDashboard('follow-ups');
  });

  // Quick extract button
  document.getElementById('btn-quick-extract').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab && activeTab.id) {
        chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          func: () => {
            const btn = document.getElementById('lp-btn-save-lead');
            if (btn) {
              btn.click();
            } else {
              alert('Please open the LinkPilot floating widget on the page to save.');
            }
          }
        });
        window.close();
      }
    });
  });
}

function openDashboard(tab = '') {
  if (chrome.runtime && chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD', tab });
  } else {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html' + (tab ? `?tab=${tab}` : '')) });
  }
}
