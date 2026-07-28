const fs = require('fs');
const path = require('path');
const axios = require('axios');
const config = require('../config');

const systemPrompt = (() => {
  const promptPath = path.join(__dirname, '..', '..', 'geo-rules-prompt.txt');
  try {
    return fs.readFileSync(promptPath, 'utf8');
  } catch {
    console.warn('geo-rules-prompt.txt not found; using fallback prompt');
    return 'Analyze the content and return ONLY valid JSON with objective and subjective GEO metrics.';
  }
})();

function buildPrompt(page) {
  const safe = s => s || '';
  return systemPrompt + '\n\n---\nINPUT CONTENT:\n\n' +
    `URL: ${page.url}\n` +
    `Title: ${safe(page.title)}\n` +
    `Meta description: ${safe(page.metaDescription) || 'MISSING'}\n` +
    `Author: ${safe(page.authorName) || 'MISSING'}\n` +
    `Schema types: ${(!page.schemaTypes || page.schemaTypes.length === 0) ? 'NONE' : page.schemaTypes.join(', ')}\n` +
    `Body text:\n${safe(page.bodyText)}`;
}

async function analyse(page) {
  const prompt = buildPrompt(page);

  const requestBody = {
    model: config.anthropic.model,
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  };

  try {
    const response = await axios.post(config.anthropic.apiUrl, requestBody, {
      headers: {
        'x-api-key': config.anthropic.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      timeout: 60000,
    });

    const content = response.data?.content;
    if (!content || content.length === 0) return null;

    let text = content[0]?.text || '';
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    text = text.substring(start, end + 1);

    const parsed = JSON.parse(text);

    // Navigate to subjective node; fall back to root if missing
    const subjectiveNode = parsed.subjective || parsed;

    const scores = {
      relevance: subjectiveNode.relevance || 0,
      authority: subjectiveNode.authority || 0,
      clarity: subjectiveNode.clarity || 0,
      conversationalFit: subjectiveNode.conversational_fit || subjectiveNode.conversationalFit || 0,
      uniqueness: subjectiveNode.uniqueness || 0,
      engagement: subjectiveNode.engagement || 0,
      trustworthiness: subjectiveNode.trustworthiness || 0,
      topSuggestions: Array.isArray(parsed.top_suggestions) ? parsed.top_suggestions : [],
      geoSummary: parsed.geo_summary || '',
    };

    return scores;
  } catch (err) {
    console.warn(`AI analysis failed for ${page.url}: ${err.message}`);
    return null;
  }
}

module.exports = { analyse };
