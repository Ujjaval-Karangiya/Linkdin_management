/**
 * LinkPilot - Full Dashboard Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  initTabs();
  await loadAllData();
  setupEventListeners();
  checkUrlParams();
});

let allLeads = [];
let highValueLeads = [];
let dailyStats = {};
let currentSettings = {};

// --- Tab Switching ---

function initTabs() {
  const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabName = item.getAttribute('data-tab');
      switchTab(tabName);
    });
  });
}

function switchTab(tabName) {
  // Update sidebar active state
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
  });

  // Update pane active state
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === `pane-${tabName}`);
  });

  // Update page header
  const titleEl = document.getElementById('page-title');
  const subEl = document.getElementById('page-subtitle');

  switch (tabName) {
    case 'overview':
      titleEl.innerText = 'Daily Analytics & Overview';
      subEl.innerText = 'Real-time connection request tracking, accepted metrics, and safety caps.';
      break;
    case 'high-value':
      titleEl.innerText = 'Phone & Portfolio High-Value Vault';
      subEl.innerText = 'Contacts with detected phone numbers or portfolios, separated for direct multichannel outreach.';
      break;
    case 'all-leads':
      titleEl.innerText = 'All Contacts CRM';
      subEl.innerText = 'Complete lead roster, communication status, and custom tags.';
      break;
    case 'followups':
      titleEl.innerText = 'Follow-up Sequence Automation';
      subEl.innerText = '1-Day and 2-Day smart follow-up scheduler based on conversation stages.';
      break;
    case 'ai-studio':
      titleEl.innerText = 'AI Profile & Chat Review Studio';
      subEl.innerText = 'Deep profile analysis, high-conversion icebreakers, and chat-aware follow-up generator.';
      break;
    case 'settings':
      titleEl.innerText = 'Settings & Anti-Ban Controls';
      subEl.innerText = 'Daily safety caps, follow-up cadence timings, and Google Gemini API setup.';
      break;
  }
}

function checkUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  const tab = urlParams.get('tab');
  if (tab) {
    switchTab(tab);
  }
}

// --- Data Loading ---

async function loadAllData() {
  if (typeof LinkPilotStorage === 'undefined') return;

  dailyStats = await LinkPilotStorage.getDailyStats();
  currentSettings = await LinkPilotStorage.getSettings();
  allLeads = await LinkPilotStorage.getAllLeads();
  highValueLeads = await LinkPilotStorage.getHighValueLeads();

  renderOverview();
  renderHighValueTable();
  renderAllLeadsTable();
  renderFollowupsQueue();
  populateAiLeadSelector();
  loadSettingsForm();
  updateSidebarCounters();
}

function updateSidebarCounters() {
  const highValueCountEl = document.getElementById('badge-high-value-count');
  const totalLeadsCountEl = document.getElementById('badge-total-leads');
  const dueFollowupsCountEl = document.getElementById('badge-due-followups');

  if (highValueCountEl) highValueCountEl.innerText = highValueLeads.length;
  if (totalLeadsCountEl) totalLeadsCountEl.innerText = allLeads.length;

  LinkPilotStorage.getPendingFollowups().then(pending => {
    if (dueFollowupsCountEl) dueFollowupsCountEl.innerText = pending.length;
    const statFollowupsDue = document.getElementById('stat-followups-due');
    if (statFollowupsDue) statFollowupsDue.innerText = pending.length;
    const badgeQueue = document.getElementById('followups-queue-badge');
    if (badgeQueue) badgeQueue.innerText = `${pending.length} Pending`;
  });

  // Safety sidebar card
  const sent = dailyStats.requestsSentToday || 0;
  const limit = currentSettings.dailyRequestLimit || 25;
  const pct = Math.min(100, Math.round((sent / limit) * 100));

  const safetyDot = document.getElementById('sidebar-safety-dot');
  const safetyText = document.getElementById('sidebar-safety-text');
  const safetyBar = document.getElementById('sidebar-safety-bar');
  const safetyCount = document.getElementById('sidebar-safety-count');

  if (safetyBar) safetyBar.style.width = `${pct}%`;
  if (safetyCount) safetyCount.innerText = `${sent} / ${limit} requests today`;

  if (sent >= limit) {
    if (safetyDot) safetyDot.className = 'safety-indicator-dot danger';
    if (safetyText) safetyText.innerText = 'Limit Reached (Stop)';
  } else if (pct >= 80) {
    if (safetyDot) safetyDot.className = 'safety-indicator-dot warning';
    if (safetyText) safetyText.innerText = 'Caution Zone';
  } else {
    if (safetyDot) safetyDot.className = 'safety-indicator-dot';
    if (safetyText) safetyText.innerText = 'Safe Mode Active';
  }
}

// --- Render Overview ---

async function renderOverview() {
  const sent = dailyStats.requestsSentToday || 0;
  const accepted = dailyStats.acceptedToday || 0;
  const limit = currentSettings.dailyRequestLimit || 25;
  const pct = Math.min(100, Math.round((sent / limit) * 100));

  document.getElementById('stat-requests-today').innerText = sent;
  document.getElementById('stat-requests-sub').innerText = `Max safe limit: ${limit}/day`;
  document.getElementById('stat-accepted-today').innerText = accepted;
  document.getElementById('stat-high-value-total').innerText = highValueLeads.length;

  const bar = document.getElementById('overview-progress-bar');
  const text = document.getElementById('overview-progress-text');
  const pctText = document.getElementById('overview-progress-pct');
  const badge = document.getElementById('overview-safety-badge');

  bar.style.width = `${pct}%`;
  text.innerText = `${sent} of ${limit} sent`;
  pctText.innerText = `${pct}%`;

  if (sent >= limit) {
    badge.className = 'status-pill status-pill-danger';
    badge.innerText = 'Daily Cap Reached';
    bar.style.background = 'linear-gradient(90deg, #ef4444 0%, #f87171 100%)';
  } else if (pct >= 80) {
    badge.className = 'status-pill status-pill-warning';
    badge.innerText = 'Caution Zone (80%+)';
    bar.style.background = 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)';
  } else {
    badge.className = 'status-pill status-pill-safe';
    badge.innerText = 'Safe Zone (< 80%)';
    bar.style.background = 'linear-gradient(90deg, #0A66C2 0%, #38bdf8 100%)';
  }

  // Activity feed
  await renderActivityLogs();
}

async function renderActivityLogs() {
  const feedEl = document.getElementById('activity-feed-list');
  if (!feedEl) return;

  const logs = await LinkPilotStorage.getActivityLogs();
  if (logs.length === 0) {
    feedEl.innerHTML = '<div class="empty-state">No recorded activity yet. Use the LinkedIn extension to send requests and capture leads.</div>';
    return;
  }

  feedEl.innerHTML = logs.slice(0, 15).map(log => {
    let icon = '⚡';
    if (log.type === 'REQUEST_SENT') icon = '🚀';
    if (log.type === 'REQUEST_ACCEPTED') icon = '🤝';
    if (log.type === 'HIGH_VALUE_EXTRACTED') icon = '⭐';
    if (log.type === 'MESSAGE_SENT') icon = '💬';

    const time = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `
      <div class="activity-item">
        <span class="activity-badge">${icon}</span>
        <span class="activity-msg">${escapeHtml(log.message)}</span>
        <span class="activity-time">${time}</span>
      </div>
    `;
  }).join('');
}

// --- Render High-Value Leads Vault (Phone & Portfolio) ---

function renderHighValueTable(filterText = '') {
  const tbody = document.getElementById('high-value-tbody');
  if (!tbody) return;

  let leads = highValueLeads;
  if (filterText) {
    const q = filterText.toLowerCase();
    leads = leads.filter(l => 
      (l.fullName && l.fullName.toLowerCase().includes(q)) ||
      (l.firstName && l.firstName.toLowerCase().includes(q)) ||
      (l.email && l.email.toLowerCase().includes(q)) ||
      (l.phone && l.phone.toLowerCase().includes(q)) ||
      (l.company && l.company.toLowerCase().includes(q))
    );
  }

  if (leads.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding: 40px; color:#64748b;">
          No high-value leads with Phone or Portfolio found yet.<br>
          <small>Visit LinkedIn profiles with LinkPilot active, or click "Load Sample Data" above to test.</small>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = leads.map(l => {
    const phoneHtml = l.phone 
      ? `<span style="font-weight:600; color:#047857;">📞 ${escapeHtml(l.phone)}</span>` 
      : '<span style="color:#94a3b8; font-style:italic;">None</span>';

    const portfolioHtml = l.portfolio
      ? `<a href="${escapeHtml(l.portfolio)}" target="_blank" style="color:#0A66C2; font-weight:500;">🌐 View Portfolio</a>`
      : '<span style="color:#94a3b8; font-style:italic;">None</span>';

    const linkedinHtml = l.linkedinUrl
      ? `<a href="${escapeHtml(l.linkedinUrl)}" target="_blank" style="color:#0A66C2;">LinkedIn Profile ↗</a>`
      : '<span style="color:#94a3b8;">N/A</span>';

    return `
      <tr>
        <td><strong>${escapeHtml(l.firstName || l.fullName)}</strong></td>
        <td>${escapeHtml(l.lastName || '')}</td>
        <td>${l.email ? `<span style="color:#334155;">${escapeHtml(l.email)}</span>` : '<span style="color:#94a3b8;">N/A</span>'}</td>
        <td>${phoneHtml}</td>
        <td>${portfolioHtml}</td>
        <td>${linkedinHtml}</td>
        <td><span class="badge-status ${l.status}">${formatStatus(l.status)}</span></td>
        <td>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-xs btn-outline" onclick="openInAiStudio('${l.id}')" title="AI Review & Custom Note">🧠 AI</button>
            <button class="btn btn-xs btn-outline" onclick="copyContactInfo('${l.phone}', '${l.email}')" title="Copy Contact Info">📋</button>
            <button class="btn btn-xs btn-outline" style="color:#ef4444;" onclick="deleteLeadItem('${l.id}')" title="Delete">✕</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// --- Render All Leads CRM ---

function renderAllLeadsTable(filterText = '', statusFilter = 'all') {
  const tbody = document.getElementById('all-leads-tbody');
  if (!tbody) return;

  let leads = allLeads;
  if (statusFilter !== 'all') {
    leads = leads.filter(l => l.status === statusFilter);
  }
  if (filterText) {
    const q = filterText.toLowerCase();
    leads = leads.filter(l => 
      (l.fullName && l.fullName.toLowerCase().includes(q)) ||
      (l.headline && l.headline.toLowerCase().includes(q)) ||
      (l.company && l.company.toLowerCase().includes(q)) ||
      (l.email && l.email.toLowerCase().includes(q))
    );
  }

  if (leads.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding: 40px; color:#64748b;">
          No contacts found.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = leads.map(l => {
    const contactName = l.linkedinUrl 
      ? `<a href="${escapeHtml(l.linkedinUrl)}" target="_blank" style="font-weight:700; color:#0f172a; text-decoration:none;">${escapeHtml(l.fullName)} ↗</a>`
      : `<strong>${escapeHtml(l.fullName)}</strong>`;

    const highValueBadge = l.hasPhoneOrPortfolio ? '<span style="font-size:10px; background:#ecfdf5; color:#047857; padding:2px 6px; border-radius:10px; font-weight:700;">⭐ HIGH-VALUE</span>' : '';

    const emailPhone = [
      l.email ? `📧 ${escapeHtml(l.email)}` : null,
      l.phone ? `📱 ${escapeHtml(l.phone)}` : null
    ].filter(Boolean).join('<br>') || '<span style="color:#94a3b8;">None</span>';

    const portfolioLink = l.portfolio
      ? `<a href="${escapeHtml(l.portfolio)}" target="_blank" style="color:#0A66C2;">Portfolio ↗</a>`
      : '<span style="color:#94a3b8;">None</span>';

    const cadenceInfo = `
      <div style="font-size:11.5px; color:#64748b;">
        Day 1: ${l.followup1Sent ? '✅ Sent' : '⏳ Pending'}<br>
        Day 2: ${l.followup2Sent ? '✅ Sent' : '⏳ Pending'}
      </div>
    `;

    return `
      <tr>
        <td>
          ${contactName}
          <div style="margin-top:2px;">${highValueBadge}</div>
        </td>
        <td>
          <div style="font-weight:500;">${escapeHtml(l.headline || 'N/A')}</div>
          <div style="font-size:12px; color:#64748b;">${escapeHtml(l.company || '')}</div>
        </td>
        <td>${emailPhone}</td>
        <td>${portfolioLink}</td>
        <td>
          <select class="dropdown" style="padding:4px 8px; font-size:12px;" onchange="changeLeadStatus('${l.id}', this.value)">
            <option value="request_sent" ${l.status === 'request_sent' ? 'selected' : ''}>Request Sent</option>
            <option value="accepted" ${l.status === 'accepted' ? 'selected' : ''}>Accepted</option>
            <option value="followup1_due" ${l.status === 'followup1_due' ? 'selected' : ''}>Follow-up 1 Due</option>
            <option value="followup2_due" ${l.status === 'followup2_due' ? 'selected' : ''}>Follow-up 2 Due</option>
            <option value="replied" ${l.status === 'replied' ? 'selected' : ''}>Replied</option>
            <option value="not_contacted" ${l.status === 'not_contacted' ? 'selected' : ''}>Not Contacted</option>
          </select>
        </td>
        <td>${cadenceInfo}</td>
        <td>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-xs btn-outline" onclick="openInAiStudio('${l.id}')">🧠 Review</button>
            <button class="btn btn-xs btn-outline" style="color:#ef4444;" onclick="deleteLeadItem('${l.id}')">✕</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// --- Render Follow-ups Queue ---

async function renderFollowupsQueue() {
  const container = document.getElementById('followup-queue-list');
  if (!container) return;

  const pending = await LinkPilotStorage.getPendingFollowups();
  if (pending.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        🎉 All caught up! No follow-ups are currently overdue.<br>
        <small style="color:#94a3b8;">LinkPilot monitors connection requests and alerts you after 1 and 2 days.</small>
      </div>
    `;
    return;
  }

  container.innerHTML = pending.map(item => {
    const lead = item.lead;
    const isDay1 = item.type === 'followup_1';
    const dayBadge = isDay1 
      ? '<span style="background:#eff6ff; color:#1d4ed8; font-weight:700; padding:3px 8px; border-radius:12px; font-size:11px;">⏱️ Day 1 Follow-up</span>'
      : '<span style="background:#fef2f2; color:#b91c1c; font-weight:700; padding:3px 8px; border-radius:12px; font-size:11px;">⏱️ Day 2 Follow-up</span>';

    return `
      <div class="followup-item-card">
        <div class="followup-item-left">
          <div style="display:flex; align-items:center; gap:8px;">
            <strong>${escapeHtml(lead.fullName)}</strong>
            ${dayBadge}
            ${lead.hasPhoneOrPortfolio ? '<span style="font-size:10px; background:#ecfdf5; color:#047857; padding:2px 6px; border-radius:10px; font-weight:700;">⭐ HIGH-VALUE</span>' : ''}
          </div>
          <div class="followup-item-sub">
            ${escapeHtml(lead.headline || lead.company || 'LinkedIn Connection')}
          </div>
          <div style="font-size:11.5px; color:#64748b; margin-top:2px;">
            ${escapeHtml(item.reason)}
          </div>
        </div>

        <div style="display:flex; gap:8px; align-items:center;">
          <button class="btn btn-sm btn-purple" onclick="openInAiStudio('${lead.id}')">
            🧠 Generate AI Follow-up
          </button>
          <button class="btn btn-sm btn-emerald" onclick="markFollowupSent('${lead.id}', '${item.type}')">
            ✅ Mark Sent
          </button>
          <button class="btn btn-sm btn-outline" onclick="changeLeadStatus('${lead.id}', 'replied')">
            💬 Lead Replied
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// --- AI Lead Selector ---

function populateAiLeadSelector() {
  const sel = document.getElementById('ai-lead-selector');
  if (!sel) return;

  sel.innerHTML = '<option value="">-- Choose from saved leads or enter below --</option>' +
    allLeads.map(l => `<option value="${l.id}">${escapeHtml(l.fullName)} (${escapeHtml(l.headline ? l.headline.slice(0, 30) : l.company || 'Lead')})</option>`).join('');

  sel.addEventListener('change', () => {
    const selectedId = sel.value;
    if (!selectedId) return;

    const lead = allLeads.find(l => l.id === selectedId);
    if (lead) {
      document.getElementById('ai-input-name').value = lead.fullName || lead.firstName || '';
      document.getElementById('ai-input-headline').value = lead.headline || '';
      document.getElementById('ai-input-company').value = lead.company || '';
      document.getElementById('ai-input-about').value = lead.about || lead.experience || '';
      document.getElementById('ai-input-chat').value = lead.lastMessage || '';
    }
  });
}

window.openInAiStudio = function(leadId) {
  switchTab('ai-studio');
  const sel = document.getElementById('ai-lead-selector');
  if (sel) {
    sel.value = leadId;
    sel.dispatchEvent(new Event('change'));
  }
};

window.copyContactInfo = function(phone, email) {
  const text = `Phone: ${phone || 'N/A'}\nEmail: ${email || 'N/A'}`;
  navigator.clipboard.writeText(text);
  alert('Contact details copied to clipboard!');
};

window.deleteLeadItem = async function(leadId) {
  if (confirm('Are you sure you want to delete this lead?')) {
    await LinkPilotStorage.deleteLead(leadId);
    await loadAllData();
  }
};

window.changeLeadStatus = async function(leadId, newStatus) {
  await LinkPilotStorage.updateLead(leadId, { status: newStatus });
  await loadAllData();
};

window.markFollowupSent = async function(leadId, followupType) {
  const updates = {};
  if (followupType === 'followup_1') {
    updates.followup1Sent = true;
    updates.status = 'followup2_due';
  } else {
    updates.followup2Sent = true;
  }
  await LinkPilotStorage.updateLead(leadId, updates);
  await LinkPilotStorage.incrementMessagesSent();
  await loadAllData();
};

// --- Settings Form ---

function loadSettingsForm() {
  document.getElementById('setting-daily-request-limit').value = currentSettings.dailyRequestLimit || 25;
  document.getElementById('setting-daily-msg-limit').value = currentSettings.dailyMessageLimit || 40;
  document.getElementById('setting-followup1-days').value = currentSettings.followup1DelayDays || 1;
  document.getElementById('setting-followup2-days').value = currentSettings.followup2DelayDays || 2;
  document.getElementById('setting-gemini-key').value = currentSettings.geminiApiKey || '';
  document.getElementById('setting-gemini-model').value = currentSettings.geminiModel || 'gemini-1.5-flash';
}

// --- Event Listeners Setup ---

function setupEventListeners() {
  // Search High-Value
  document.getElementById('high-value-search')?.addEventListener('input', (e) => {
    renderHighValueTable(e.target.value);
  });

  // Search All Leads
  document.getElementById('all-leads-search')?.addEventListener('input', (e) => {
    const status = document.getElementById('filter-status-select').value;
    renderAllLeadsTable(e.target.value, status);
  });

  document.getElementById('filter-status-select')?.addEventListener('change', (e) => {
    const search = document.getElementById('all-leads-search').value;
    renderAllLeadsTable(search, e.target.value);
  });

  // Export High-Value CSV (with exact fields: First Name, Last Name, Email, Phone Number, Portfolio, LinkedIn URL)
  document.getElementById('btn-export-high-value-csv')?.addEventListener('click', () => {
    const csvContent = LinkPilotStorage.generateCsv(highValueLeads, true);
    downloadFile(csvContent, `LinkPilot_HighValue_Phone_Portfolio_Leads_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
  });

  // Export All Leads CSV
  document.getElementById('btn-export-all-csv')?.addEventListener('click', () => {
    const csvContent = LinkPilotStorage.generateCsv(allLeads, false);
    downloadFile(csvContent, `LinkPilot_All_Leads_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
  });

  // Refresh activity logs
  document.getElementById('btn-refresh-logs')?.addEventListener('click', () => {
    renderActivityLogs();
  });

  // Save Safety Settings
  document.getElementById('btn-save-safety-settings')?.addEventListener('click', async () => {
    const dailyRequestLimit = parseInt(document.getElementById('setting-daily-request-limit').value, 10) || 25;
    const dailyMessageLimit = parseInt(document.getElementById('setting-daily-msg-limit').value, 10) || 40;
    const followup1DelayDays = parseInt(document.getElementById('setting-followup1-days').value, 10) || 1;
    const followup2DelayDays = parseInt(document.getElementById('setting-followup2-days').value, 10) || 2;

    await LinkPilotStorage.saveSettings({
      dailyRequestLimit,
      dailyMessageLimit,
      followup1DelayDays,
      followup2DelayDays
    });

    alert('Safety and cadence settings saved successfully!');
    await loadAllData();
  });

  // Save AI Settings
  document.getElementById('btn-save-ai-settings')?.addEventListener('click', async () => {
    const geminiApiKey = document.getElementById('setting-gemini-key').value.trim();
    const geminiModel = document.getElementById('setting-gemini-model').value;

    await LinkPilotStorage.saveSettings({
      geminiApiKey,
      geminiModel
    });

    alert('AI settings saved successfully!');
    await loadAllData();
  });

  // Test AI Key
  document.getElementById('btn-test-ai-key')?.addEventListener('click', async () => {
    const key = document.getElementById('setting-gemini-key').value.trim();
    const model = document.getElementById('setting-gemini-model').value;
    const statusEl = document.getElementById('ai-test-status');

    if (!key) {
      statusEl.innerHTML = '<span style="color:#0A66C2;">ℹ️ No API key set. LinkPilot is currently using its smart built-in heuristic AI engine (zero-config).</span>';
      return;
    }

    statusEl.innerHTML = '<span style="color:#64748b;">Testing Gemini API connection...</span>';
    try {
      const result = await LinkPilotAI.reviewProfile({
        fullName: 'Jordan Lee',
        headline: 'VP of Product @ TechCorp',
        company: 'TechCorp'
      }, { apiKey: key, model });

      if (result && result.summary) {
        statusEl.innerHTML = '<span style="color:#10b981;">✅ Connection successful! Gemini API is active and ready.</span>';
      } else {
        statusEl.innerHTML = '<span style="color:#ef4444;">❌ Unexpected response from Gemini API.</span>';
      }
    } catch (err) {
      statusEl.innerHTML = `<span style="color:#ef4444;">❌ Connection failed: ${escapeHtml(err.message)}</span>`;
    }
  });

  // Run AI Review Studio
  document.getElementById('btn-run-ai-review')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-run-ai-review');
    const name = document.getElementById('ai-input-name').value.trim();
    const headline = document.getElementById('ai-input-headline').value.trim();
    const company = document.getElementById('ai-input-company').value.trim();
    const about = document.getElementById('ai-input-about').value.trim();
    const chat = document.getElementById('ai-input-chat').value.trim();

    if (!name) {
      alert('Please enter at least the contact\'s name.');
      return;
    }

    btn.innerText = '🤖 Analyzing Profile with AI...';
    btn.disabled = true;

    const profileData = {
      fullName: name,
      firstName: name.split(' ')[0],
      headline,
      company,
      about,
      experience: about,
      lastMessage: chat,
      chatHistory: chat ? [{ sender: 'Contact', text: chat, date: 'Yesterday' }] : []
    };

    const settings = await LinkPilotStorage.getSettings();
    const review = await LinkPilotAI.reviewProfile(profileData, {
      apiKey: settings.geminiApiKey,
      model: settings.geminiModel
    });

    const day1Msg = await LinkPilotAI.generateFollowup(profileData, 'followup_1', {
      apiKey: settings.geminiApiKey,
      model: settings.geminiModel
    });

    const day2Msg = await LinkPilotAI.generateFollowup(profileData, 'followup_2', {
      apiKey: settings.geminiApiKey,
      model: settings.geminiModel
    });

    btn.innerText = '🧠 Run Complete AI Analysis & Message Generation';
    btn.disabled = false;

    // Show output
    document.getElementById('ai-output-empty').style.display = 'none';
    const outContent = document.getElementById('ai-output-content');
    outContent.style.display = 'flex';

    document.getElementById('ai-out-summary').innerText = review.summary;
    document.getElementById('ai-out-icebreaker').innerText = review.icebreakerConnectionNote;
    document.getElementById('ai-out-day1').innerText = day1Msg.message;
    document.getElementById('ai-out-day2').innerText = day2Msg.message;

    // Setup Copy buttons
    document.getElementById('btn-copy-icebreaker').onclick = () => {
      navigator.clipboard.writeText(review.icebreakerConnectionNote);
      alert('Icebreaker note copied to clipboard!');
    };
    document.getElementById('btn-copy-day1').onclick = () => {
      navigator.clipboard.writeText(day1Msg.message);
      alert('Day 1 Follow-up copied to clipboard!');
    };
    document.getElementById('btn-copy-day2').onclick = () => {
      navigator.clipboard.writeText(day2Msg.message);
      alert('Day 2 Follow-up copied to clipboard!');
    };
  });

  // Seed Sample Data
  document.getElementById('btn-seed-sample-data')?.addEventListener('click', async () => {
    await seedRealisticSampleData();
    await loadAllData();
    alert('Sample leads with Phone Numbers, Portfolios, and Follow-ups loaded successfully!');
  });

  // Backup JSON
  document.getElementById('btn-export-backup-json')?.addEventListener('click', async () => {
    const data = {
      leads: await LinkPilotStorage.getAllLeads(),
      stats: await LinkPilotStorage.getDailyStats(),
      settings: await LinkPilotStorage.getSettings(),
      logs: await LinkPilotStorage.getActivityLogs()
    };
    downloadFile(JSON.stringify(data, null, 2), `LinkPilot_Backup_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
  });

  // Clear All Data
  document.getElementById('btn-clear-all-leads')?.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all leads and reset stats? This cannot be undone.')) {
      await LinkPilotStorage.setToStorage(StorageKeys.LEADS, []);
      await LinkPilotStorage.setToStorage(StorageKeys.DAILY_STATS, {
        date: LinkPilotStorage.getTodayDateStr(),
        requestsSentToday: 0,
        acceptedToday: 0,
        messagesSentToday: 0,
        history: {}
      });
      await loadAllData();
      alert('All data has been cleared.');
    }
  });

  // Add Lead Modal controls
  const modal = document.getElementById('add-lead-modal');
  document.getElementById('btn-add-lead-modal')?.addEventListener('click', () => {
    modal.classList.add('active');
  });
  document.getElementById('btn-close-lead-modal')?.addEventListener('click', () => {
    modal.classList.remove('active');
  });
  document.getElementById('btn-cancel-modal')?.addEventListener('click', () => {
    modal.classList.remove('active');
  });

  document.getElementById('btn-save-modal-lead')?.addEventListener('click', async () => {
    const firstName = document.getElementById('modal-lead-firstname').value.trim();
    const lastName = document.getElementById('modal-lead-lastname').value.trim();
    const email = document.getElementById('modal-lead-email').value.trim();
    const phone = document.getElementById('modal-lead-phone').value.trim();
    const portfolio = document.getElementById('modal-lead-portfolio').value.trim();
    const linkedinUrl = document.getElementById('modal-lead-url').value.trim();
    const headline = document.getElementById('modal-lead-headline').value.trim();
    const status = document.getElementById('modal-lead-status').value;

    if (!firstName || !linkedinUrl) {
      alert('First Name and LinkedIn Profile URL are required.');
      return;
    }

    await LinkPilotStorage.saveLead({
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`.trim(),
      email,
      phone,
      portfolio,
      linkedinUrl,
      headline,
      status,
      hasPhoneOrPortfolio: Boolean(phone || portfolio)
    });

    modal.classList.remove('active');
    // Clear inputs
    document.getElementById('modal-lead-firstname').value = '';
    document.getElementById('modal-lead-lastname').value = '';
    document.getElementById('modal-lead-email').value = '';
    document.getElementById('modal-lead-phone').value = '';
    document.getElementById('modal-lead-portfolio').value = '';
    document.getElementById('modal-lead-url').value = '';
    document.getElementById('modal-lead-headline').value = '';

    await loadAllData();
  });
}

// --- Sample Data Seeder ---

async function seedRealisticSampleData() {
  const sampleLeads = [
    {
      firstName: 'Sarah',
      lastName: 'Chen',
      fullName: 'Sarah Chen',
      headline: 'Senior Cloud Architect | Kubernetes & Go',
      company: 'Datacore Systems',
      location: 'San Francisco, CA',
      email: 'sarah.chen@datacore.io',
      phone: '+1 (415) 890-2341',
      portfolio: 'https://github.com/sarahchen-cloud',
      linkedinUrl: 'https://www.linkedin.com/in/sarah-chen-architect',
      status: 'followup1_due',
      followup1Sent: false,
      followup1Date: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25 hours ago -> due now!
      chatHistory: [
        { sender: 'You', text: 'Hi Sarah, great to connect with a fellow distributed systems enthusiast!', date: 'Yesterday' }
      ],
      lastMessage: 'Hi Sarah, great to connect with a fellow distributed systems enthusiast!'
    },
    {
      firstName: 'Marcus',
      lastName: 'Vance',
      fullName: 'Marcus Vance',
      headline: 'VP of Growth & Partnerships',
      company: 'Elevate Commerce',
      location: 'New York, NY',
      email: 'm.vance@elevatecommerce.com',
      phone: '+1 (212) 555-0198',
      portfolio: 'https://marcusvance.me',
      linkedinUrl: 'https://www.linkedin.com/in/marcus-vance-growth',
      status: 'accepted',
      followup1Sent: true,
      followup1Date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      followup2Sent: false,
      followup2Date: new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString(), // 50 hours ago -> Day 2 due!
      chatHistory: [
        { sender: 'You', text: 'Hi Marcus, would love to connect and follow your growth journey!', date: '3 days ago' },
        { sender: 'Marcus', text: 'Thanks for connecting! What are you guys building?', date: '2 days ago' }
      ],
      lastMessage: 'Thanks for connecting! What are you guys building?'
    },
    {
      firstName: 'Priya',
      lastName: 'Sharma',
      fullName: 'Priya Sharma',
      headline: 'Lead Product Designer | Design Systems & UX',
      company: 'FinEdge Global',
      location: 'Bengaluru, India',
      email: 'priya.sharma.design@gmail.com',
      phone: '+91 98201 44521',
      portfolio: 'https://behance.net/priyasharmadesign',
      linkedinUrl: 'https://www.linkedin.com/in/priya-sharma-ux',
      status: 'request_sent',
      followup1Sent: false,
      followup1Date: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
    },
    {
      firstName: 'David',
      lastName: 'Miller',
      fullName: 'David Miller',
      headline: 'CTO & Co-Founder',
      company: 'Apex AI Labs',
      location: 'Austin, TX',
      email: 'david@apexailabs.com',
      phone: '',
      portfolio: 'https://github.com/dmiller-apex',
      linkedinUrl: 'https://www.linkedin.com/in/david-miller-apex',
      status: 'accepted',
      followup1Sent: false,
      followup1Date: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString()
    },
    {
      firstName: 'Elena',
      lastName: 'Rostova',
      fullName: 'Elena Rostova',
      headline: 'Director of Talent Acquisition',
      company: 'Global Staffing Partners',
      location: 'London, UK',
      email: 'e.rostova@gsp-partners.co.uk',
      phone: '+44 20 7946 0912',
      portfolio: '',
      linkedinUrl: 'https://www.linkedin.com/in/elena-rostova-talent',
      status: 'replied',
      followup1Sent: true,
      followup2Sent: true,
      chatHistory: [
        { sender: 'Elena', text: 'Hi! Let\'s schedule a brief call next Tuesday.', date: '1 day ago' }
      ],
      lastMessage: 'Hi! Let\'s schedule a brief call next Tuesday.'
    }
  ];

  for (const lead of sampleLeads) {
    await LinkPilotStorage.saveLead(lead);
  }

  // Update daily stats to realistic numbers
  const stats = await LinkPilotStorage.getDailyStats();
  stats.requestsSentToday = 14;
  stats.acceptedToday = 5;
  stats.messagesSentToday = 8;
  await LinkPilotStorage.setToStorage(StorageKeys.DAILY_STATS, stats);

  await LinkPilotStorage.logActivity('REQUEST_SENT', 'Connection request sent to Sarah Chen (14 today)');
  await LinkPilotStorage.logActivity('HIGH_VALUE_EXTRACTED', 'High-Value Lead captured: Sarah Chen (Phone: +1 415 890-2341, Portfolio: github.com/sarahchen-cloud)');
  await LinkPilotStorage.logActivity('REQUEST_ACCEPTED', 'Connection request accepted by Marcus Vance');
}

// --- Helpers ---

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatStatus(status) {
  if (!status) return 'Not Contacted';
  return status.replace(/_/g, ' ');
}

function downloadFile(content, fileName, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
