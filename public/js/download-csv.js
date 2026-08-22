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
    return `"${stringValue.replaceAll('"', '""')}"`;
  }

  return stringValue;
}
