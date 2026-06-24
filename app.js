// ─── CONFIG ─────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `ROLE
You are my personal long-term ETF investment analyst.
Your objective is NOT to tell me what I want to hear.
Your objective is to maximize my long-term risk-adjusted wealth while respecting my constraints.
You think like a combination of: Institutional asset allocator, Macro strategist, ETF analyst, Risk manager, Quantitative investor.
You challenge assumptions and avoid recency bias, hype, speculation, and emotional investing.
You are not allowed to recommend assets that are not accessible through a French PEA account.
Assume I invest through Boursorama and can only buy PEA-eligible ETFs.

INVESTMENT UNIVERSE
Only consider: PEA-eligible ETFs, UCITS ETFs, European-listed ETFs.
When recommending an ETF, provide: ETF name, Ticker, ISIN, Provider, TER, Replication method, Accumulating vs distributing, AUM, Main risks.
Never recommend products unavailable to a French PEA investor.

OUTPUT FORMATTING (IMPORTANT)
Always structure your response with clear sections using ## for main sections and ### for subsections.
For ETF tables, format them as proper markdown tables.
Use bullet points with - for lists.
Include a confidence level (0-100%) in every recommendation.
Use **bold** for key figures, ETF names, and important metrics.

ANALYSIS FRAMEWORK
Every recommendation must include:
1. Macro Analysis (inflation, rates, ECB/Fed, growth, recession probability, fiscal policy, geopolitics, currency)
2. Equity Valuation (US, European, EM valuations, CAPE ratios, earnings growth)
3. Structural Trends (AI, semiconductors, energy transition, defense, healthcare, demographics)
4. Risk Analysis with score 1-10
5. Historical Evidence (academic research, factor investing, long-term data)

PORTFOLIO CONSTRUCTION
When given available cash, build three versions:
- Conservative portfolio
- Balanced portfolio  
- Aggressive portfolio

For each: ETF allocation %, exact € amounts, expected return range, expected volatility, worst drawdown estimate, main risks.

DEFAULT PHILOSOPHY
Prefer broad diversification, low-cost ETFs, accumulating ETFs, passive investing, global exposure.
Avoid market timing, frequent trading, speculative bets, concentrated sector bets above 15%.

OUTPUT FORMAT
Always provide:
1. Executive Summary (3-5 bullet points)
2. Current Environment (macro + valuation)
3. Recommended Allocation (ETF table)
4. Risks
5. Alternative Allocation
6. Confidence Level (0-100%)
7. What Could Make This Recommendation Wrong (≥5 points)
8. Next Best Action`;

// ─── STATE ──────────────────────────────────────────────────────────
let conversationHistory = [];
let isLoading = false;

// ─── QUICK STARTS ───────────────────────────────────────────────────
const QUICK_START_PROMPTS = {
  profile: `I'd like to build my investor profile. I'm a French resident investing through a Boursorama PEA account. Can you ask me all the questions you need to understand my situation and give me a tailored investment plan?`,
  portfolio: `I want to build a PEA portfolio. I have €10,000 to invest today plus €500/month ongoing. Can you build me a conservative, balanced, and aggressive version with specific ETF allocations, tickers, ISINs, and exact euro amounts?`,
  macro: `Can you give me a full macro and valuation analysis for today's environment? I want to know what the ECB, Fed, inflation, interest rates, and equity valuations are telling us right now — and how that should affect my PEA allocation.`,
  rebalance: `I want to review whether I should rebalance my PEA. Can you ask me about my current holdings and help me determine if drift thresholds, transaction costs, and tax considerations justify making changes?`,
  etf: `Can you compare the main world ETF options available on a French PEA? I want to see the key differences between providers like Amundi, BNP, and Lyxor — including TER, AUM, replication method, ISIN, and which one you'd recommend for a buy-and-hold investor.`
};

// ─── SIDEBAR TOGGLE ─────────────────────────────────────────────────
function toggleSidebar() {
  document.querySelector('.sidebar').classList.toggle('open');
}

// ─── NEW CHAT ────────────────────────────────────────────────────────
function newChat() {
  conversationHistory = [];
  const msgs = document.getElementById('messages');
  msgs.innerHTML = `
    <div class="welcome" id="welcome">
      <div class="welcome-eyebrow">Your PEA Investment Analyst</div>
      <h1 class="welcome-title">Where should your<br/><em>money work?</em></h1>
      <p class="welcome-sub">Institutional-grade analysis for French PEA investors. I challenge your assumptions, avoid hype, and optimize for long-term risk-adjusted returns.</p>
      <div class="welcome-cards">
        <div class="wcard" onclick="quickStart('profile')">
          <div class="wcard-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg></div>
          <div class="wcard-label">Build my profile</div>
          <div class="wcard-desc">Age, income, goals, risk tolerance</div>
        </div>
        <div class="wcard" onclick="quickStart('portfolio')">
          <div class="wcard-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M7 10l3 3 4-4 3 3"/></svg></div>
          <div class="wcard-label">Portfolio construction</div>
          <div class="wcard-desc">Conservative, balanced, or aggressive</div>
        </div>
        <div class="wcard" onclick="quickStart('macro')">
          <div class="wcard-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></svg></div>
          <div class="wcard-label">Macro environment</div>
          <div class="wcard-desc">ECB, Fed, rates, valuations</div>
        </div>
      </div>
    </div>`;
}

// ─── QUICK START ─────────────────────────────────────────────────────
function quickStart(key) {
  const prompt = QUICK_START_PROMPTS[key];
  if (!prompt) return;
  document.getElementById('userInput').value = prompt;
  sendMessage();
}

// ─── INPUT HANDLING ──────────────────────────────────────────────────
function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 180) + 'px';
}

// ─── SEND MESSAGE ─────────────────────────────────────────────────────
async function sendMessage() {
  if (isLoading) return;
  const input = document.getElementById('userInput');
  const text = input.value.trim();
  if (!text) return;

  // Hide welcome
  const welcome = document.getElementById('welcome');
  if (welcome) welcome.remove();

  // Add user message
  addUserMessage(text);
  input.value = '';
  input.style.height = 'auto';

  // Add to history
  conversationHistory.push({ role: 'user', content: text });

  // Show typing
  const typingId = addTypingIndicator();
  isLoading = true;
  document.getElementById('sendBtn').disabled = true;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: conversationHistory
      })
    });

    const data = await response.json();

    if (data.error) throw new Error(data.error.message);

    const assistantText = data.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    conversationHistory.push({ role: 'assistant', content: assistantText });

    removeTypingIndicator(typingId);
    addAssistantMessage(assistantText);

  } catch (err) {
    removeTypingIndicator(typingId);
    addAssistantMessage(`**Error:** ${err.message}\n\nPlease check your connection and try again.`);
  } finally {
    isLoading = false;
    document.getElementById('sendBtn').disabled = false;
  }
}

// ─── ADD USER MESSAGE ─────────────────────────────────────────────────
function addUserMessage(text) {
  const msgs = document.getElementById('messages');
  const group = document.createElement('div');
  group.className = 'msg-group';
  group.innerHTML = `
    <div class="msg-user">
      <div class="msg-user-bubble">${escapeHtml(text)}</div>
    </div>`;
  msgs.appendChild(group);
  scrollToBottom();
}

// ─── ADD ASSISTANT MESSAGE ────────────────────────────────────────────
function addAssistantMessage(markdown) {
  const msgs = document.getElementById('messages');
  const group = document.createElement('div');
  group.className = 'msg-group';
  group.innerHTML = `
    <div class="msg-assistant">
      <div class="assistant-avatar">A</div>
      <div class="assistant-content">
        <div class="assistant-label">ALLOCATE</div>
        <div class="assistant-body">${renderMarkdown(markdown)}</div>
      </div>
    </div>`;
  msgs.appendChild(group);
  scrollToBottom();
}

// ─── TYPING INDICATOR ────────────────────────────────────────────────
function addTypingIndicator() {
  const id = 'typing-' + Date.now();
  const msgs = document.getElementById('messages');
  const group = document.createElement('div');
  group.className = 'msg-group';
  group.id = id;
  group.innerHTML = `
    <div class="msg-assistant">
      <div class="assistant-avatar">A</div>
      <div class="assistant-content">
        <div class="assistant-label">ALLOCATE</div>
        <div class="typing">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
    </div>`;
  msgs.appendChild(group);
  scrollToBottom();
  return id;
}

function removeTypingIndicator(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

// ─── SCROLL ───────────────────────────────────────────────────────────
function scrollToBottom() {
  const msgs = document.getElementById('messages');
  msgs.scrollTop = msgs.scrollHeight;
}

// ─── ESCAPE HTML ──────────────────────────────────────────────────────
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── MARKDOWN RENDERER ────────────────────────────────────────────────
function renderMarkdown(text) {
  let html = escapeHtml(text);

  // Tables
  html = html.replace(/\|(.+)\|\n\|[-| :]+\|\n((?:\|.+\|\n?)+)/g, (_, header, body) => {
    const headers = header.split('|').map(h => h.trim()).filter(Boolean);
    const rows = body.trim().split('\n').map(row =>
      row.split('|').map(c => c.trim()).filter(Boolean)
    );

    const isNumeric = (s) => /^[-€%+\d.,]+$/.test(s.replace(/\s/g, ''));

    let table = `<div class="etf-table-wrap"><table class="etf-table"><thead><tr>`;
    headers.forEach(h => { table += `<th>${h}</th>`; });
    table += `</tr></thead><tbody>`;
    rows.forEach(row => {
      table += '<tr>';
      row.forEach((cell, i) => {
        const cls = isNumeric(cell) ? 'col-num' : (i === row.length - 1 && cell.includes('%') ? 'col-alloc' : '');
        table += `<td class="${cls}">${cell}</td>`;
      });
      table += '</tr>';
    });
    table += `</tbody></table></div>`;
    return table;
  });

  // Headings
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Inline code
  html = html.replace(/`(.+?)`/g, '<code>$1</code>');

  // Bullet lists
  html = html.replace(/((?:^- .+\n?)+)/gm, (block) => {
    const items = block.trim().split('\n').map(line =>
      `<li>${line.replace(/^- /, '')}</li>`
    ).join('');
    return `<ul>${items}</ul>`;
  });

  // Numbered lists
  html = html.replace(/((?:^\d+\. .+\n?)+)/gm, (block) => {
    const items = block.trim().split('\n').map(line =>
      `<li>${line.replace(/^\d+\. /, '')}</li>`
    ).join('');
    return `<ol style="padding-left:18px;margin:10px 0;">${items}</ol>`;
  });

  // Paragraphs (double newlines)
  html = html.replace(/\n\n/g, '</p><p>');
  html = '<p>' + html + '</p>';

  // Single newlines inside paragraphs
  html = html.replace(/([^>])\n([^<])/g, '$1<br/>$2');

  // Clean up empty tags
  html = html.replace(/<p>\s*<\/p>/g, '');
  html = html.replace(/<p>(<h[23]>)/g, '$1');
  html = html.replace(/(<\/h[23]>)<\/p>/g, '$1');
  html = html.replace(/<p>(<ul>)/g, '$1');
  html = html.replace(/(<\/ul>)<\/p>/g, '$1');
  html = html.replace(/<p>(<ol>)/g, '$1');
  html = html.replace(/(<\/ol>)<\/p>/g, '$1');
  html = html.replace(/<p>(<div)/g, '$1');
  html = html.replace(/(<\/div>)<\/p>/g, '$1');

  return html;
}
