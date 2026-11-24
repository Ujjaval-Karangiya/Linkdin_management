/**
 * LinkPilot - AI Engine for LinkedIn Profile Review & Follow-up Generation
 * Supports Google Gemini API integration and an intelligent heuristic fallback.
 */

class LinkPilotAI {
  /**
   * Reviews a LinkedIn profile and produces summary, icebreakers, and engagement angles.
   * @param {Object} profile - { fullName, headline, company, location, about, experience, skills }
   * @param {Object} options - { apiKey, model }
   */
  static async reviewProfile(profile, options = {}) {
    const apiKey = options.apiKey || '';
    const model = options.model || 'gemini-1.5-flash';

    if (apiKey) {
      try {
        return await this.callGeminiReview(profile, apiKey, model);
      } catch (err) {
        console.warn('Gemini API call failed, falling back to smart heuristic:', err);
      }
    }

    // Smart heuristic analysis fallback
    return this.heuristicReview(profile);
  }

  /**
   * Generates a context-aware follow-up message (Day 1, Day 2, or chat-based)
   * @param {Object} lead - lead data with profile and chatHistory
   * @param {String} followUpType - 'followup_1' | 'followup_2' | 'chat_aware'
   * @param {Object} options - { apiKey, model, customGoal }
   */
  static async generateFollowup(lead, followUpType = 'followup_1', options = {}) {
    const apiKey = options.apiKey || '';
    const model = options.model || 'gemini-1.5-flash';

    if (apiKey) {
      try {
        return await this.callGeminiFollowup(lead, followUpType, apiKey, model, options.customGoal);
      } catch (err) {
        console.warn('Gemini Followup call failed, falling back to smart heuristic:', err);
      }
    }

    return this.heuristicFollowup(lead, followUpType, options.customGoal);
  }

  // --- Gemini API Implementations ---

  static async callGeminiReview(profile, apiKey, model) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const prompt = `You are an elite B2B LinkedIn networking & lead generation strategist.
Analyze this LinkedIn profile and provide a structured JSON response:
Name: ${profile.fullName || profile.firstName}
Headline: ${profile.headline || 'N/A'}
Current Company: ${profile.company || 'N/A'}
Location: ${profile.location || 'N/A'}
About: ${profile.about || 'N/A'}
Skills/Experience: ${profile.experience || 'N/A'}

Respond ONLY with valid JSON in this exact structure:
{
  "summary": "2-sentence executive summary of their background and domain expertise",
  "keyStrengths": ["Strength 1", "Strength 2", "Strength 3"],
  "painPointsOrNeeds": "Probable challenges or priorities in their role",
  "icebreakerConnectionNote": "Compelling connection request note under 280 characters mentioning their specific work",
  "suggestedConversationStarters": [
    "Discussion hook 1",
    "Discussion hook 2"
  ]
}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) throw new Error('No response content from Gemini');

    return JSON.parse(candidateText);
  }

  static async callGeminiFollowup(lead, followUpType, apiKey, model, customGoal = '') {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const chatContext = (lead.chatHistory && lead.chatHistory.length > 0)
      ? lead.chatHistory.map(m => `${m.sender || 'Unknown'}: "${m.text || ''}" (${m.date || ''})`).join('\n')
      : 'No previous chat messages yet. Connected recently.';

    let instructions = '';
    if (followUpType === 'followup_1') {
      instructions = 'This is a Day 1 Follow-up sent 24 hours after connecting. Keep it warm, casual, curious, and low-pressure. Under 350 characters.';
    } else if (followUpType === 'followup_2') {
      instructions = 'This is a Day 2-3 Follow-up sent after they did not reply to the first message. Share a quick valuable insight or resource, or ask a simple multiple-choice question. Under 350 characters.';
    } else {
      instructions = 'This is a chat-aware follow-up replying to their previous conversation. Directly acknowledge their last message and advance the discussion with a clear call-to-action.';
    }

    const prompt = `You are a high-conversion LinkedIn messaging expert.
Write a personalized follow-up message to this contact:
Target Contact: ${lead.fullName || lead.firstName}
Headline: ${lead.headline || 'Professional'}
Company: ${lead.company || ''}
Portfolio / Website: ${lead.portfolio || 'N/A'}
Phone: ${lead.phone || 'N/A'}

Recent Chat History:
${chatContext}

Objective/Goal: ${customGoal || 'Build rapport, understand their current priorities, and book a brief intro call if mutually relevant.'}
Cadence & Style: ${instructions}

Return ONLY valid JSON in this exact structure:
{
  "subjectOrTopic": "Brief subject angle",
  "message": "The complete ready-to-send LinkedIn message with proper greeting and sign-off",
  "reasoning": "Why this message fits their profile and conversation stage"
}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) throw new Error('No response content from Gemini');

    return JSON.parse(candidateText);
  }

  // --- Smart Built-in Heuristics (Zero-Config / Offline) ---

  static heuristicReview(profile) {
    const firstName = profile.firstName || (profile.fullName ? profile.fullName.split(' ')[0] : 'there');
    const headline = profile.headline || 'Professional';
    const company = profile.company ? ` at ${profile.company}` : '';

    let roleType = 'Leader';
    if (/engineer|developer|architect|tech/i.test(headline)) roleType = 'Tech Leader';
    else if (/founder|ceo|co-founder|owner/i.test(headline)) roleType = 'Founder/Executive';
    else if (/marketing|growth|sales/i.test(headline)) roleType = 'Growth & Revenue Leader';
    else if (/product|pm/i.test(headline)) roleType = 'Product Strategist';
    else if (/recruit|talent|hr/i.test(headline)) roleType = 'Talent Partner';

    const icebreaker = `Hi ${firstName}, came across your profile and was impressed by your work in ${headline.slice(0, 45)}${company}. Would love to connect and follow your updates!`;

    return {
      summary: `${firstName} is an experienced ${roleType} specializing in ${headline.slice(0, 60)}${company}.`,
      keyStrengths: [
        headline.split('|')[0]?.trim() || 'Domain Expertise',
        profile.company ? `Scaling initiatives at ${profile.company}` : 'Strategic Execution',
        'Industry Networking & Innovation'
      ],
      painPointsOrNeeds: `Likely balancing team velocity, scaling operations, and adopting new workflow tools in ${profile.company || 'their sector'}.`,
      icebreakerConnectionNote: icebreaker.length > 295 ? icebreaker.slice(0, 292) + '...' : icebreaker,
      suggestedConversationStarters: [
        `"Saw your background in ${headline.split('|')[0] || 'your field'} — what are your main focus areas this quarter?"`,
        `"Curious how your team at ${profile.company || 'your organization'} is tackling current industry shifts?"`
      ]
    };
  }

  static heuristicFollowup(lead, followUpType, customGoal = '') {
    const firstName = lead.firstName || (lead.fullName ? lead.fullName.split(' ')[0] : 'there');
    const headline = lead.headline || 'your space';
    const company = lead.company || 'your company';

    if (followUpType === 'followup_1') {
      return {
        subjectOrTopic: 'Day 1 Warm Check-in',
        message: `Hi ${firstName}, thanks for connecting! I was browsing through your background in ${headline.slice(0, 40)} and found it super interesting. Are you currently exploring any new growth initiatives or workflow upgrades at ${company}?`,
        reasoning: 'Warm 24h follow-up showing genuine curiosity and referencing their role.'
      };
    } else if (followUpType === 'followup_2') {
      return {
        subjectOrTopic: 'Day 2 Value Bump',
        message: `Hey ${firstName}, quick follow-up to my note yesterday. I know you're super busy leading things at ${company}! Happy to share a quick 2-minute overview of what we've seen work best in ${headline.slice(0, 30)} if that's relevant right now?`,
        reasoning: 'Day 2 polite bump that respects their time while offering immediate value.'
      };
    } else {
      // Chat-aware follow up
      const lastMsg = lead.lastMessage ? `our chat regarding "${lead.lastMessage.slice(0, 40)}..."` : 'our recent conversation';
      return {
        subjectOrTopic: 'Chat-Aware Follow-up',
        message: `Hi ${firstName}, following up on ${lastMsg}. Wanted to circle back and see if you had any thoughts or if you'd be open to a quick 5-min sync later this week?`,
        reasoning: 'Directly contextualized against past discussion.'
      };
    }
  }
}

if (typeof window !== 'undefined') {
  window.LinkPilotAI = LinkPilotAI;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LinkPilotAI };
}
