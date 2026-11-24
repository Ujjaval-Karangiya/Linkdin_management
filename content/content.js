/**
 * LinkPilot - LinkedIn Content Script
 * Monitors profile visits, extracts structured contact details (Phone, Portfolio, Email, Name),
 * tracks daily sent connection requests, injects in-page AI assistant & chat follow-up tools.
 */

(function () {
  'use strict';

  // Prevent multiple injections
  if (window.__linkpilot_initialized) return;
  window.__linkpilot_initialized = true;

  console.log('[LinkPilot] Initializing LinkedIn Growth & Automation Suite...');

  let currentProfileData = null;
  let lastUrl = location.href;
  let isDrawerOpen = false;

  // --- Profile Data Extractor ---

  function extractProfileDetails() {
    const isProfile = location.pathname.includes('/in/');
    if (!isProfile) return null;

    const fullUrl = window.location.href.split('?')[0].replace(/\/$/, '');
    
    // 1. Name
    const nameEl = document.querySelector('h1.text-heading-xlarge, h1.v-align-middle, div.ph5 h1, main section h1, .pv-top-card--list li:first-child');
    let fullName = nameEl ? nameEl.innerText.trim() : '';
    // Clean badges like "1st", "2nd", or verification icons from name
    fullName = fullName.replace(/\n.*$/, '').replace(/(?:1st|2nd|3rd|verified|premium)/gi, '').trim();

    let firstName = '';
    let lastName = '';
    if (fullName) {
      const parts = fullName.split(' ');
      firstName = parts[0] || '';
      lastName = parts.slice(1).join(' ') || '';
    }

    // 2. Headline
    const headlineEl = document.querySelector('div.text-body-medium, div.pv-text-details__left-panel div.text-body-medium, [data-generated-suggestion-target]');
    const headline = headlineEl ? headlineEl.innerText.trim() : '';

    // 3. Current Company
    let company = '';
    const companyEl = document.querySelector('div[aria-label="Current company"], ul.pv-text-details__right-panel li button, ul.pv-text-details__right-panel li');
    if (companyEl) {
      company = companyEl.innerText.trim();
    } else if (headline.includes(' at ')) {
      company = headline.split(' at ')[1].split('|')[0].trim();
    } else if (headline.includes(' @ ')) {
      company = headline.split(' @ ')[1].split('|')[0].trim();
    }

    // 4. Location
    const locEl = document.querySelector('span.text-body-small.inline.t-black--light.break-words, div.pv-text-details__left-panel span.text-body-small');
    const locationStr = locEl ? locEl.innerText.trim() : '';

    // 5. About / Summary
    const aboutSection = document.querySelector('#about ~ .display-flex, section[data-section="summary"], div.pv-about__summary-text');
    const about = aboutSection ? aboutSection.innerText.trim() : '';

    // 6. Experience snippets
    const expElements = document.querySelectorAll('#experience ~ .pvs-list__outer-container li .display-flex');
    let experienceText = '';
    expElements.forEach((el, idx) => {
      if (idx < 3) experienceText += el.innerText.trim().replace(/\s+/g, ' ') + ' | ';
    });

    // 7. Contact Details Scan (Phone, Email, Portfolio/Website)
    // Scan entire profile DOM + About for emails, phones, and portfolios
    const bodyText = document.body.innerText;
    
    // Email regex
    const emailMatch = bodyText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const email = emailMatch ? emailMatch[0] : '';

    // Phone regex (international & US formats)
    const phoneMatch = bodyText.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    const phone = phoneMatch ? phoneMatch[0] : '';

    // Portfolio / Website regex & link check
    let portfolio = '';
    // Check top-card custom link button
    const customLink = document.querySelector('a.pv-top-card--website, a[data-field="website"], a.ember-view.link-without-visited-state[target="_blank"]');
    if (customLink && customLink.href && !customLink.href.includes('linkedin.com')) {
      portfolio = customLink.href;
    } else {
      // Look for portfolio links like github, behance, personal website, substack, etc.
      const portfolioMatch = bodyText.match(/https?:\/\/(?:www\.)?(?:github\.com|behance\.net|dribbble\.com|medium\.com|[a-zA-Z0-9-]+\.(?:io|dev|me|design|tech|ai|com\/[a-zA-Z0-9_-]+))/i);
      if (portfolioMatch) {
        portfolio = portfolioMatch[0];
      }
    }

    const hasPhoneOrPortfolio = Boolean(phone || portfolio);

    return {
      fullName,
      firstName,
      lastName,
      headline,
      company,
      location: locationStr,
      about,
      experience: experienceText,
      email,
      phone,
      portfolio,
      linkedinUrl: fullUrl,
      hasPhoneOrPortfolio
    };
  }

  // --- Show In-Page Toast Notification ---

  function showToast(message, type = 'info', duration = 4000) {
    const existing = document.querySelector('.lp-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `lp-toast ${type}`;
    toast.innerHTML = `
      <span>${type === 'success' ? '✅' : type === 'warning' ? '⚠️' : '⚡'}</span>
      <div>${message}</div>
    `;

    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // --- Connection Request Monitor ---

  function setupConnectionWatcher() {
    document.addEventListener('click', async (event) => {
      const target = event.target;
      if (!target) return;

      // Detect clicking "Connect" or "Send now" buttons
      const btn = target.closest('button');
      if (!btn) return;

      const ariaLabel = btn.getAttribute('aria-label') || '';
      const btnText = btn.innerText.trim();

      const isConnectAction = 
        ariaLabel.includes('Invite') ||
        ariaLabel.includes('Connect') ||
        btnText === 'Connect' ||
        btnText === 'Send now' ||
        btnText === 'Send without a note' ||
        btnText === 'Send invitation';

      if (isConnectAction) {
        // Small delay to ensure request is dispatched
        setTimeout(async () => {
          const profile = extractProfileDetails();
          const targetName = profile ? profile.fullName : 'LinkedIn Contact';

          // Record in background & storage
          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({
              type: 'RECORD_REQUEST_SENT',
              leadName: targetName
            }, async (response) => {
              if (response && response.stats) {
                const todayCount = response.stats.requestsSentToday;
                const limit = response.limitReached;

                if (limit) {
                  showToast(`⚠️ Daily limit reached (${todayCount} sent today)! Stop to protect your account.`, 'warning', 6000);
                } else {
                  showToast(`🚀 Connection request logged! Today: ${todayCount} sent`, 'success');
                }

                // If on profile page, save lead automatically as 'request_sent'
                if (profile && profile.fullName) {
                  const leadToSave = {
                    ...profile,
                    status: 'request_sent',
                    requestSentDate: new Date().toISOString()
                  };
                  if (window.LinkPilotStorage) {
                    await window.LinkPilotStorage.saveLead(leadToSave);
                  }
                }

                updateWidgetMetrics();
              }
            });
          }
        }, 600);
      }
    }, true);
  }

  // --- Chat Follow-Up Injector ---

  function setupChatFollowupInjector() {
    setInterval(() => {
      const chatInputBars = document.querySelectorAll('.msg-form__footer:not([data-lp-injected]), .msg-form__left-actions:not([data-lp-injected])');
      chatInputBars.forEach((bar) => {
        bar.setAttribute('data-lp-injected', 'true');

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'lp-injected-chat-btn';
        btn.innerHTML = '✨ AI Follow-Up';
        btn.title = 'Generate smart 1-Day/2-Day follow-up based on conversation';

        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();

          // Extract chat thread messages
          const messageElements = document.querySelectorAll('.msg-s-message-list__event, .msg-s-event-listitem');
          const chatHistory = [];
          messageElements.forEach((el) => {
            const senderEl = el.querySelector('.msg-s-message-group__name, .msg-s-message-group__profile-link');
            const textEl = el.querySelector('.msg-s-event-listitem__body, .msg-s-message-group__message');
            if (textEl) {
              chatHistory.push({
                sender: senderEl ? senderEl.innerText.trim() : 'Contact',
                text: textEl.innerText.trim(),
                date: new Date().toLocaleTimeString()
              });
            }
          });

          // Extract recipient name from chat header
          const recipientHeader = document.querySelector('.msg-entity-lockup__entity-title, .msg-thread__link-to-profile');
          const leadName = recipientHeader ? recipientHeader.innerText.trim() : 'there';
          const firstName = leadName.split(' ')[0];

          showToast('🤖 LinkPilot AI is writing your follow-up...', 'info', 2500);

          let followupType = 'followup_1';
          if (chatHistory.length > 2) {
            followupType = 'chat_aware';
          } else if (chatHistory.length === 2) {
            followupType = 'followup_2';
          }

          const leadStub = {
            fullName: leadName,
            firstName,
            headline: '',
            chatHistory,
            lastMessage: chatHistory.length > 0 ? chatHistory[chatHistory.length - 1].text : ''
          };

          let generated = null;
          if (window.LinkPilotAI) {
            const settings = window.LinkPilotStorage ? await window.LinkPilotStorage.getSettings() : {};
            generated = await window.LinkPilotAI.generateFollowup(leadStub, followupType, {
              apiKey: settings.geminiApiKey,
              model: settings.geminiModel
            });
          }

          if (generated && generated.message) {
            // Find contenteditable msg input
            const inputField = bar.closest('form')?.querySelector('div[contenteditable="true"], .msg-form__contenteditable');
            if (inputField) {
              inputField.focus();
              document.execCommand('insertText', false, generated.message);
              showToast('✨ AI Follow-up inserted into message box!', 'success');
            } else {
              navigator.clipboard.writeText(generated.message);
              showToast('📋 AI Follow-up copied to clipboard!', 'success');
            }
          }
        });

        bar.prepend(btn);
      });
    }, 1500);
  }

  // --- In-Page Floating Assistant Hub ---

  let container = null;

  function renderFloatingHub() {
    if (document.getElementById('linkpilot-container')) return;

    container = document.createElement('div');
    container.id = 'linkpilot-container';

    container.innerHTML = `
      <div class="lp-fab-button" id="lp-fab">
        <span>🚀 LinkPilot</span>
        <span class="lp-fab-pill" id="lp-badge-counter">0/25</span>
      </div>
      <div class="lp-drawer" id="lp-drawer" style="display: none;">
        <div class="lp-drawer-header">
          <div class="lp-header-title">
            <span>⚡ LinkPilot Pro</span>
          </div>
          <div class="lp-header-controls">
            <button class="lp-icon-btn" id="lp-btn-open-dash" title="Open Full CRM Dashboard">📊</button>
            <button class="lp-icon-btn" id="lp-btn-close" title="Minimize">✕</button>
          </div>
        </div>
        <div class="lp-drawer-body" id="lp-drawer-content">
          <!-- Populated dynamically -->
        </div>
      </div>
    `;

    document.body.appendChild(container);

    // Event listeners
    document.getElementById('lp-fab').addEventListener('click', toggleDrawer);
    document.getElementById('lp-btn-close').addEventListener('click', toggleDrawer);
    document.getElementById('lp-btn-open-dash').addEventListener('click', () => {
      if (chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' });
      }
    });

    updateWidgetMetrics();
  }

  function toggleDrawer() {
    isDrawerOpen = !isDrawerOpen;
    const drawer = document.getElementById('lp-drawer');
    if (drawer) {
      drawer.style.display = isDrawerOpen ? 'flex' : 'none';
      if (isDrawerOpen) {
        refreshDrawerContent();
      }
    }
  }

  async function updateWidgetMetrics() {
    if (!window.LinkPilotStorage) return;
    const stats = await window.LinkPilotStorage.getDailyStats();
    const settings = await window.LinkPilotStorage.getSettings();
    const counterBadge = document.getElementById('lp-badge-counter');
    if (counterBadge) {
      const count = stats.requestsSentToday || 0;
      const limit = settings.dailyRequestLimit || 25;
      counterBadge.innerText = `${count}/${limit}`;

      counterBadge.className = 'lp-fab-pill';
      if (count >= limit) {
        counterBadge.classList.add('danger');
      } else if (count >= limit * 0.8) {
        counterBadge.classList.add('warning');
      }
    }
  }

  async function refreshDrawerContent() {
    const contentEl = document.getElementById('lp-drawer-content');
    if (!contentEl) return;

    const stats = window.LinkPilotStorage ? await window.LinkPilotStorage.getDailyStats() : { requestsSentToday: 0 };
    const settings = window.LinkPilotStorage ? await window.LinkPilotStorage.getSettings() : { dailyRequestLimit: 25 };
    const profile = extractProfileDetails();
    currentProfileData = profile;

    let profileCardHtml = '';
    if (profile && profile.fullName) {
      profileCardHtml = `
        <div class="lp-profile-card">
          <div class="lp-profile-top">
            <div>
              <div class="lp-lead-name">${profile.fullName}</div>
              <div class="lp-lead-headline">${profile.headline || 'No headline available'}</div>
            </div>
            ${profile.hasPhoneOrPortfolio ? '<span class="lp-badge-high-value">⭐ High-Value</span>' : ''}
          </div>

          <div class="lp-lead-fields">
            <div class="lp-field-row">
              <span class="lp-field-label">📧 Email:</span>
              <span class="lp-field-value ${profile.email ? 'highlight' : 'empty'}">${profile.email || 'None detected'}</span>
            </div>
            <div class="lp-field-row">
              <span class="lp-field-label">📱 Phone:</span>
              <span class="lp-field-value ${profile.phone ? 'highlight' : 'empty'}">${profile.phone || 'None detected'}</span>
            </div>
            <div class="lp-field-row">
              <span class="lp-field-label">🌐 Portfolio:</span>
              <span class="lp-field-value ${profile.portfolio ? 'highlight' : 'empty'}">${profile.portfolio ? `<a href="${profile.portfolio}" target="_blank" style="color:#0A66C2;">${profile.portfolio.slice(0, 30)}...</a>` : 'None detected'}</span>
            </div>
          </div>

          <div class="lp-btn-group" style="margin-top: 8px;">
            <button class="lp-btn lp-btn-emerald" id="lp-btn-save-lead">
              💾 Save to CRM ${profile.hasPhoneOrPortfolio ? '(High-Value)' : ''}
            </button>
            <button class="lp-btn lp-btn-purple" id="lp-btn-ai-review">
              🧠 AI Profile Review & Connect Note
            </button>
          </div>

          <div id="lp-ai-review-slot"></div>
        </div>
      `;
    } else {
      profileCardHtml = `
        <div style="text-align:center; padding: 20px 10px; color: #64748b; background: #f8fafc; border-radius: 12px; border: 1px dashed #cbd5e1;">
          <div style="font-size: 26px; margin-bottom: 6px;">🔍</div>
          <div style="font-weight: 600; color: #334155;">No LinkedIn Profile Detected</div>
          <div style="font-size: 12px; margin-top: 4px;">Navigate to any user's profile (/in/username) to extract phone, portfolio, and generate AI notes.</div>
        </div>
      `;
    }

    contentEl.innerHTML = `
      <div class="lp-metrics-strip">
        <div class="lp-metric-card">
          <span class="lp-metric-label">Requests Sent Today</span>
          <span class="lp-metric-val">${stats.requestsSentToday || 0} <span style="font-size:12px; font-weight:normal; color:#64748b;">/ ${settings.dailyRequestLimit}</span></span>
        </div>
        <div class="lp-metric-card">
          <span class="lp-metric-label">Accepted Today</span>
          <span class="lp-metric-val" style="color:#10b981;">${stats.acceptedToday || 0}</span>
        </div>
      </div>

      ${profileCardHtml}

      <div class="lp-btn-group">
        <button class="lp-btn lp-btn-primary" id="lp-btn-launch-dash">
          🚀 Open Leads & Automation Dashboard
        </button>
      </div>
    `;

    // Attach event listeners inside drawer
    const saveLeadBtn = document.getElementById('lp-btn-save-lead');
    if (saveLeadBtn && profile) {
      saveLeadBtn.addEventListener('click', async () => {
        if (window.LinkPilotStorage) {
          const saved = await window.LinkPilotStorage.saveLead(profile);
          showToast(`✅ Saved ${saved.fullName} to CRM!`, 'success');
          saveLeadBtn.innerText = '✅ Saved in CRM';
          saveLeadBtn.disabled = true;
          updateWidgetMetrics();
        }
      });
    }

    const aiReviewBtn = document.getElementById('lp-btn-ai-review');
    if (aiReviewBtn && profile) {
      aiReviewBtn.addEventListener('click', async () => {
        aiReviewBtn.innerText = '🤖 Analyzing Profile with AI...';
        aiReviewBtn.disabled = true;

        let reviewResult = null;
        if (window.LinkPilotAI) {
          const settings = window.LinkPilotStorage ? await window.LinkPilotStorage.getSettings() : {};
          reviewResult = await window.LinkPilotAI.reviewProfile(profile, {
            apiKey: settings.geminiApiKey,
            model: settings.geminiModel
          });
        }

        aiReviewBtn.innerText = '🧠 AI Profile Review & Connect Note';
        aiReviewBtn.disabled = false;

        const slot = document.getElementById('lp-ai-review-slot');
        if (slot && reviewResult) {
          slot.innerHTML = `
            <div class="lp-ai-result-box" style="margin-top: 10px;">
              <div class="lp-ai-box-title">
                <span>✨ AI Executive Summary</span>
              </div>
              <div style="font-size: 12px; color: #374151;">${reviewResult.summary}</div>
              
              <div class="lp-ai-box-title" style="margin-top: 6px;">
                <span>🎯 Custom Connection Note (${reviewResult.icebreakerConnectionNote.length}/300 chars)</span>
              </div>
              <div class="lp-ai-note-text" id="lp-note-copy-target">${reviewResult.icebreakerConnectionNote}</div>
              
              <button class="lp-btn lp-btn-secondary" id="lp-btn-copy-note" style="padding: 6px 10px; font-size: 12px;">
                📋 Copy Note to Clipboard
              </button>
            </div>
          `;

          document.getElementById('lp-btn-copy-note')?.addEventListener('click', () => {
            navigator.clipboard.writeText(reviewResult.icebreakerConnectionNote);
            showToast('📋 Copied AI Connection Note to clipboard!', 'success');
          });
        }
      });
    }

    document.getElementById('lp-btn-launch-dash')?.addEventListener('click', () => {
      if (chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' });
      }
    });
  }

  // --- SPA URL Navigation Watcher ---

  function checkUrlChange() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      updateWidgetMetrics();
      if (isDrawerOpen) {
        refreshDrawerContent();
      }
    }
  }

  // Initialize all listeners
  renderFloatingHub();
  setupConnectionWatcher();
  setupChatFollowupInjector();

  setInterval(checkUrlChange, 1000);
  window.addEventListener('popstate', checkUrlChange);

})();
