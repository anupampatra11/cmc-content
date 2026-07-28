const axios = require('axios');
const cheerio = require('cheerio');
const config = require('../config');

const SCHEMA_EXPECTED_FIELDS = {
  Article: 8, BlogPosting: 8, NewsArticle: 8,
  Product: 9, FAQPage: 4, WebSite: 5,
  WebPage: 5, Organization: 6, LocalBusiness: 7,
  Person: 5,
};

const FACTUAL_PATTERN = /\d+([,.]\d+)?(%|\s*(percent|million|billion|thousand))?|\b(according to|research|study|studies|report|survey|data|statistics|found that)\b/gi;
const TECHNICAL_TERM_PATTERN = /\b[A-Z][a-zA-Z0-9]*(?:[\s-][A-Z][a-zA-Z0-9]*){0,2}\b/g;

async function crawl(url) {
  const parsedUrl = new URL(url);
  const baseDomain = parsedUrl.hostname;
  const slug = parsedUrl.pathname;

  const response = await axios.get(url, {
    timeout: config.scanner.connectTimeoutMs,
    headers: {
      'User-Agent': config.scanner.userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
    },
    maxRedirects: 5,
  });

  const $ = cheerio.load(response.data);

  // Title
  const title = $('title').first().text().trim();

  // Meta description
  const metaDesc = $('meta[name="description"]').attr('content') ||
    $('meta[property="og:description"]').attr('content') || '';

  // Headings
  const h1s = $('h1').map((_, el) => $(el).text().trim()).get().filter(Boolean);
  const h2s = $('h2').map((_, el) => $(el).text().trim()).get().filter(Boolean);

  // Images
  const images = $('img');
  const imageCount = images.length;
  const imagesWithMissingAlt = [];
  images.each((_, el) => {
    const alt = $(el).attr('alt') || '';
    if (!alt.trim()) {
      const src = $(el).attr('src') || '';
      if (src) imagesWithMissingAlt.push(src);
    }
  });
  const missingAltCount = imagesWithMissingAlt.length;

  // Canonical
  const canonicalUrl = $('link[rel="canonical"]').attr('href') || '';

  // Internal and external links
  let internalLinkCount = 0, externalLinkCount = 0;
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (!href || href.startsWith('#') || href.startsWith('mailto:') ||
        href.startsWith('tel:') || href.startsWith('javascript:')) return;
    try {
      const absolute = href.startsWith('http') ? href : new URL(href, url).href;
      const linkDomain = new URL(absolute).hostname;
      if (linkDomain === baseDomain) internalLinkCount++;
      else externalLinkCount++;
    } catch {
      // skip malformed
    }
  });

  // Schema types
  const schemaTypes = extractSchemaTypes($);

  // Schema field counts
  const { validSchemaFields, totalSchemaFields } = extractSchemaFieldCounts($);

  // Author
  const authorName = extractAuthor($);

  // Dates
  const datePublished = extractMeta($, ['article:published_time', 'datePublished']);
  const dateModified = extractMeta($, ['article:modified_time', 'dateModified']);
  const daysSinceLastUpdate = computeDaysSinceUpdate(dateModified, datePublished);

  // Remove nav/header/footer/script/style before body text extraction
  $('nav, footer, script, style, header').remove();

  const headingCount = $('h1, h2, h3, h4, h5, h6').length;
  const listCount = $('ul, ol').length;

  const bodyText = $('main, article, .content, #content, body').first().text() ||
    $('body').text();

  const quotationCount = $('blockquote').length + countInlineQuotes(bodyText);

  const totalWords = countMeaningfulWords(bodyText);
  const wordCount = totalWords;
  const totalSentences = countSentences(bodyText);
  const factualStatementCount = countFactualStatements(bodyText);
  const avgChunkSize = headingCount > 0 ? totalWords / headingCount : totalWords;
  const technicalTermCount = countTechnicalTerms(bodyText);

  console.log(`Crawled: ${url} | words: ${wordCount} | schema: ${JSON.stringify(schemaTypes)}`);

  return {
    url, slug, title, metaDescription: metaDesc, h1s, h2s,
    imageCount, missingAltCount, imagesWithMissingAlt,
    canonicalUrl, internalLinkCount, externalLinkCount,
    schemaTypes, validSchemaFields, totalSchemaFields,
    authorName, datePublished, dateModified, daysSinceLastUpdate,
    wordCount, totalWords, totalSentences, factualStatementCount,
    quotationCount, headingCount, listCount, avgChunkSize, technicalTermCount,
    baseDomain,
    bodyText: bodyText.length > 2000 ? bodyText.substring(0, 2000) : bodyText,
  };
}

function extractSchemaTypes($) {
  const types = [];
  const typePattern = /"@type"\s*:\s*"([^"]+)"/g;
  $('script[type="application/ld+json"]').each((_, el) => {
    const html = $(el).html() || '';
    let m;
    while ((m = typePattern.exec(html)) !== null) {
      if (!types.includes(m[1])) types.push(m[1]);
    }
    typePattern.lastIndex = 0;
  });
  return types;
}

function extractSchemaFieldCounts($) {
  let validSchemaFields = 0, totalSchemaFields = 0;
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const root = JSON.parse($(el).html() || '{}');
      const schemas = root['@graph'] && Array.isArray(root['@graph'])
        ? root['@graph'] : [root];
      for (const schema of schemas) {
        const type = schema['@type'] || '';
        totalSchemaFields += SCHEMA_EXPECTED_FIELDS[type] || 5;
        validSchemaFields += countNonEmptySchemaFields(schema, new Set());
      }
    } catch { /* ignore invalid JSON */ }
  });
  return { validSchemaFields, totalSchemaFields };
}

function countNonEmptySchemaFields(node, counted) {
  if (typeof node !== 'object' || node === null) return 0;
  let count = 0;
  for (const [key, val] of Object.entries(node)) {
    if (key.startsWith('@')) continue;
    if (counted.has(key)) continue;
    if (val === null || val === undefined || val === '') continue;
    counted.add(key);
    count++;
    if (typeof val === 'object') count += countNonEmptySchemaFields(val, counted);
  }
  return count;
}

function extractAuthor($) {
  const authorAttrs = ['author', 'article:author', 'og:article:author', 'twitter:creator', 'DC.creator'];
  for (const attr of authorAttrs) {
    const content = $(`meta[name="${attr}"]`).attr('content') ||
                    $(`meta[property="${attr}"]`).attr('content');
    if (content && content.trim()) return content.trim();
  }

  // Try JSON-LD
  const authorPattern = /"author"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/;
  let authorFound = '';
  $('script[type="application/ld+json"]').each((_, el) => {
    if (authorFound) return;
    const m = authorPattern.exec($(el).html() || '');
    if (m) authorFound = m[1];
  });
  if (authorFound) return authorFound;

  // Try selectors
  const authorEl = $('[rel="author"], .author-name, .byline, [itemprop="author"]').first();
  if (authorEl.length) {
    const text = authorEl.text().trim();
    if (text) return text;
  }

  return '';
}

function extractMeta($, names) {
  for (const name of names) {
    const el = $(`meta[property="${name}"]`).first() ||
               $(`meta[name="${name}"]`).first();
    const content = el.attr('content') || '';
    if (content) return content;

    const timeEl = $(`time[itemprop="${name}"]`).first();
    const datetime = timeEl.attr('datetime') || timeEl.attr('content') || '';
    if (datetime) return datetime;
  }
  // Try JSON-LD
  const key = names[names.length - 1];
  const p = new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`);
  let found = '';
  $('script[type="application/ld+json"]').each((_, el) => {
    if (found) return;
    const m = p.exec($(el).html() || '');
    if (m) found = m[1];
  });
  return found;
}

function computeDaysSinceUpdate(dateModified, datePublished) {
  const dateStr = (dateModified && dateModified.trim()) ? dateModified : datePublished;
  if (!dateStr || dateStr.length < 10) return null;
  try {
    const date = new Date(dateStr.substring(0, 10));
    if (isNaN(date.getTime())) return null;
    const now = new Date();
    return Math.floor((now - date) / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

function countInlineQuotes(text) {
  if (!text) return 0;
  const matches = text.match(/"[^"]{3,}"/g);
  return matches ? matches.length : 0;
}

function countMeaningfulWords(text) {
  if (!text) return 0;
  return text.split(/\s+/).filter(t => t.replace(/[^a-zA-Z]/g, '').length > 0).length;
}

function countSentences(text) {
  if (!text) return 0;
  return text.split(/[.?!]+/).filter(s => s.trim().split(/\s+/).length >= 3).length;
}

function countFactualStatements(text) {
  if (!text) return 0;
  let count = 0;
  for (const s of text.split(/[.?!]+/)) {
    const trimmed = s.trim();
    if (trimmed.split(/\s+/).length < 3) continue;
    FACTUAL_PATTERN.lastIndex = 0;
    if (FACTUAL_PATTERN.test(trimmed)) count++;
  }
  return count;
}

function countTechnicalTerms(text) {
  if (!text) return 0;
  const seen = new Set();
  let m;
  const re = new RegExp(TECHNICAL_TERM_PATTERN.source, 'g');
  while ((m = re.exec(text)) !== null) {
    const term = m[0].trim();
    if (term.length > 3) seen.add(term.toLowerCase());
  }
  return seen.size;
}

module.exports = { crawl };
