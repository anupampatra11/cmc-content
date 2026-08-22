function safe(s) { return s == null ? '' : s; }
function truncate(s, max) {
  if (!s) return '';
  return s.length <= max ? s : s.substring(0, max) + '\u2026';
}

function check(id, category, label, pass, detail, weight, howToFix, codeExample, currentHtml) {
  const result = { id, category, label, pass, detail, weight };
  if (!pass && howToFix) {
    result.howToFix = howToFix;
    result.codeExample = codeExample || null;
  }
  if (currentHtml) result.currentHtml = currentHtml;
  return result;
}

function buildMissingAltCode(page) {
  if (!page.imagesWithMissingAlt || page.imagesWithMissingAlt.length === 0) {
    return '<!-- No images with missing alt text found -->';
  }
  const imgs = page.imagesWithMissingAlt.slice(0, 5);
  let sb = '<!-- Add alt text to these specific images -->\n\n';
  for (const src of imgs) {
    sb += `<!-- Before -->\n<img src="${src}" />\n\n<!-- After -->\n<img src="${src}" alt="Describe the image here" />\n\n`;
  }
  if (page.imagesWithMissingAlt.length > 5) {
    sb += `<!-- ... and ${page.imagesWithMissingAlt.length - 5} more images -->`;
  }
  return sb.trim();
}

function runChecks(page) {
  const checks = [];

  // 1. Title tag
  const titleLen = safe(page.title).length;
  const titlePass = titleLen >= 30 && titleLen <= 60;
  checks.push(check('title', 'On-page', 'Title tag (30\u201360 chars)', titlePass,
    titleLen === 0 ? 'Missing title tag'
      : titleLen < 30 ? `Too short (${titleLen} chars, min 30)`
      : titleLen > 60 ? `Too long (${titleLen} chars, max 60)`
      : `Good length (${titleLen} chars)`,
    8,
    'Add or update the <title> tag in your <head>. Aim for 30\u201360 characters with your primary keyword near the front.',
    '<head>\n  <title>Running Shoes for Men & Women | ASICS Netherlands</title>\n</head>',
    page.titleHtml || null
  ));

  // 2. Meta description
  const metaLen = safe(page.metaDescription).length;
  const metaPass = metaLen >= 120 && metaLen <= 160;
  checks.push(check('meta', 'On-page', 'Meta description (120\u2013160 chars)', metaPass,
    metaLen === 0 ? 'Missing meta description'
      : metaLen < 120 ? `Too short (${metaLen} chars, min 120)`
      : metaLen > 160 ? `Too long (${metaLen} chars, max 160)`
      : `Good length (${metaLen} chars)`,
    6,
    'Add a <meta name="description"> tag in your <head>. Write a compelling 120\u2013160 character summary including your primary keyword.',
    '<head>\n  <meta name="description" content="Shop ASICS running shoes and sportswear in the Netherlands. Free delivery on orders over 35 euros. Official ASICS webshop with the full collection." />\n</head>',
    page.metaDescHtml || null
  ));

  // 3. Single H1
  const h1Count = page.h1s ? page.h1s.length : 0;
  const h1Pass = h1Count === 1;
  checks.push(check('h1', 'On-page', 'Single H1 tag', h1Pass,
    h1Count === 0 ? 'No H1 found \u2014 critical for SEO'
      : h1Count > 1 ? `Multiple H1s (${h1Count}) \u2014 keep exactly one`
      : `H1 present: "${truncate(page.h1s[0], 60)}"`,
    6,
    h1Count === 0
      ? 'Add exactly one H1 tag describing the page topic. Include your primary keyword.'
      : 'Remove extra H1 tags. Use H2 and H3 for subheadings instead.',
    h1Count === 0
      ? '<h1>Official ASICS Running Shoes & Sportswear | Netherlands</h1>'
      : '<!-- Keep only ONE h1 -->\n<h1>Official ASICS Running Shoes</h1>\n\n<!-- Change extras to h2 -->\n<h2>Men\'s Running Shoes</h2>\n<h2>Women\'s Running Shoes</h2>',
    page.h1Html || null
  ));

  // 4. Heading structure
  const h2Count = page.h2s ? page.h2s.length : 0;
  const headingsPass = h2Count >= 2;
  checks.push(check('headings', 'On-page', 'H2 heading structure', headingsPass,
    h2Count === 0 ? 'No H2 headings \u2014 structure content with subheadings'
      : h2Count === 1 ? 'Only 1 H2 \u2014 add more subheadings for better structure'
      : `${h2Count} H2 headings found`,
    5,
    'Break your content into sections using H2 subheadings. Each major topic should have its own H2.',
    '<h1>Running Shoes Guide</h1>\n<h2>How to Choose the Right Running Shoe</h2>\n<p>Content...</p>\n<h2>Road vs Trail Running Shoes</h2>\n<p>Content...</p>\n<h2>Finding Your Correct Shoe Size</h2>\n<p>Content...</p>',
    page.h2Html || null
  ));

  // 5. Image alt text
  const altsPass = page.imageCount === 0 || page.missingAltCount === 0;
  const altsDetail = page.imageCount === 0 ? 'No images found on this page'
    : page.missingAltCount === 0 ? `All ${page.imageCount} images have alt text`
    : `${page.missingAltCount} of ${page.imageCount} images missing alt text`;
  checks.push(check('alts', 'On-page', 'Image alt text', altsPass, altsDetail, 7,
    'Add descriptive alt attributes to every <img> tag below. Describe what is in the image \u2014 avoid generic text like \'image\' or \'photo\'.',
    buildMissingAltCode(page)
  ));

  // 6. Word count
  const wordPass = page.wordCount >= 300;
  checks.push(check('wordcount', 'Content', 'Content depth (min 300 words)', wordPass,
    wordPass ? `${page.wordCount} words \u2014 good depth` : `Only ${page.wordCount} words \u2014 too thin for good rankings`,
    7,
    'Expand the page content to at least 300 words. Add product descriptions, usage guidance, benefits, or an FAQ section. Thin content ranks poorly and gets ignored by AI engines.',
    '<section>\n  <h2>Why Choose ASICS Running Shoes?</h2>\n  <p>ASICS (Anima Sana In Corpore Sano) has been engineering performance\n  running shoes since 1949. Our GEL technology absorbs shock at impact,\n  reducing joint stress during long runs. Whether training for your first\n  5K or your tenth marathon, there is an ASICS shoe for your goal.</p>\n</section>'
  ));

  // 7. Canonical tag
  const canonicalPass = !!safe(page.canonicalUrl);
  checks.push(check('canonical', 'Technical', 'Canonical tag', canonicalPass,
    canonicalPass ? `Canonical: ${truncate(page.canonicalUrl, 60)}` : 'Missing canonical tag \u2014 risk of duplicate content penalties',
    8,
    'Add a canonical link tag to your <head> pointing to the preferred version of this URL. Prevents duplicate content penalties.',
    '<head>\n  <link rel="canonical" href="https://www.asics.com/nl/nl-nl/" />\n</head>',
    page.canonicalHtml || null
  ));

  // 8. Schema markup
  const schemaCount = page.schemaTypes ? page.schemaTypes.length : 0;
  const schemaPass = schemaCount > 0;
  checks.push(check('schema', 'Technical', 'Schema markup (JSON-LD)', schemaPass,
    schemaPass ? `Found: ${page.schemaTypes.join(', ')}` : 'No JSON-LD schema \u2014 critical for rich results and GEO',
    10,
    'Add a JSON-LD script block to your <head>. Choose the schema type that matches your content: WebSite for homepages, Product for product pages, Article for blog posts.',
    '<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "WebSite",\n  "name": "ASICS Netherlands",\n  "url": "https://www.asics.com/nl/nl-nl/",\n  "description": "Official ASICS running shoes and sportswear for the Netherlands."\n}\n</script>',
    page.schemaHtml || null
  ));

  // 9. Internal links
  const internalPass = page.internalLinkCount >= 2;
  checks.push(check('internal', 'Technical', 'Internal links (min 2)', internalPass,
    internalPass ? `${page.internalLinkCount} internal links` : `Only ${page.internalLinkCount} internal link(s) \u2014 add more for crawlability`,
    7,
    'Add at least 2 contextual internal links to related pages. Use descriptive anchor text that describes the destination \u2014 avoid \'click here\'.',
    '<p>Explore our <a href="/nl/nl-nl/mens-running-shoes/">men\'s running shoes</a>\nor find the perfect <a href="/nl/nl-nl/womens-running-shoes/">women\'s running shoes</a>\nfor your next race.</p>'
  ));

  // 10. URL structure
  const cleanUrl = safe(page.slug).length < 80 && !safe(page.slug).includes('?');
  checks.push(check('url', 'Technical', 'Clean URL structure', cleanUrl,
    cleanUrl ? `Clean URL: ${page.slug}` : 'URL has query parameters or is too long \u2014 use clean, descriptive slugs',
    5,
    'Configure your CMS to use clean keyword-rich slugs without query parameters. Use hyphens between words. Set up 301 redirects from old URLs.',
    '<!-- Bad URL -->\nhttps://example.com/page?id=123&cat=shoes\n\n<!-- Good URL -->\nhttps://www.asics.com/nl/nl-nl/mens-running-shoes/'
  ));

  // 11. Author attribution
  const authorPass = !!safe(page.authorName);
  checks.push(check('author', 'GEO / E-E-A-T', 'Author attribution', authorPass,
    authorPass ? `Author: ${page.authorName}` : 'No author field \u2014 critical for E-E-A-T and AI engine citability',
    8,
    'Add author metadata to your page. For article and blog content, name the author with their credentials. This is one of the strongest E-E-A-T signals and tells AI engines the content is trustworthy.',
    '<!-- 1. Meta author tag -->\n<meta name="author" content="Dr. Sarah van den Berg, Sports Physiotherapist" />\n\n<!-- 2. JSON-LD Article author -->\n<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "Article",\n  "author": {\n    "@type": "Person",\n    "name": "Dr. Sarah van den Berg",\n    "jobTitle": "Sports Physiotherapist",\n    "url": "https://www.asics.com/nl/nl-nl/authors/sarah-van-den-berg/"\n  }\n}\n</script>\n\n<!-- 3. Visible byline -->\n<div class="author-byline">\n  <a href="/authors/sarah-van-den-berg">Dr. Sarah van den Berg</a>\n  <span>Sports Physiotherapist</span>\n</div>',
    page.authorMetaHtml || null
  ));

  // 12. Publish / update date
  const hasDate = !!safe(page.datePublished) || !!safe(page.dateModified);
  checks.push(check('date', 'GEO / E-E-A-T', 'Publish / update date', hasDate,
    hasDate
      ? `Published: ${safe(page.datePublished)}${safe(page.dateModified) ? ` | Modified: ${page.dateModified}` : ''}`
      : 'No publish date \u2014 AI engines deprioritise undated content',
    7,
    'Add publish and last-modified dates to your page metadata and JSON-LD. AI engines use freshness as a trust signal \u2014 undated content is often skipped.',
    '<!-- Open Graph date tags -->\n<meta property="article:published_time" content="2025-01-15T09:00:00+01:00" />\n<meta property="article:modified_time" content="2025-05-10T14:30:00+01:00" />\n\n<!-- JSON-LD dates -->\n<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "Article",\n  "datePublished": "2025-01-15",\n  "dateModified": "2025-05-10"\n}\n</script>\n\n<!-- Visible date -->\n<time datetime="2025-05-10">Last updated: 10 May 2025</time>',
    page.dateMetaHtml || null
  ));

  // 13. FAQ schema
  const hasFaq = page.schemaTypes && page.schemaTypes.some(s => s.toLowerCase().includes('faq'));
  checks.push(check('faq', 'GEO', 'FAQ schema (FAQPage)', hasFaq,
    hasFaq ? 'FAQPage schema found \u2014 excellent GEO signal' : 'No FAQ schema \u2014 adding Q&A markup significantly boosts AI citability',
    8,
    'Add a FAQPage JSON-LD block to pages that contain questions and answers. This is the single highest-impact GEO fix \u2014 AI engines directly cite FAQ content in their answers.',
    '<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "FAQPage",\n  "mainEntity": [\n    {\n      "@type": "Question",\n      "name": "What is the best ASICS shoe for beginners?",\n      "acceptedAnswer": {\n        "@type": "Answer",\n        "text": "The ASICS Gel-Nimbus is our top recommendation for beginners. It offers maximum cushioning and GEL technology that absorbs shock on road surfaces."\n      }\n    },\n    {\n      "@type": "Question",\n      "name": "How do I find my correct running shoe size?",\n      "acceptedAnswer": {\n        "@type": "Answer",\n        "text": "Measure your foot length in centimetres and add 1cm for toe clearance. Visit an ASICS store for a free gait analysis and professional fitting."\n      }\n    }\n  ]\n}\n</script>'
  ));

  return checks;
}

module.exports = { runChecks };
