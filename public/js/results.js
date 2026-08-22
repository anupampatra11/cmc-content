// ── AI Recommendations rendering ──────────────────────────────────────────────
function renderAiSuggestionItem(s, i, prefix) {
	if (!s) return '';
	const text = typeof s === 'string' ? s : (s.text || '');
	const uid = `${prefix}-${i}-${Math.random().toString(36).slice(2, 5)}`;

	const fixBtn = s.howToFix ? `
		<button class="fix-toggle" id="tog-${uid}" onclick="toggleFix('${uid}')">
			<span class="arrow">▶</span> How to fix
		</button>` : '';
	const fixDrawer = s.howToFix ? `
		<div class="fix-drawer" id="fix-${uid}">
			<div class="fix-how"><strong>What to do</strong>${esc(s.howToFix)}</div>
		</div>` : '';

	const codeBtn = s.codeExample ? `
		<button class="source-toggle" id="src-tog-${uid}" onclick="toggleSource('${uid}')">
			<span class="arrow">▶</span> Where in the code
		</button>` : '';
	const codeDrawer = s.codeExample ? `
		<div class="source-drawer" id="src-${uid}">
			<div class="fix-code-wrap">
				<pre class="fix-code" id="code-${uid}">${esc(s.codeExample)}</pre>
				<button class="copy-btn" id="copy-${uid}" onclick="copyCode('${uid}')">Copy</button>
			</div>
		</div>` : '';

	return `
	<div class="suggestion-item">
		<div class="suggestion-num">${i + 1}</div>
		<div class="suggestion-body">
			<div class="suggestion-text">${esc(text)}</div>
			${fixBtn || codeBtn ? `<div class="toggle-btn-row">${fixBtn}${codeBtn}</div>` : ''}
			${fixDrawer}${codeDrawer}
		</div>
	</div>`;
}

function renderAiSuggestions(ai) {
	const highPriority = ai.highPriority || [];
	const claudeOnly = ai.claudeOnly || [];
	const openaiOnly = ai.openaiOnly || [];

	if (!highPriority.length && !claudeOnly.length && !openaiOnly.length) return '';

	const sectionLabel = (badgeClass, badgeText, titleText) => `
		<div class="sugg-section-label">
			<span class="sugg-badge ${badgeClass}">${badgeText}</span>
			<span class="sugg-section-title">${titleText}</span>
		</div>`;

	let html = `<div class="suggestions-panel fade-in"><div class="panel-title">✦ AI Recommendations</div>`;

	if (highPriority.length) {
		html += sectionLabel('high-priority-badge', '⚡ Both', 'HIGH PRIORITY');
		html += highPriority.map(({ claude }, i) => renderAiSuggestionItem(claude, i, 'hp')).join('');
	}

	if (claudeOnly.length) {
		html += sectionLabel('claude-badge', 'Claude', 'CLAUDE SPECIFIC');
		html += claudeOnly.map((s, i) => renderAiSuggestionItem(s, i, 'cl')).join('');
	}

	if (openaiOnly.length) {
		html += sectionLabel('openai-badge', 'OpenAI', 'OPENAI SPECIFIC');
		html += openaiOnly.map((s, i) => renderAiSuggestionItem(s, i, 'oi')).join('');
	}

	html += '</div>';
	return html;
}

// ── Show results ──────────────────────────────────────────────────────────────
function showResults(data) {
	showSection("resultsSection");

	try {
		const domain = new URL(data.targetUrl).hostname;
		document.getElementById("summaryDomain").textContent = domain;
	} catch {
		document.getElementById("summaryDomain").textContent = data.targetUrl;
	}

	const grammarPages = allPages.length !== 1 ? " pages " : " page ";
	document.getElementById("summaryCount").textContent =
		allPages.length + " page" + grammarPages + "scanned";

	updateAverages(data);

	// Sort the pages from highest to lowest ranked
	sortedPages = [...allPages].sort(
		(a, b) => (b.scores?.combined || 0) - (a.scores?.combined || 0),
	);
	renderPageList();

	const indexHighestRankedPage = allPages.indexOf(sortedPages[0]);
	if (allPages.length > 0)
		selectPage(indexHighestRankedPage);
}

function updateAverages(data) {
	setAvg("avgSeo", data.avgSeo);
	setAvg("avgGeo", data.avgGeo);
	setAvg("avgCombined", data.avgCombined);
}

function setAvg(id, val) {
	const el = document.getElementById(id);
	if (!el || !val) return;
	el.textContent = val;
	el.className = "avg-num " + scoreClass(val);
}

// ── Page list ─────────────────────────────────────────────────────────────────
function renderPageList() {
	const list = document.getElementById("pageList");
	list.innerHTML = "";

	sortedPages.forEach((page) => {
		const origIdx = allPages.indexOf(page);
		const score = page.scores?.combined ?? "?";
		const div = document.createElement("div");
		div.className = "page-item" + (origIdx === selectedPage ? " active" : "");
		div.onclick = () => selectPage(origIdx);
		div.innerHTML = `
            <div class="page-item-info">
                <div class="page-item-title">${esc(page.title || page.slug || page.url)}</div>
                <div class="page-item-path">${esc(page.slug || "/")}</div>
            </div>
            <div class="page-item-score ${scoreClass(score)}">${score}</div>
        `;
		list.appendChild(div);
	});
}

// ── Page detail ───────────────────────────────────────────────────────────────
function selectPage(idx) {
	selectedPage = idx;
	renderPageList();
	renderDetail(allPages[idx]);
}

function renderDetail(page) {
	const wrap = document.getElementById("detailWrap");
	if (!page) {
		wrap.innerHTML = '<div class="detail-empty">No data available</div>';
		return;
	}

	const scores = page.scores || { seo: 0, geo: 0, combined: 0 };
	const ai = page.aiScores || {};
	const checks = page.checks || [];

	// Failed checks sorted by severity - worst first
	const failed = checks
		.filter((c) => !c.pass)
		.sort((a, b) => b.weight - a.weight);
	const passed = checks.filter((c) => c.pass);

	wrap.innerHTML = `
        ${page.status === "error" ? `<div class="page-error">⚠ ${esc(page.errorMessage || "Failed to scan this page")}</div>` : ""}

        <!-- Scores -->
        <div class="scores-panel fade-in">
            <div class="page-detail-title">${esc(page.title || page.url)}</div>
            <div class="page-detail-url">${esc(page.url)}</div>
            <div class="score-rings">
                ${scoreRing(scores.seo, "SEO Score", 128)}
                ${scoreRing(scores.geo, "GEO Score", 128)}
                ${scoreRing(scores.combined, "Velocity Score", 128)}
            </div>
            ${ai.geoSummary
			? `
            <div class="geo-summary">
                <strong>GEO Gap</strong>${esc(ai.geoSummary)}
            </div>`
			: ""
		}
        </div>

        <!-- AI Suggestions -->
        ${renderAiSuggestions(ai)}

        <!-- Audit Findings -->
        <div class="findings-panel fade-in">
            <div class="findings-header">
                <div class="panel-title" style="margin:0">Audit findings</div>
                <div class="findings-counts">
                    <span class="count-pill count-fail">${failed.length} issues</span>
                    <span class="count-pill count-pass">${passed.length} passed</span>
                </div>
            </div>
            ${failed.length > 0
			? `
                <div class="findings-section-header fail-header">Issues to fix</div>
                ${failed.map((c) => checkRow(c, false)).join("")}
            `
			: ""
		}
            ${passed.length > 0
			? `
                <div class="findings-section-header pass-header">Passing</div>
                ${passed.map((c) => checkRow(c, true)).join("")}
            `
			: ""
		}
        </div>

        <!-- AI Signal breakdown -->
        ${hasAiSignals(ai)
			? `
        <div class="signals-panel fade-in">
            <div class="panel-title">AI Signal Analysis</div>
            <div class="signals-grid">
                ${signalCard("Relevance", ai.relevance, 1)}
                ${signalCard("Authority", ai.authority, 1)}
                ${signalCard("Clarity", ai.clarity, 1)}
                ${signalCard("Conversational", ai.conversationalFit, 1)}
                ${signalCard("Uniqueness", ai.uniqueness, 1)}
                ${signalCard("Engagement", ai.engagement, 1)}
                ${signalCard("Trustworthiness", ai.trustworthiness, 1)}
            </div>
        </div>`
			: ""
		}
    `;
}
