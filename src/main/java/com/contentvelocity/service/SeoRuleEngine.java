package com.contentvelocity.service;

import com.contentvelocity.model.AuditCheck;
import com.contentvelocity.model.PageData;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class SeoRuleEngine {

    public List<AuditCheck> runChecks(PageData page) {
        List<AuditCheck> checks = new ArrayList<>();

        // 1. Title tag
        int titleLen = safe(page.title).length();
        boolean titlePass = titleLen >= 30 && titleLen <= 60;
        checks.add(new AuditCheck("title", "On-page", "Title tag (30–60 chars)", titlePass,
            titleLen == 0 ? "Missing title tag" :
            titleLen < 30 ? "Too short (" + titleLen + " chars, min 30)" :
            titleLen > 60 ? "Too long (" + titleLen + " chars, max 60)" :
            "Good length (" + titleLen + " chars)", 8)
            .withFix(!titlePass,
                "Add or update the <title> tag in your <head>. Aim for 30–60 characters with your primary keyword near the front.",
                "<head>\n  <title>Running Shoes for Men & Women | ASICS Netherlands</title>\n</head>"));

        // 2. Meta description
        int metaLen = safe(page.metaDescription).length();
        boolean metaPass = metaLen >= 120 && metaLen <= 160;
        checks.add(new AuditCheck("meta", "On-page", "Meta description (120–160 chars)", metaPass,
            metaLen == 0 ? "Missing meta description" :
            metaLen < 120 ? "Too short (" + metaLen + " chars, min 120)" :
            metaLen > 160 ? "Too long (" + metaLen + " chars, max 160)" :
            "Good length (" + metaLen + " chars)", 6)
            .withFix(!metaPass,
                "Add a <meta name=\"description\"> tag in your <head>. Write a compelling 120–160 character summary including your primary keyword.",
                "<head>\n  <meta name=\"description\" content=\"Shop ASICS running shoes and sportswear in the Netherlands. Free delivery on orders over 35 euros. Official ASICS webshop with the full collection.\" />\n</head>"));

        // 3. Single H1
        int h1Count = page.h1s == null ? 0 : page.h1s.size();
        boolean h1Pass = h1Count == 1;
        checks.add(new AuditCheck("h1", "On-page", "Single H1 tag", h1Pass,
            h1Count == 0 ? "No H1 found — critical for SEO" :
            h1Count > 1 ? "Multiple H1s (" + h1Count + ") — keep exactly one" :
            "H1 present: \"" + truncate(page.h1s.get(0), 60) + "\"", 6)
            .withFix(!h1Pass,
                h1Count == 0 ? "Add exactly one H1 tag describing the page topic. Include your primary keyword." :
                               "Remove extra H1 tags. Use H2 and H3 for subheadings instead.",
                h1Count == 0 ? "<h1>Official ASICS Running Shoes & Sportswear | Netherlands</h1>" :
                               "<!-- Keep only ONE h1 -->\n<h1>Official ASICS Running Shoes</h1>\n\n<!-- Change extras to h2 -->\n<h2>Men's Running Shoes</h2>\n<h2>Women's Running Shoes</h2>"));

        // 4. Heading structure
        int h2Count = page.h2s == null ? 0 : page.h2s.size();
        boolean headingsPass = h2Count >= 2;
        checks.add(new AuditCheck("headings", "On-page", "H2 heading structure", headingsPass,
            h2Count == 0 ? "No H2 headings — structure content with subheadings" :
            h2Count == 1 ? "Only 1 H2 — add more subheadings for better structure" :
            h2Count + " H2 headings found", 5)
            .withFix(!headingsPass,
                "Break your content into sections using H2 subheadings. Each major topic should have its own H2.",
                "<h1>Running Shoes Guide</h1>\n<h2>How to Choose the Right Running Shoe</h2>\n<p>Content...</p>\n<h2>Road vs Trail Running Shoes</h2>\n<p>Content...</p>\n<h2>Finding Your Correct Shoe Size</h2>\n<p>Content...</p>"));

        // 5. Image alt text
        boolean altsPass = page.imageCount == 0 || page.missingAltCount == 0;
        checks.add(new AuditCheck("alts", "On-page", "Image alt text", altsPass,
            page.imageCount == 0 ? "No images found on this page" :
            page.missingAltCount == 0 ? "All " + page.imageCount + " images have alt text" :
            page.missingAltCount + " of " + page.imageCount + " images missing alt text", 7)
            .withFix(!altsPass,
                "Add descriptive alt attributes to every <img> tag. Describe what is in the image specifically — avoid generic text like 'image' or 'photo'.",
                "<!-- Before (missing alt) -->\n<img src=\"/gel-nimbus.jpg\" />\n\n<!-- After (descriptive alt) -->\n<img src=\"/gel-nimbus.jpg\" alt=\"ASICS Gel-Nimbus 25 men's road running shoe in blue and white\" />"));

        // 6. Word count
        boolean wordPass = page.wordCount >= 300;
        checks.add(new AuditCheck("wordcount", "Content", "Content depth (min 300 words)", wordPass,
            wordPass ? page.wordCount + " words — good depth" :
            "Only " + page.wordCount + " words — too thin for good rankings", 7)
            .withFix(!wordPass,
                "Expand the page content to at least 300 words. Add product descriptions, usage guidance, benefits, or an FAQ section. Thin content ranks poorly and gets ignored by AI engines.",
                "<section>\n  <h2>Why Choose ASICS Running Shoes?</h2>\n  <p>ASICS (Anima Sana In Corpore Sano) has been engineering performance\n  running shoes since 1949. Our GEL technology absorbs shock at impact,\n  reducing joint stress during long runs. Whether training for your first\n  5K or your tenth marathon, there is an ASICS shoe for your goal.</p>\n</section>"));

        // 7. Canonical tag
        boolean canonicalPass = !safe(page.canonicalUrl).isEmpty();
        checks.add(new AuditCheck("canonical", "Technical", "Canonical tag", canonicalPass,
            canonicalPass ? "Canonical: " + truncate(page.canonicalUrl, 60) :
            "Missing canonical tag — risk of duplicate content penalties", 8)
            .withFix(!canonicalPass,
                "Add a canonical link tag to your <head> pointing to the preferred version of this URL. Prevents duplicate content penalties.",
                "<head>\n  <link rel=\"canonical\" href=\"https://www.asics.com/nl/nl-nl/\" />\n</head>"));

        // 8. Schema markup
        int schemaCount = page.schemaTypes == null ? 0 : page.schemaTypes.size();
        boolean schemaPass = schemaCount > 0;
        checks.add(new AuditCheck("schema", "Technical", "Schema markup (JSON-LD)", schemaPass,
            schemaPass ? "Found: " + String.join(", ", page.schemaTypes) :
            "No JSON-LD schema — critical for rich results and GEO", 10)
            .withFix(!schemaPass,
                "Add a JSON-LD script block to your <head>. Choose the schema type that matches your content: WebSite for homepages, Product for product pages, Article for blog posts.",
                "<script type=\"application/ld+json\">\n{\n  \"@context\": \"https://schema.org\",\n  \"@type\": \"WebSite\",\n  \"name\": \"ASICS Netherlands\",\n  \"url\": \"https://www.asics.com/nl/nl-nl/\",\n  \"description\": \"Official ASICS running shoes and sportswear for the Netherlands.\"\n}\n</script>"));

        // 9. Internal links
        boolean internalPass = page.internalLinkCount >= 2;
        checks.add(new AuditCheck("internal", "Technical", "Internal links (min 2)", internalPass,
            internalPass ? page.internalLinkCount + " internal links" :
            "Only " + page.internalLinkCount + " internal link(s) — add more for crawlability", 7)
            .withFix(!internalPass,
                "Add at least 2 contextual internal links to related pages. Use descriptive anchor text that describes the destination — avoid 'click here'.",
                "<p>Explore our <a href=\"/nl/nl-nl/mens-running-shoes/\">men's running shoes</a>\nor find the perfect <a href=\"/nl/nl-nl/womens-running-shoes/\">women's running shoes</a>\nfor your next race.</p>"));

        // 10. URL structure
        boolean cleanUrl = safe(page.slug).length() < 80 && !safe(page.slug).contains("?");
        checks.add(new AuditCheck("url", "Technical", "Clean URL structure", cleanUrl,
            cleanUrl ? "Clean URL: " + page.slug :
            "URL has query parameters or is too long — use clean, descriptive slugs", 5)
            .withFix(!cleanUrl,
                "Configure your CMS to use clean keyword-rich slugs without query parameters. Use hyphens between words. Set up 301 redirects from old URLs.",
                "<!-- Bad URL -->\nhttps://example.com/page?id=123&cat=shoes\n\n<!-- Good URL -->\nhttps://www.asics.com/nl/nl-nl/mens-running-shoes/"));

        // 11. Author attribution
        boolean authorPass = !safe(page.authorName).isEmpty();
        checks.add(new AuditCheck("author", "GEO / E-E-A-T", "Author attribution", authorPass,
            authorPass ? "Author: " + page.authorName :
            "No author field — critical for E-E-A-T and AI engine citability", 8)
            .withFix(!authorPass,
                "Add author metadata to your page. For article and blog content, name the author with their credentials. This is one of the strongest E-E-A-T signals and tells AI engines the content is trustworthy.",
                "<!-- 1. Meta author tag -->\n<meta name=\"author\" content=\"Dr. Sarah van den Berg, Sports Physiotherapist\" />\n\n<!-- 2. JSON-LD Article author -->\n<script type=\"application/ld+json\">\n{\n  \"@context\": \"https://schema.org\",\n  \"@type\": \"Article\",\n  \"author\": {\n    \"@type\": \"Person\",\n    \"name\": \"Dr. Sarah van den Berg\",\n    \"jobTitle\": \"Sports Physiotherapist\",\n    \"url\": \"https://www.asics.com/nl/nl-nl/authors/sarah-van-den-berg/\"\n  }\n}\n</script>\n\n<!-- 3. Visible byline -->\n<div class=\"author-byline\">\n  <a href=\"/authors/sarah-van-den-berg\">Dr. Sarah van den Berg</a>\n  <span>Sports Physiotherapist</span>\n</div>"));

        // 12. Publish / update date
        boolean hasDate = !safe(page.datePublished).isEmpty() || !safe(page.dateModified).isEmpty();
        checks.add(new AuditCheck("date", "GEO / E-E-A-T", "Publish / update date", hasDate,
            hasDate ? "Published: " + safe(page.datePublished) +
                (!safe(page.dateModified).isEmpty() ? " | Modified: " + page.dateModified : "") :
            "No publish date — AI engines deprioritise undated content", 7)
            .withFix(!hasDate,
                "Add publish and last-modified dates to your page metadata and JSON-LD. AI engines use freshness as a trust signal — undated content is often skipped.",
                "<!-- Open Graph date tags -->\n<meta property=\"article:published_time\" content=\"2025-01-15T09:00:00+01:00\" />\n<meta property=\"article:modified_time\" content=\"2025-05-10T14:30:00+01:00\" />\n\n<!-- JSON-LD dates -->\n<script type=\"application/ld+json\">\n{\n  \"@context\": \"https://schema.org\",\n  \"@type\": \"Article\",\n  \"datePublished\": \"2025-01-15\",\n  \"dateModified\": \"2025-05-10\"\n}\n</script>\n\n<!-- Visible date -->\n<time datetime=\"2025-05-10\">Last updated: 10 May 2025</time>"));

        // 13. FAQ schema
        boolean hasFaq = page.schemaTypes != null &&
            page.schemaTypes.stream().anyMatch(s -> s.toLowerCase().contains("faq"));
        checks.add(new AuditCheck("faq", "GEO", "FAQ schema (FAQPage)", hasFaq,
            hasFaq ? "FAQPage schema found — excellent GEO signal" :
            "No FAQ schema — adding Q&A markup significantly boosts AI citability", 8)
            .withFix(!hasFaq,
                "Add a FAQPage JSON-LD block to pages that contain questions and answers. This is the single highest-impact GEO fix — AI engines directly cite FAQ content in their answers.",
                "<script type=\"application/ld+json\">\n{\n  \"@context\": \"https://schema.org\",\n  \"@type\": \"FAQPage\",\n  \"mainEntity\": [\n    {\n      \"@type\": \"Question\",\n      \"name\": \"What is the best ASICS shoe for beginners?\",\n      \"acceptedAnswer\": {\n        \"@type\": \"Answer\",\n        \"text\": \"The ASICS Gel-Nimbus is our top recommendation for beginners. It offers maximum cushioning and GEL technology that absorbs shock on road surfaces.\"\n      }\n    },\n    {\n      \"@type\": \"Question\",\n      \"name\": \"How do I find my correct running shoe size?\",\n      \"acceptedAnswer\": {\n        \"@type\": \"Answer\",\n        \"text\": \"Measure your foot length in centimetres and add 1cm for toe clearance. Visit an ASICS store for a free gait analysis and professional fitting.\"\n      }\n    }\n  ]\n}\n</script>"));

        return checks;
    }

    private String safe(String s) { return s == null ? "" : s; }

    private String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max) + "…";
    }
}
