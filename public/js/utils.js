// ── Score helpers ─────────────────────────────────────────────────────────────
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

// ── UI state helpers ──────────────────────────────────────────────────────────
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

// ── Download dropdown ─────────────────────────────────────────────────────────
function openDropdown() {
	document.getElementById("dropdown-download").classList.toggle("show-dropdown-options");
}

window.onclick = function (event) {
	if (!event.target.matches('.dropdown-btn')) {
		const dropdowns = document.getElementsByClassName("dropdown-content");
		for (const element of dropdowns) {
			if (element.classList.contains("show-dropdown-options")) {
				element.classList.remove("show-dropdown-options");
			}
		}
	}
};

// ── Enter key on input ────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
	document.getElementById("urlInput").addEventListener("keydown", (e) => {
		if (e.key === "Enter") startScan();
	});
});
