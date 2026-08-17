// ── State ─────────────────────────────────────────────────────────────────────
let currentScanId = null;
let pollInterval = null;
let selectedPage = null;
let allPages = [];

// ── Scan kick-off ─────────────────────────────────────────────────────────────
async function startScan() {
	const input = document.getElementById("urlInput");
	const errorEl = document.getElementById("inputError");
	let url = input.value.trim();

	errorEl.textContent = "";
	if (!url) {
		errorEl.textContent = "Please enter a URL.";
		return;
	}
	if (!url.startsWith("http://") && !url.startsWith("https://"))
		url = "https://" + url;

	try {
		new URL(url);
	} catch {
		errorEl.textContent = "Please enter a valid URL.";
		return;
	}

	document.getElementById("scanBtn").disabled = true;
	showSection("progressSection");

	try {
		const res = await fetch("/api/scan", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ url }),
		});
		const data = await res.json();
		if (!res.ok) {
			showError(data.error || "Scan failed");
			return;
		}
		currentScanId = data.scanId;
		allPages = [];
		startPolling();
	} catch (e) {
		showError("Could not reach the server. Is Spring running on port 8080?");
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
		const res = await fetch("/api/scan/" + currentScanId);
		const data = await res.json();
		updateProgress(data);
		if (data.status === "complete" || data.status === "error") {
			clearInterval(pollInterval);
			if (data.status === "complete") showResults(data);
			else showError(data.errorMessage || "Scan failed");
		}
	} catch (e) {
		console.error("Poll error:", e);
	}
}

// ── Progress updates ──────────────────────────────────────────────────────────
function updateProgress(data) {
	document.getElementById("progressIcon").textContent =
		data.scannedPages > 0 ? "⚡" : "🔍";
	document.getElementById("progressTitle").textContent =
		data.scannedPages > 0 ? "Analysing content…" : "Discovering pages…";
	document.getElementById("progressLabel").textContent =
		data.progressLabel || "Working…";

	const pct =
		data.totalPages > 0
			? Math.round((data.scannedPages / data.totalPages) * 100)
			: 5;
	document.getElementById("progressBar").style.width = pct + "%";
	const progressGrammarPages = data.scannedPages !== 1 ? " pages " : " page ";
	document.getElementById("progressCount").textContent =
		data.scannedPages > 0
			? data.scannedPages + progressGrammarPages + "scanned"
			: "";

	// Stream pages in as they complete
	if (data.pages && data.pages.length > allPages.length) {
		allPages = data.pages;
		updateAverages(data);
	}
}

// ── Show results ──────────────────────────────────────────────────────────────
function showResults(data) {
	allPages = data.pages || [];
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
	renderPageList();
	if (allPages.length > 0) selectPage(0);
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
	const sorted = [...allPages].sort(
		(a, b) => (b.scores?.combined || 0) - (a.scores?.combined || 0),
	);

	sorted.forEach((page, i) => {
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
	document.querySelectorAll(".page-item").forEach((el, i) => {
		el.classList.toggle(
			"active",
			allPages.indexOf(allPages[idx]) ===
			allPages.indexOf(
				[...allPages].sort(
					(a, b) => (b.scores?.combined || 0) - (a.scores?.combined || 0),
				)[[...document.querySelectorAll(".page-item")].indexOf(el)],
			),
		);
	});
	// Simpler: re-render list to set active
	renderPageListWithActive(idx);
	renderDetail(allPages[idx]);
}

function renderPageListWithActive(activeIdx) {
	const list = document.getElementById("pageList");
	list.innerHTML = "";
	const sorted = [...allPages].sort(
		(a, b) => (b.scores?.combined || 0) - (a.scores?.combined || 0),
	);
	sorted.forEach((page) => {
		const origIdx = allPages.indexOf(page);
		const score = page.scores?.combined ?? "?";
		const div = document.createElement("div");
		div.className = "page-item" + (origIdx === activeIdx ? " active" : "");
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

function renderDetail(page) {
	const wrap = document.getElementById("detailWrap");
	if (!page) {
		wrap.innerHTML = '<div class="detail-empty">No data available</div>';
		return;
	}

	const scores = page.scores || { seo: 0, geo: 0, combined: 0 };
	const ai = page.aiScores || {};
	const checks = page.checks || [];
	const failed = checks.filter((c) => !c.pass);
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
        ${ai.topSuggestions && ai.topSuggestions.length > 0
			? `
        <div class="suggestions-panel fade-in">
            <div class="panel-title">✦ AI Recommendations</div>
            ${ai.topSuggestions
				.map(
					(s, i) => `
            <div class="suggestion-item">
                <div class="suggestion-num">${i + 1}</div>
                <div class="suggestion-text">${esc(s)}</div>
            </div>`,
				)
				.join("")}
        </div>`
			: ""
		}

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

// ── HTML helpers ──────────────────────────────────────────────────────────────
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
        <div class="score-ring-label" >${label}</div>
    </div>`;
}

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
	
	const fixDrawer = hasFix
		? `
        <button class="fix-toggle" id="tog-${uid}" onclick="toggleFix('${uid}')">
            <span class="arrow">▶</span> How to fix
        </button>
        <div class="fix-drawer" id="fix-${uid}">
            <div class="fix-how">
                <strong>What to do</strong>
                ${esc(check.howToFix)}
            </div>
            ${checkCodeExample}
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
            ${fixDrawer}
        </div>
    </div>`;
}

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

// ── Utilities ─────────────────────────────────────────────────────────────────
function scoreColor(s) {
	if (s >= 80) return "#22C55E";
	if (s >= 60) return "#3B82F6";
	if (s >= 40) return "#F59E0B";
	return "#EF4444";
}
function scoreBand(s) {
	if (s >= 80) return "Excellent";
	if (s >= 60) return "Good";
	if (s >= 40) return "Needs work";
	return "Critical";
}
function scoreClass(s) {
	if (s >= 80) return "score-excellent";
	if (s >= 60) return "score-good";
	if (s >= 40) return "score-needs";
	return "score-critical";
}
function catClass(cat) {
	if (!cat) return "cat-onpage";
	const c = cat.toLowerCase();
	if (c.includes("technical")) return "cat-tech";
	if (c.includes("content")) return "cat-content";
	if (c.includes("e-e-a-t")) return "cat-eeeat";
	if (c.includes("geo")) return "cat-geo";
	return "cat-onpage";
}
function hasAiSignals(ai) {
	return (
		ai &&
		(ai.relevance ||
			ai.authority ||
			ai.clarity ||
			ai.conversationalFit ||
			ai.uniqueness ||
			ai.engagement ||
			ai.trustworthiness)
	);
}
function esc(str) {
	if (!str) return "";
	return String(str)
		.replaceAll('&', "&amp;")
		.replaceAll('<', "&lt;")
		.replaceAll('>', "&gt;")
		.replaceAll('"', "&quot;");
}
function showSection(id) {
	["hero", "progressSection", "resultsSection"].forEach((s) => {
		const el = document.getElementById(s);
		if (el) el.classList.toggle("hidden", s !== id);
	});
}
function showError(msg) {
	document.getElementById("progressIcon").textContent = "⚠️";
	document.getElementById("progressTitle").textContent = "Scan failed";
	document.getElementById("progressLabel").textContent = msg;
	document.getElementById("scanBtn").disabled = false;
}
function resetScan() {
	if (pollInterval) clearInterval(pollInterval);
	currentScanId = null;
	allPages = [];
	selectedPage = null;
	document.getElementById("urlInput").value = "";
	document.getElementById("inputError").textContent = "";
	document.getElementById("scanBtn").disabled = false;
	showSection("hero");
}

// Enter key on input
document.addEventListener("DOMContentLoaded", () => {
	document.getElementById("urlInput").addEventListener("keydown", (e) => {
		if (e.key === "Enter") startScan();
	});
});

// ── Fix drawer toggle ─────────────────────────────────────────────────────────
function toggleFix(id) {
	const drawer = document.getElementById("fix-" + id);
	const toggle = document.getElementById("tog-" + id);
	if (!drawer || !toggle) return;
	const isOpen = drawer.classList.contains("open");
	drawer.classList.toggle("open", !isOpen);
	toggle.classList.toggle("open", !isOpen);
}

// ── Copy code to clipboard ────────────────────────────────────────────────────
function copyCode(id) {
	const pre = document.getElementById("code-" + id);
	const btn = document.getElementById("copy-" + id);
	if (!pre || !btn) return;
	navigator.clipboard.writeText(pre.textContent).then(() => {
		btn.textContent = "Copied!";
		btn.classList.add("copied");
		setTimeout(() => {
			btn.textContent = "Copy";
			btn.classList.remove("copied");
		}, 2000);
	});
}

// ── Handle dropdown report download ───────────────────────────────────────────
/* When the user clicks on the button, toggle between hiding and showing the dropdown content */
function myFunction() {
	document.getElementById("dropdown-download").classList.toggle("show-dropdown-options");
}

// Close the dropdown if the user clicks outside of it
window.onclick = function (event) {
	if (!event.target.matches('.dropdown-btn')) {
		const dropdowns = document.getElementsByClassName("dropdown-content");
		for (const element of dropdowns) {
			let openDropdown = element;
			if (openDropdown.classList.contains("show-dropdown-options")) {
				openDropdown.classList.remove("show-dropdown-options");
			}
		}
	}
}

// ── Download the data as a PDF ────────────────────────────────────────────────
function downloadPdf() {
	const { jsPDF } = window.jspdf;

	const pdf = new jsPDF({unit: "px"});
	const x = 40;
	let y = 50;

	pdf.setFont("helvetica", "normal");
	pdf.setCharSpace(0);

	// Title
	pdf.setFontSize(FontSizesPDF.title);
	pdf.text('Content Velocity Scan Report', x, y);
	y += LineBreakPDF.section

	// Scanned website and how many pages were scanned
	pdf.setFontSize(FontSizesPDF.mediumText);
	y += FontSizesPDF.mediumText;
	pdf.text(
		`Domain: ${document.getElementById('summaryDomain')?.textContent || ''}`,
		x,
		y
	);
	
	y += FontSizesPDF.mediumText;
	pdf.text(
		`Pages scanned: ${document.getElementById('summaryCount')?.textContent || ''}`,
		x,
		y
	);
	
	y += LineBreakPDF.section

	// Average scores
	pdf.setFontSize(FontSizesPDF.largeText);
	y += FontSizesPDF.largeText;
	pdf.text(
		`Average SEO: ${document.getElementById('avgSeo')?.textContent || '-'}`,
		x,
		y
	);
	
	y += FontSizesPDF.largeText;
	pdf.text(
		`Average GEO: ${document.getElementById('avgGeo')?.textContent || '-'}`,
		x,
		y
	);

	y += FontSizesPDF.largeText;
	pdf.text(
		`Velocity Score: ${document.getElementById('avgCombined')?.textContent || '-'}`,
		x,
		y
	);

	y += LineBreakPDF.section

	// Results
	pdf.setFontSize(FontSizesPDF.header);
	y += FontSizesPDF.header;
	pdf.text('Page Results', x, y);
	y += LineBreakPDF.text;

	pdf.setFontSize(FontSizesPDF.smallText);
	y += FontSizesPDF.smallText;
	for (const page of allPages) {
		if (y > 590) {
			console.log("too large:", y)
			pdf.addPage();
			y = 50;
		}

		const pageDesc = (page.title ?? page.url)
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '');
		
		const score = page.scores?.combined ?? 0;
		const text = `${pageDesc} | Score: ${score}`;

		const lines = pdf.splitTextToSize(text, 360);

		pdf.text(lines, x, y);

		y += lines.length * FontSizesPDF.smallText;
	}

	pdf.save("Content-velocity-scanner_Report.pdf")
}

const LineBreakPDF = {
	section: 12,
	text: 6
}

const FontSizesPDF = {
	title: 20,
	header: 16,
	largeText: 14,
	mediumText: 12,
	smallText: 11
}

// ── Download the data as a CSV ────────────────────────────────────────────────
function downloadCSV() {
  if (!allPages.length) {
    alert("No scan results available.");
    return;
  }

  const domain =
    document.getElementById("summaryDomain")?.textContent.trim() ||
    "Unknown domain";

  const pagesScanned =
    document.getElementById("summaryCount")?.textContent.trim() ||
    `${allPages.length} pages scanned`;

  const averageSeo =
    document.getElementById("avgSeo")?.textContent.trim() || "";

  const averageGeo =
    document.getElementById("avgGeo")?.textContent.trim() || "";

  const velocityScore =
    document.getElementById("avgCombined")?.textContent.trim() || "";

  const summaryRows = [
    ["Content Velocity Scan Report"],
    [],
    ["Summary"],
    ["Domain", domain],
    ["Pages scanned", pagesScanned],
    ["Average SEO", averageSeo],
    ["Average GEO", averageGeo],
    ["Velocity Score", velocityScore],
    [],
    ["Pages"],
    ["Title", "URL", "Path", "SEO Score", "GEO Score", "Velocity Score"],
  ];

  const pageRows = allPages.map((page) => [
    page.title || "",
    page.url || "",
    page.slug || "",
    page.scores?.seo ?? "",
    page.scores?.geo ?? "",
    page.scores?.combined ?? "",
  ]);

  const csv = [...summaryRows, ...pageRows]
    .map((row) => row.map((value) => escapeCSVValue(value)).join(","))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  const safeDomain = domain.replace(/^www\./, "").replace(/[^a-z0-9.-]/gi, "-");

  link.href = url;
  link.download = `${safeDomain}-content-velocity-report.csv`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

function escapeCSVValue(value) {
  const stringValue = String(value ?? "");

  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}
