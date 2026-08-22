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
		allPages = data.pages || [];
		updateAverages(data);
	}
}
