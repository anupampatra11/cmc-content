const SEO_CATEGORIES = new Set(['On-page', 'Technical', 'Content']);

function clamp(v) {
  return Math.max(0.0, Math.min(1.0, v));
}

function band(score) {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Needs work';
  return 'Critical';
}

function calcSeoAiBoost(ai) {
  return Math.round(ai.clarity * 10 + ai.relevance * 8 + ai.authority * 7);
}

function calcObjectiveGeoScore(page) {
  // structuredData (20%)
  const structuredData = page.totalSchemaFields === 0 ? 0.0
    : clamp(page.validSchemaFields / page.totalSchemaFields);

  // citationReadiness (20%)
  const citationReadiness = clamp(
    0.4 * clamp(page.externalLinkCount / 10.0) +
    0.3 * clamp(page.internalLinkCount / 10.0) +
    0.3 * clamp(page.quotationCount / 5.0)
  );

  // factualDensity (20%)
  const factualDensity = page.totalSentences === 0 ? 0.0
    : clamp(page.factualStatementCount / page.totalSentences);

  // contentModularity (15%)
  const chunkScore = page.avgChunkSize === 0 ? 0.0 : clamp(50.0 / page.avgChunkSize);
  const contentModularity = clamp(
    0.4 * clamp(page.headingCount / 10.0) +
    0.3 * clamp(page.listCount / 10.0) +
    0.3 * chunkScore
  );

  // technicalDensity (15%)
  const technicalDensity = page.totalWords === 0 ? 0.0
    : clamp((page.technicalTermCount / page.totalWords) / 0.1);

  // freshness (10%)
  const freshness = page.daysSinceLastUpdate == null ? 0.4
    : page.daysSinceLastUpdate < 30 ? 1.0
    : page.daysSinceLastUpdate < 180 ? 0.7 : 0.4;

  return 0.20 * structuredData +
         0.20 * citationReadiness +
         0.20 * factualDensity +
         0.15 * contentModularity +
         0.15 * technicalDensity +
         0.10 * freshness;
}

function calcSubjectiveGeoScore(ai) {
  return 0.20 * ai.relevance +
         0.15 * ai.authority +
         0.15 * ai.clarity +
         0.15 * (ai.conversationalFit || ai.conversational_fit || 0) +
         0.10 * ai.uniqueness +
         0.10 * ai.engagement +
         0.15 * ai.trustworthiness;
}

function calculate(checks, aiScores, page) {
  // SEO score: rule-based 75% + AI boost 25%
  let seoEarned = 0, seoMax = 0;
  for (const c of checks) {
    if (SEO_CATEGORIES.has(c.category)) {
      seoMax += c.weight;
      if (c.pass) seoEarned += c.weight;
    }
  }
  const seoBase = seoMax > 0 ? Math.round((seoEarned / seoMax) * 75) : 0;
  const seoBoost = aiScores ? calcSeoAiBoost(aiScores) : 10;
  const seo = Math.min(100, seoBase + seoBoost);

  // GEO score: 50% objective + 50% subjective
  const objectiveScore = calcObjectiveGeoScore(page);
  const subjectiveScore = aiScores ? calcSubjectiveGeoScore(aiScores) : 0.5;
  const geo = Math.min(100, Math.max(0, Math.round((0.5 * objectiveScore + 0.5 * subjectiveScore) * 100)));

  const combined = Math.round(seo * 0.5 + geo * 0.5);

  return {
    seo,
    geo,
    combined,
    seoBand: band(seo),
    geoBand: band(geo),
    combinedBand: band(combined),
  };
}

module.exports = { calculate };
