const { v4: uuidv4 } = require('uuid');
const sitemapService = require('./sitemapService');
const crawlerService = require('./crawlerService');
const seoRuleEngine = require('./seoRuleEngine');
const anthropicService = require('./anthropicService');
const openaiService = require('./openaiService');
const scoreCalculator = require('./scoreCalculator');

const STOP_WORDS = new Set(['the','a','an','and','or','to','of','in','for','is','it','this','that','with','as','by','on','at','be','are','was','were','have','has','your','you','can','will','use']);

function extractKeywords(str) {
  return new Set(
    str.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !STOP_WORDS.has(w))
  );
}

function jaccardSimilarity(a, b) {
  const ka = extractKeywords(a);
  const kb = extractKeywords(b);
  const intersection = [...ka].filter(w => kb.has(w)).length;
  const union = new Set([...ka, ...kb]).size;
  return union > 0 ? intersection / union : 0;
}

function mergeSuggestions(claudeSuggestions, openaiSuggestions) {
  const highPriority = [];
  const claudeOnly = [];
  const openaiMatched = new Set();

  for (const cs of claudeSuggestions) {
    let bestScore = 0;
    let bestOiIdx = -1;

    openaiSuggestions.forEach((os, idx) => {
      if (openaiMatched.has(idx)) return;
      const score = jaccardSimilarity(cs.text || cs, os.text || os);
      if (score > bestScore) { bestScore = score; bestOiIdx = idx; }
    });

    if (bestScore >= 0.25 && bestOiIdx >= 0) {
      highPriority.push({ claude: cs, openai: openaiSuggestions[bestOiIdx] });
      openaiMatched.add(bestOiIdx);
    } else {
      claudeOnly.push(cs);
    }
  }

  const openaiOnly = openaiSuggestions.filter((_, idx) => !openaiMatched.has(idx));
  return { highPriority, claudeOnly, openaiOnly };
}

function mergeAiScores(claude, openai) {
  if (!claude && !openai) return null;

  const avg = (a, b, field) => {
    if (a && b) return (a[field] + b[field]) / 2;
    return (a || b)[field];
  };

  const claudeSugg = claude?.topSuggestions || [];
  const openaiSugg = openai?.topSuggestions || [];
  const merged = (claude && openai)
    ? mergeSuggestions(claudeSugg, openaiSugg)
    : { highPriority: [], claudeOnly: claudeSugg, openaiOnly: openaiSugg };

  return {
    relevance: avg(claude, openai, 'relevance'),
    authority: avg(claude, openai, 'authority'),
    clarity: avg(claude, openai, 'clarity'),
    conversationalFit: avg(claude, openai, 'conversationalFit'),
    uniqueness: avg(claude, openai, 'uniqueness'),
    engagement: avg(claude, openai, 'engagement'),
    trustworthiness: avg(claude, openai, 'trustworthiness'),
    geoSummary: claude?.geoSummary || openai?.geoSummary || '',
    claude: claude || null,
    openai: openai || null,
    highPriority: merged.highPriority,
    claudeOnly: merged.claudeOnly,
    openaiOnly: merged.openaiOnly,
  };
}

const scanStore = new Map();

function generateScanId() {
  return uuidv4().replace(/-/g, '').substring(0, 12);
}

function extractPath(url) {
  try { return new URL(url).pathname; } catch { return url; }
}

function updateAverages(result) {
  const completed = result.pages.filter(p => p.scores);
  if (completed.length === 0) return;
  result.avgSeo = Math.round(completed.reduce((s, p) => s + p.scores.seo, 0) / completed.length);
  result.avgGeo = Math.round(completed.reduce((s, p) => s + p.scores.geo, 0) / completed.length);
  result.avgCombined = Math.round(completed.reduce((s, p) => s + p.scores.combined, 0) / completed.length);
}

async function scanPage(url) {
  const audit = { url, status: 'pending', title: null, slug: null, checks: [], scores: null, aiScores: null, errorMessage: null };

  try {
    const data = await crawlerService.crawl(url);
    audit.title = data.title;
    audit.slug = data.slug;

    const checks = seoRuleEngine.runChecks(data);
    audit.checks = checks;

    const [claudeResult, openaiResult] = await Promise.allSettled([
      anthropicService.analyse(data),
      openaiService.analyse(data),
    ]);
    const claudeScores = claudeResult.status === 'fulfilled' ? claudeResult.value : null;
    const openaiScores = openaiResult.status === 'fulfilled' ? openaiResult.value : null;
    const aiScores = mergeAiScores(claudeScores, openaiScores);
    audit.aiScores = aiScores;

    audit.scores = scoreCalculator.calculate(checks, aiScores, data);
    audit.status = 'complete';
  } catch (err) {
    console.warn(`Failed to scan page ${url}: ${err.message}`);
    audit.status = 'error';
    audit.errorMessage = err.message;
    audit.title = extractPath(url);
    audit.slug = extractPath(url);
    audit.checks = [];
    audit.scores = { seo: 0, geo: 0, combined: 0, seoBand: 'Critical', geoBand: 'Critical', combinedBand: 'Critical' };
  }

  return audit;
}

async function runScanAsync(scanId, url) {
  const result = scanStore.get(scanId);
  try {
    result.progressLabel = 'Fetching sitemap\u2026';
    const urls = await sitemapService.discoverUrls(url);
    result.totalPages = urls.length;
    result.progressLabel = `Found ${urls.length} pages \u2014 scanning\u2026`;

    for (let i = 0; i < urls.length; i++) {
      const pageUrl = urls[i];
      result.progressLabel = `Scanning ${extractPath(pageUrl)} (${i + 1}/${urls.length})`;

      const audit = await scanPage(pageUrl);
      result.pages.push(audit);
      result.scannedPages = result.pages.length;
      updateAverages(result);
    }

    result.status = 'complete';
    result.progressLabel = `Scan complete \u2014 ${urls.length} pages analysed`;
    updateAverages(result);
  } catch (err) {
    console.error(`Scan failed for ${url}: ${err.message}`);
    result.status = 'error';
    result.errorMessage = `Scan failed: ${err.message}`;
    result.progressLabel = 'Scan failed';
  }
}

function startScan(url) {
  const scanId = generateScanId();

  const result = {
    id: scanId,
    status: 'running',
    targetUrl: url,
    totalPages: 0,
    scannedPages: 0,
    pages: [],
    progressLabel: 'Starting scan\u2026',
    avgSeo: 0,
    avgGeo: 0,
    avgCombined: 0,
    errorMessage: null,
  };

  scanStore.set(scanId, result);

  // Run async without blocking — fire and forget
  setImmediate(() => runScanAsync(scanId, url));

  return scanId;
}

function getResult(scanId) {
  return scanStore.get(scanId) || null;
}

module.exports = { startScan, getResult };
