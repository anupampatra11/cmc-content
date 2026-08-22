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

function buildUserMessage(page) {
  const safe = s => s || '';
  return 'INPUT CONTENT:\n\n' +
    `URL: ${page.url}\n` +
    `Title: ${safe(page.title)}\n` +
    `Meta description: ${safe(page.metaDescription) || 'MISSING'}\n` +
    `Author: ${safe(page.authorName) || 'MISSING'}\n` +
    `Schema types: ${(!page.schemaTypes || page.schemaTypes.length === 0) ? 'NONE' : page.schemaTypes.join(', ')}\n` +
    `Body text:\n${safe(page.bodyText)}`;
}

async function analyse(page) {
  if (!config.openai.apiKey) {
    console.warn('OpenAI: no API key configured, skipping');
    return null;
  }
  console.log(`OpenAI: analysing ${page.url} with model ${config.openai.model}`);

  const requestBody = {
    model: config.openai.model,
    max_tokens: 2048,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: buildUserMessage(page) },
    ],
  };

  try {
    const response = await axios.post(config.openai.apiUrl, requestBody, {
      headers: {
        'Authorization': `Bearer ${config.openai.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    });

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) return null;

    let text = content.replace(/```json/g, '').replace(/```/g, '').trim();

    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    text = text.substring(start, end + 1);

    const parsed = JSON.parse(text);
    const subjectiveNode = parsed.subjective || parsed;

    return {
      relevance: subjectiveNode.relevance || 0,
      authority: subjectiveNode.authority || 0,
      clarity: subjectiveNode.clarity || 0,
      conversationalFit: subjectiveNode.conversational_fit || subjectiveNode.conversationalFit || 0,
      uniqueness: subjectiveNode.uniqueness || 0,
      engagement: subjectiveNode.engagement || 0,
      trustworthiness: subjectiveNode.trustworthiness || 0,
      topSuggestions: Array.isArray(parsed.top_suggestions)
        ? parsed.top_suggestions.map(s => typeof s === 'string' ? { text: s } : s)
        : [],
      geoSummary: parsed.geo_summary || '',
    };
  } catch (err) {
    const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    console.warn(`OpenAI analysis failed for ${page.url}: ${detail}`);
    return null;
  }
}

module.exports = { analyse };
