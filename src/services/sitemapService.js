const axios = require('axios');
const xml2js = require('xml2js');
const config = require('../config');

function normalise(url) {
  try {
    const u = new URL(url.trim().startsWith('http') ? url.trim() : 'https://' + url.trim());
    let result = `${u.protocol}//${u.hostname}`;
    if (u.port && u.port !== '80' && u.port !== '443') result += `:${u.port}`;
    return result;
  } catch {
    return url.trim().replace(/\/$/, '');
  }
}

async function tryFetchSitemap(sitemapUrl, maxPages) {
  const urls = [];
  try {
    const response = await axios.get(sitemapUrl, {
      timeout: config.scanner.connectTimeoutMs,
      headers: { 'User-Agent': config.scanner.userAgent },
      responseType: 'text',
    });

    const parsed = await xml2js.parseStringPromise(response.data, { explicitArray: false });

    // Handle sitemap index
    const sitemapIndex = parsed.sitemapindex;
    if (sitemapIndex && sitemapIndex.sitemap) {
      const sitemaps = Array.isArray(sitemapIndex.sitemap)
        ? sitemapIndex.sitemap : [sitemapIndex.sitemap];
      for (const s of sitemaps) {
        if (urls.length >= maxPages) break;
        const childUrls = await tryFetchSitemap(s.loc, maxPages);
        urls.push(...childUrls);
      }
      return urls;
    }

    // Handle regular sitemap
    const urlset = parsed.urlset;
    if (urlset && urlset.url) {
      const entries = Array.isArray(urlset.url) ? urlset.url : [urlset.url];
      for (const entry of entries) {
        if (urls.length >= maxPages) break;
        const loc = typeof entry.loc === 'string' ? entry.loc : (entry.loc?._ || '');
        if (loc && !urls.includes(loc)) urls.push(loc);
      }
    }
  } catch (err) {
    console.debug(`Could not fetch sitemap at ${sitemapUrl}: ${err.message}`);
  }
  return urls;
}

async function discoverUrls(baseUrl) {
  const normalised = normalise(baseUrl);
  const maxPages = config.scanner.maxPages;

  let urls = await tryFetchSitemap(`${normalised}/sitemap.xml`, maxPages);
  if (urls.length > 0) {
    console.log(`Found ${urls.length} URLs in sitemap.xml`);
    return urls.slice(0, maxPages);
  }

  urls = await tryFetchSitemap(`${normalised}/sitemap_index.xml`, maxPages);
  if (urls.length > 0) {
    console.log(`Found ${urls.length} URLs in sitemap_index.xml`);
    return urls.slice(0, maxPages);
  }

  console.log(`No sitemap found, falling back to homepage only: ${normalised}`);
  return [`${normalised}/`];
}

module.exports = { discoverUrls };
