// ── Score ring SVG ────────────────────────────────────────────────────────────
function scoreRing(score, label, size) {
	const radius = size * 0.38;
	const circle = 2 * Math.PI * radius;
	const dash = (Math.min(100, score) / 100) * circle;
	const color = scoreColor(score);
	const band = scoreBand(score);

	return `
    <div class="score-ring-wrap">
        <div class="score-ring-visual" width=${size} height=${size}>
            <svg width="${size}" height="${size}">
                <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="#1E293B" stroke-width="${size * 0.08}"/>
                <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="${color}"
                    stroke-width="${size * 0.08}" stroke-dasharray="${dash} ${circle}" stroke-linecap="round"/>
            </svg>
            <div class="score-ring-inner-text">
                <span class="score-number">${score}</span>
                <span class="score-text" style="color:${color}">${band}</span>
            </div>
        </div>
        <div class="score-ring-label">${label}</div>
    </div>`;
}

// ── Audit check row ───────────────────────────────────────────────────────────
function checkRow(check, passing) {
	const iconSvg = passing
		? `<svg width="8" height="8" viewBox="0 0 12 12" fill="none"><path d="M1.5 6l3 3 6-6" stroke="#22C55E" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`
		: `<svg width="8" height="8" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="#EF4444" stroke-width="1.8" stroke-linecap="round"/></svg>`;

	const uid = check.id + "-" + Math.random().toString(36).slice(2, 7);
	const hasFix = !passing && check.howToFix;

	const checkCodeExample = check.codeExample
		? `
		<div class="fix-code-wrap">
			<pre class="fix-code" id="code-${uid}">${esc(check.codeExample)}</pre>
			<button class="copy-btn" id="copy-${uid}" onclick="copyCode('${uid}')">Copy</button>
		</div>`
		: "";

	const fixBtn = hasFix
		? `<button class="fix-toggle" id="tog-${uid}" onclick="toggleFix('${uid}')">
            <span class="arrow">▶</span> How to fix
        </button>`
		: "";
	const fixDrawer = hasFix
		? `<div class="fix-drawer" id="fix-${uid}">
            <div class="fix-how">
                <strong>What to do</strong>
                ${esc(check.howToFix)}
            </div>
            ${checkCodeExample}
        </div>`
		: "";

	const sourceBtn = check.currentHtml
		? `<button class="source-toggle" id="src-tog-${uid}" onclick="toggleSource('${uid}')">
            <span class="arrow">▶</span> Where in the code
        </button>`
		: "";
	const sourceDrawer = check.currentHtml
		? `<div class="source-drawer" id="src-${uid}">
            <div class="fix-code-wrap">
                <pre class="fix-code" id="code-src-${uid}">${esc(check.currentHtml)}</pre>
                <button class="copy-btn" id="copy-src-${uid}" onclick="copyCode('src-${uid}')">Copy</button>
            </div>
        </div>`
		: "";

	return `
    <div class="check-row">
        <div class="check-icon ${passing ? "pass" : "fail"}">${iconSvg}</div>
        <div class="check-content">
            <div class="check-title-row">
                <span class="check-label ${passing ? "dim" : ""}">${esc(check.label)}</span>
                <span class="check-cat ${catClass(check.category)}">${esc(check.category)}</span>
                ${!passing ? `<span class="check-weight">&#8722;${check.weight} pts</span>` : ""}
            </div>
            <div class="check-detail ${passing ? "dim-detail" : ""}">${esc(check.detail)}</div>
            ${fixBtn || sourceBtn ? `<div class="toggle-btn-row">${fixBtn}${sourceBtn}</div>` : ""}
            ${fixDrawer}${sourceDrawer}
        </div>
    </div>`;
}

// ── AI signal card ────────────────────────────────────────────────────────────
function signalCard(label, value, max) {
	const pct = value > 0 ? Math.round((value / max) * 100) : 0;
	const col = pct >= 70 ? "#22C55E" : pct >= 50 ? "#F59E0B" : "#EF4444";
	const display = max === 1 ? pct + "%" : (value || 0) + "/" + max;
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
