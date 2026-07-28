// ── State ─────────────────────────────────────────────────────────────────────
let currentScanId = null;
let pollInterval  = null;
let selectedPage  = null;
let allPages      = [];

// ── Scan kick-off ─────────────────────────────────────────────────────────────
async function startScan() {
    const input = document.getElementById('urlInput');
    const errorEl = document.getElementById('inputError');
    let url = input.value.trim();

    errorEl.textContent = '';
    if (!url) { errorEl.textContent = 'Please enter a URL.'; return; }
    if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;

    try { new URL(url); } catch {
        errorEl.textContent = 'Please enter a valid URL.'; return;
    }

    document.getElementById('scanBtn').disabled = true;
    showSection('progressSection');

    try {
        const res = await fetch('/api/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        const data = await res.json();
        if (!res.ok) { showError(data.error || 'Scan failed'); return; }
        currentScanId = data.scanId;
        allPages = [];
        startPolling();
    } catch (e) {
        showError('Could not reach the server. Is Spring running on port 8080?');
    }
}

// ── Polling ───────────────────────────────────────────────────────────────────
function startPolling() {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(poll, 1500);
}

async function poll() {
    if (!currentScanId) return;
    try {
        const res  = await fetch('/api/scan/' + currentScanId);
        const data = await res.json();
        updateProgress(data);
        if (data.status === 'complete' || data.status === 'error') {
            clearInterval(pollInterval);
            if (data.status === 'complete') showResults(data);
            else showError(data.errorMessage || 'Scan failed');
        }
    } catch (e) {
        console.error('Poll error:', e);
    }
}

// ── Progress updates ──────────────────────────────────────────────────────────
function updateProgress(data) {
    document.getElementById('progressIcon').textContent =
        data.scannedPages > 0 ? '⚡' : '🔍';
    document.getElementById('progressTitle').textContent =
        data.scannedPages > 0 ? 'Analysing content…' : 'Discovering pages…';
    document.getElementById('progressLabel').textContent =
        data.progressLabel || 'Working…';

    const pct = data.totalPages > 0
        ? Math.round((data.scannedPages / data.totalPages) * 100) : 5;
    document.getElementById('progressBar').style.width = pct + '%';
    document.getElementById('progressCount').textContent =
        data.scannedPages > 0
            ? data.scannedPages + ' page' + (data.scannedPages !== 1 ? 's' : '') + ' scanned'
            : '';

    // Stream pages in as they complete
    if (data.pages && data.pages.length > allPages.length) {
        allPages = data.pages;
        updateAverages(data);
    }
}

// ── Show results ──────────────────────────────────────────────────────────────
function showResults(data) {
    allPages = data.pages || [];
    showSection('resultsSection');

    try {
        const domain = new URL(data.targetUrl).hostname;
        document.getElementById('summaryDomain').textContent = domain;
    } catch { document.getElementById('summaryDomain').textContent = data.targetUrl; }

    document.getElementById('summaryCount').textContent =
        allPages.length + ' page' + (allPages.length !== 1 ? 's' : '') + ' scanned';

    updateAverages(data);
    renderPageList();
    if (allPages.length > 0) selectPage(0);
}

function updateAverages(data) {
    setAvg('avgSeo', data.avgSeo);
    setAvg('avgGeo', data.avgGeo);
    setAvg('avgCombined', data.avgCombined);
}

function setAvg(id, val) {
    const el = document.getElementById(id);
    if (!el || !val) return;
    el.textContent = val;
    el.className = 'avg-num ' + scoreClass(val);
}

// ── Page list ─────────────────────────────────────────────────────────────────
function renderPageList() {
    const list = document.getElementById('pageList');
    list.innerHTML = '';
    const sorted = [...allPages].sort((a, b) =>
        (b.scores?.combined || 0) - (a.scores?.combined || 0));

    sorted.forEach((page, i) => {
        const origIdx = allPages.indexOf(page);
        const score = page.scores?.combined ?? '?';
        const div = document.createElement('div');
        div.className = 'page-item' + (origIdx === selectedPage ? ' active' : '');
        div.onclick = () => selectPage(origIdx);
        div.innerHTML = `
            <div class="page-item-info">
                <div class="page-item-title">${esc(page.title || page.slug || page.url)}</div>
                <div class="page-item-path">${esc(page.slug || '/')}</div>
            </div>
            <div class="page-item-score ${scoreClass(score)}">${score}</div>
        `;
        list.appendChild(div);
    });
}

// ── Page detail ───────────────────────────────────────────────────────────────
function selectPage(idx) {
    selectedPage = idx;
    document.querySelectorAll('.page-item').forEach((el, i) => {
        el.classList.toggle('active', allPages.indexOf(allPages[idx]) === allPages.indexOf(
            [...allPages].sort((a,b) => (b.scores?.combined||0)-(a.scores?.combined||0))[
                [...document.querySelectorAll('.page-item')].indexOf(el)
            ]
        ));
    });
    // Simpler: re-render list to set active
    renderPageListWithActive(idx);
    renderDetail(allPages[idx]);
}

function renderPageListWithActive(activeIdx) {
    const list = document.getElementById('pageList');
    list.innerHTML = '';
    const sorted = [...allPages].sort((a,b) => (b.scores?.combined||0)-(a.scores?.combined||0));
    sorted.forEach(page => {
        const origIdx = allPages.indexOf(page);
        const score = page.scores?.combined ?? '?';
        const div = document.createElement('div');
        div.className = 'page-item' + (origIdx === activeIdx ? ' active' : '');
        div.onclick = () => selectPage(origIdx);
        div.innerHTML = `
            <div class="page-item-info">
                <div class="page-item-title">${esc(page.title || page.slug || page.url)}</div>
                <div class="page-item-path">${esc(page.slug || '/')}</div>
            </div>
            <div class="page-item-score ${scoreClass(score)}">${score}</div>
        `;
        list.appendChild(div);
    });
}

function renderDetail(page) {
    const wrap = document.getElementById('detailWrap');
    if (!page) { wrap.innerHTML = '<div class="detail-empty">No data available</div>'; return; }

    const scores  = page.scores  || { seo: 0, geo: 0, combined: 0 };
    const ai      = page.aiScores || {};
    const checks  = page.checks  || [];
    const failed  = checks.filter(c => !c.pass);
    const passed  = checks.filter(c => c.pass);

    wrap.innerHTML = `
        ${page.status === 'error' ? `<div class="page-error">⚠ ${esc(page.errorMessage || 'Failed to scan this page')}</div>` : ''}

        <!-- Scores -->
        <div class="scores-panel fade-in">
            <div class="page-detail-title">${esc(page.title || page.url)}</div>
            <div class="page-detail-url">${esc(page.url)}</div>
            <div class="score-rings">
                ${scoreRing(scores.seo, 'SEO Score', 108)}
                ${scoreRing(scores.geo, 'GEO Score', 108)}
                ${scoreRing(scores.combined, 'Velocity Score', 128)}
            </div>
            ${ai.geoSummary ? `
            <div class="geo-summary">
                <strong>GEO Gap</strong>${esc(ai.geoSummary)}
            </div>` : ''}
        </div>

        <!-- AI Suggestions -->
        ${ai.topSuggestions && ai.topSuggestions.length > 0 ? `
        <div class="suggestions-panel fade-in">
            <div class="panel-title">✦ AI Recommendations</div>
            ${ai.topSuggestions.map((s, i) => `
            <div class="suggestion-item">
                <div class="suggestion-num">${i+1}</div>
                <div class="suggestion-text">${esc(s)}</div>
            </div>`).join('')}
        </div>` : ''}

        <!-- Audit Findings -->
        <div class="findings-panel fade-in">
            <div class="findings-header">
                <div class="panel-title" style="margin:0">Audit findings</div>
                <div class="findings-counts">
                    <span class="count-pill count-fail">${failed.length} issues</span>
                    <span class="count-pill count-pass">${passed.length} passed</span>
                </div>
            </div>
            ${failed.length > 0 ? `
                <div class="findings-section-header fail-header">Issues to fix</div>
                ${failed.map(c => checkRow(c, false)).join('')}
            ` : ''}
            ${passed.length > 0 ? `
                <div class="findings-section-header pass-header">Passing</div>
                ${passed.map(c => checkRow(c, true)).join('')}
            ` : ''}
        </div>

        <!-- AI Signal breakdown -->
        ${hasAiSignals(ai) ? `
        <div class="signals-panel fade-in">
            <div class="panel-title">AI Signal Analysis</div>
            <div class="signals-grid">
                ${signalCard('Relevance',       ai.relevance,         1)}
                ${signalCard('Authority',       ai.authority,         1)}
                ${signalCard('Clarity',         ai.clarity,           1)}
                ${signalCard('Conversational',  ai.conversationalFit, 1)}
                ${signalCard('Uniqueness',      ai.uniqueness,        1)}
                ${signalCard('Engagement',      ai.engagement,        1)}
                ${signalCard('Trustworthiness', ai.trustworthiness,   1)}
            </div>
        </div>` : ''}
    `;
}

// ── HTML helpers ──────────────────────────────────────────────────────────────
function scoreRing(score, label, size) {
    const r    = size * 0.38;
    const circ = 2 * Math.PI * r;
    const dash = (Math.min(100, score) / 100) * circ;
    const col  = scoreColor(score);
    const band = scoreBand(score);
    return `
    <div class="score-ring-wrap">
        <div style="position:relative;width:${size}px;height:${size}px;flex-shrink:0;">
            <svg width="${size}" height="${size}" style="transform:rotate(-90deg);display:block;">
                <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="#1E293B" stroke-width="${size*0.08}"/>
                <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${col}"
                    stroke-width="${size*0.08}" stroke-dasharray="${dash} ${circ}" stroke-linecap="round"/>
            </svg>
            <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;">
                <span style="font-size:${Math.round(size*0.24)}px;font-weight:700;color:#F1F5F9;font-family:var(--mono);line-height:1">${score}</span>
                <span style="font-size:${Math.round(size*0.095)}px;color:${col};font-weight:600;text-transform:uppercase;letter-spacing:.08em;line-height:1">${band}</span>
            </div>
        </div>
        <div class="score-ring-label" style="margin-top:8px">${label}</div>
    </div>`;
}

function checkRow(check, passing) {
    const iconSvg = passing
        ? `<svg width="8" height="8" viewBox="0 0 12 12" fill="none"><path d="M1.5 6l3 3 6-6" stroke="#22C55E" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`
        : `<svg width="8" height="8" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="#EF4444" stroke-width="1.8" stroke-linecap="round"/></svg>`;

    const uid = check.id + '-' + Math.random().toString(36).slice(2,7);
    const hasFix = !passing && check.howToFix;

    const fixDrawer = hasFix ? `
        <button class="fix-toggle" id="tog-${uid}" onclick="toggleFix('${uid}')">
            <span class="arrow">▶</span> How to fix
        </button>
        <div class="fix-drawer" id="fix-${uid}">
            <div class="fix-how">
                <strong>What to do</strong>
                ${esc(check.howToFix)}
            </div>
            ${check.codeExample ? `
            <div class="fix-code-wrap">
                <pre class="fix-code" id="code-${uid}">${esc(check.codeExample)}</pre>
                <button class="copy-btn" id="copy-${uid}" onclick="copyCode('${uid}')">Copy</button>
            </div>` : ''}
        </div>` : '';

    return `
    <div class="check-row">
        <div class="check-icon ${passing ? 'pass' : 'fail'}">${iconSvg}</div>
        <div class="check-content">
            <div class="check-title-row">
                <span class="check-label ${passing ? 'dim' : ''}">${esc(check.label)}</span>
                <span class="check-cat ${catClass(check.category)}">${esc(check.category)}</span>
                ${!passing ? `<span class="check-weight">&#8722;${check.weight} pts</span>` : ''}
            </div>
            <div class="check-detail ${passing ? 'dim-detail' : ''}">${esc(check.detail)}</div>
            ${fixDrawer}
        </div>
    </div>`;
}

function signalCard(label, value, max) {
    const pct = value > 0 ? Math.round((value / max) * 100) : 0;
    const col = pct >= 70 ? '#22C55E' : pct >= 50 ? '#F59E0B' : '#EF4444';
    const display = max === 1 ? pct + '%' : (value || 0) + '/' + max;
    return `
    <div class="signal-card">
        <div class="signal-top">
            <span class="signal-name">${label}</span>
            <span class="signal-value" style="color:${col}">${display}</span>
        </div>
        <div class="signal-bar-bg">
            <div class="signal-bar-fill" style="width:${pct}%;background:${col}"></div>
        </div>
    </div>`;
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function scoreColor(s) {
    if (s >= 80) return '#22C55E';
    if (s >= 60) return '#3B82F6';
    if (s >= 40) return '#F59E0B';
    return '#EF4444';
}
function scoreBand(s) {
    if (s >= 80) return 'Excellent';
    if (s >= 60) return 'Good';
    if (s >= 40) return 'Needs work';
    return 'Critical';
}
function scoreClass(s) {
    if (s >= 80) return 'score-excellent';
    if (s >= 60) return 'score-good';
    if (s >= 40) return 'score-needs';
    return 'score-critical';
}
function catClass(cat) {
    if (!cat) return 'cat-onpage';
    const c = cat.toLowerCase();
    if (c.includes('technical')) return 'cat-tech';
    if (c.includes('content'))   return 'cat-content';
    if (c.includes('e-e-a-t'))   return 'cat-eeeat';
    if (c.includes('geo'))       return 'cat-geo';
    return 'cat-onpage';
}
function hasAiSignals(ai) {
    return ai && (ai.relevance || ai.authority || ai.clarity ||
                  ai.conversationalFit || ai.uniqueness ||
                  ai.engagement || ai.trustworthiness);
}
function esc(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function showSection(id) {
    ['hero','progressSection','resultsSection'].forEach(s => {
        const el = document.getElementById(s);
        if (el) el.classList.toggle('hidden', s !== id);
    });
}
function showError(msg) {
    document.getElementById('progressIcon').textContent  = '⚠️';
    document.getElementById('progressTitle').textContent = 'Scan failed';
    document.getElementById('progressLabel').textContent = msg;
    document.getElementById('scanBtn').disabled = false;
}
function resetScan() {
    if (pollInterval) clearInterval(pollInterval);
    currentScanId = null; allPages = []; selectedPage = null;
    document.getElementById('urlInput').value = '';
    document.getElementById('inputError').textContent = '';
    document.getElementById('scanBtn').disabled = false;
    showSection('hero');
}

// Enter key on input
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('urlInput').addEventListener('keydown', e => {
        if (e.key === 'Enter') startScan();
    });
});

// ── Fix drawer toggle ─────────────────────────────────────────────────────────
function toggleFix(id) {
    const drawer  = document.getElementById('fix-' + id);
    const toggle  = document.getElementById('tog-' + id);
    if (!drawer || !toggle) return;
    const isOpen  = drawer.classList.contains('open');
    drawer.classList.toggle('open', !isOpen);
    toggle.classList.toggle('open', !isOpen);
    toggle.querySelector('.arrow').textContent = isOpen ? '▶' : '▶';
}

// ── Copy code to clipboard ────────────────────────────────────────────────────
function copyCode(id) {
    const pre = document.getElementById('code-' + id);
    const btn = document.getElementById('copy-' + id);
    if (!pre || !btn) return;
    navigator.clipboard.writeText(pre.textContent).then(() => {
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
            btn.textContent = 'Copy';
            btn.classList.remove('copied');
        }, 2000);
    });
}