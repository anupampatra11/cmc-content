package com.contentvelocity.service;

import com.contentvelocity.model.PageData;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.logging.Logger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class CrawlerService {

    private static final Logger log = Logger.getLogger(CrawlerService.class.getName());

    private final ObjectMapper schemaMapper = new ObjectMapper();

    private static final Map<String, Integer> SCHEMA_EXPECTED_FIELDS = Map.of(
        "Article", 8, "BlogPosting", 8, "NewsArticle", 8,
        "Product", 9, "FAQPage", 4, "WebSite", 5,
        "WebPage", 5, "Organization", 6, "LocalBusiness", 7,
        "Person", 5
    );

    private static final Pattern FACTUAL_PATTERN = Pattern.compile(
        "\\d+([,.]\\d+)?(%|\\s*(percent|million|billion|thousand))?|" +
        "\\b(according to|research|study|studies|report|survey|data|statistics|found that)\\b",
        Pattern.CASE_INSENSITIVE
    );

    private static final Pattern TECHNICAL_TERM_PATTERN = Pattern.compile(
        "\\b[A-Z][a-zA-Z0-9]*(?:[\\s-][A-Z][a-zA-Z0-9]*){0,2}\\b"
    );

    @Value("${scanner.connect-timeout-ms:10000}")
    private int connectTimeout;

    @Value("${scanner.read-timeout-ms:15000}")
    private int readTimeout;

    @Value("${scanner.user-agent}")
    private String userAgent;

    public PageData crawl(String url) throws Exception {
        PageData data = new PageData();
        data.url = url;

        try {
            URI uri = new URI(url);
            data.slug = uri.getPath();
            data.baseDomain = uri.getHost();
        } catch (Exception e) {
            data.slug = url;
        }

        Document doc = Jsoup.connect(url)
                .userAgent(userAgent)
                .timeout(connectTimeout)
                .followRedirects(true)
                .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8")
                .header("Accept-Language", "en-US,en;q=0.9")
                .header("Accept-Encoding", "gzip, deflate, br")
                .header("Cache-Control", "no-cache")
                .header("Pragma", "no-cache")
                .header("Upgrade-Insecure-Requests", "1")
                .header("Sec-Fetch-Dest", "document")
                .header("Sec-Fetch-Mode", "navigate")
                .header("Sec-Fetch-Site", "none")
                .header("Sec-Fetch-User", "?1")
                .ignoreHttpErrors(false)
                .get();

        // Title
        data.title = doc.title();

        // Meta description
        Element metaDesc = doc.selectFirst("meta[name=description]");
        if (metaDesc == null) metaDesc = doc.selectFirst("meta[property=og:description]");
        data.metaDescription = metaDesc != null ? metaDesc.attr("content") : "";

        // Headings
        data.h1s = texts(doc.select("h1"));
        data.h2s = texts(doc.select("h2"));

        // Images
        Elements images = doc.select("img");
        data.imageCount = images.size();
        data.imagesWithMissingAlt = new ArrayList<>();
        for (Element img : images) {
            if (img.attr("alt").trim().isEmpty()) {
                String src = img.attr("abs:src");
                if (src.isBlank()) src = img.attr("src");
                if (!src.isBlank()) data.imagesWithMissingAlt.add(src);
            }
        }
        data.missingAltCount = data.imagesWithMissingAlt.size();

        // Canonical
        Element canonical = doc.selectFirst("link[rel=canonical]");
        data.canonicalUrl = canonical != null ? canonical.attr("href") : "";

        // Internal and external links
        int internalCount = 0, externalCount = 0;
        for (Element a : doc.select("a[href]")) {
            String href = a.attr("abs:href");
            if (href.isBlank() || href.startsWith("#") ||
                href.startsWith("mailto:") || href.startsWith("tel:") ||
                href.startsWith("javascript:")) continue;
            if (href.contains(data.baseDomain)) internalCount++;
            else externalCount++;
        }
        data.internalLinkCount = internalCount;
        data.externalLinkCount = externalCount;

        // Schema types from JSON-LD
        data.schemaTypes = extractSchemaTypes(doc);

        // Schema field counts (must extract before script removal)
        int[] schemaCounts = extractSchemaFieldCounts(doc);
        data.validSchemaFields = schemaCounts[0];
        data.totalSchemaFields = schemaCounts[1];

        // Author - check common meta patterns
        data.authorName = extractAuthor(doc);

        // Dates
        data.datePublished = extractMeta(doc, "article:published_time", "datePublished");
        data.dateModified = extractMeta(doc, "article:modified_time", "dateModified");
        data.daysSinceLastUpdate = computeDaysSinceUpdate(data.dateModified, data.datePublished);

        // Body text — remove nav, footer, script, style first
        doc.select("nav, footer, script, style, header").remove();

        // Heading and list counts (nav/header/footer already removed)
        data.headingCount = doc.select("h1, h2, h3, h4, h5, h6").size();
        data.listCount    = doc.select("ul, ol").size();

        String bodyText = doc.select("main, article, .content, #content, body").text();

        // Quotations: blockquotes in doc + inline "..." patterns in body text
        data.quotationCount = doc.select("blockquote").size() + countInlineQuotes(bodyText);

        // Full body text metrics (before truncation)
        data.totalWords            = countMeaningfulWords(bodyText);
        data.wordCount             = data.totalWords;
        data.totalSentences        = countSentences(bodyText);
        data.factualStatementCount = countFactualStatements(bodyText);
        data.avgChunkSize          = data.headingCount > 0
                                     ? (double) data.totalWords / data.headingCount
                                     : data.totalWords;
        data.technicalTermCount    = countTechnicalTerms(bodyText);

        data.bodyText = bodyText.length() > 2000 ? bodyText.substring(0, 2000) : bodyText;

        log.info("Crawled: " + url + " | words: " + data.wordCount + " | schema: " + data.schemaTypes);
        return data;
    }

    private List<String> texts(Elements elements) {
        List<String> result = new ArrayList<>();
        for (Element el : elements) {
            String t = el.text().trim();
            if (!t.isEmpty()) result.add(t);
        }
        return result;
    }

    private List<String> extractSchemaTypes(Document doc) {
        List<String> types = new ArrayList<>();
        Pattern typePattern = Pattern.compile("\"@type\"\\s*:\\s*\"([^\"]+)\"");
        for (Element script : doc.select("script[type=application/ld+json]")) {
            Matcher m = typePattern.matcher(script.html());
            while (m.find()) {
                String type = m.group(1);
                if (!types.contains(type)) types.add(type);
            }
        }
        return types;
    }

    private String extractAuthor(Document doc) {
        // Try meta tags
        String[] authorAttrs = {
            "author", "article:author", "og:article:author",
            "twitter:creator", "DC.creator"
        };
        for (String attr : authorAttrs) {
            Element el = doc.selectFirst("meta[name=" + attr + "]");
            if (el == null) el = doc.selectFirst("meta[property=" + attr + "]");
            if (el != null && !el.attr("content").trim().isEmpty()) {
                return el.attr("content").trim();
            }
        }

        // Try JSON-LD
        Pattern authorPattern = Pattern.compile("\"author\"\\s*:\\s*\\{[^}]*\"name\"\\s*:\\s*\"([^\"]+)\"");
        for (Element script : doc.select("script[type=application/ld+json]")) {
            Matcher m = authorPattern.matcher(script.html());
            if (m.find()) return m.group(1);
        }

        // Try rel=author or common class names
        Element authorEl = doc.selectFirst("[rel=author], .author-name, .byline, [itemprop=author]");
        if (authorEl != null && !authorEl.text().trim().isEmpty()) {
            return authorEl.text().trim();
        }

        return "";
    }

    private int[] extractSchemaFieldCounts(Document doc) {
        int validFields = 0;
        int totalExpected = 0;
        for (Element script : doc.select("script[type=application/ld+json]")) {
            try {
                JsonNode root = schemaMapper.readTree(script.html());
                List<JsonNode> schemas = new ArrayList<>();
                if (root.has("@graph") && root.get("@graph").isArray()) {
                    root.get("@graph").forEach(schemas::add);
                } else {
                    schemas.add(root);
                }
                for (JsonNode schema : schemas) {
                    String type = schema.has("@type") ? schema.get("@type").asText() : "";
                    totalExpected += SCHEMA_EXPECTED_FIELDS.getOrDefault(type, 5);
                    validFields += countNonEmptySchemaFields(schema, new HashSet<>());
                }
            } catch (Exception ignored) {}
        }
        return new int[]{ validFields, totalExpected };
    }

    private int countNonEmptySchemaFields(JsonNode node, Set<String> counted) {
        int count = 0;
        Iterator<Map.Entry<String, JsonNode>> fields = node.fields();
        while (fields.hasNext()) {
            Map.Entry<String, JsonNode> entry = fields.next();
            String key = entry.getKey();
            JsonNode val = entry.getValue();
            if (key.startsWith("@")) continue;
            if (counted.contains(key)) continue;
            if (val.isNull() || (val.isTextual() && val.asText().trim().isEmpty())) continue;
            counted.add(key);
            count++;
            if (val.isObject()) count += countNonEmptySchemaFields(val, counted);
        }
        return count;
    }

    private Integer computeDaysSinceUpdate(String dateModified, String datePublished) {
        String dateStr = (dateModified != null && !dateModified.isBlank()) ? dateModified : datePublished;
        if (dateStr == null || dateStr.isBlank() || dateStr.length() < 10) return null;
        try {
            LocalDate date = LocalDate.parse(dateStr.substring(0, 10));
            return (int) ChronoUnit.DAYS.between(date, LocalDate.now());
        } catch (Exception e) {
            return null;
        }
    }

    private int countInlineQuotes(String text) {
        if (text == null || text.isBlank()) return 0;
        Matcher m = Pattern.compile("\"[^\"]{3,}\"").matcher(text);
        int count = 0;
        while (m.find()) count++;
        return count;
    }

    private int countMeaningfulWords(String text) {
        if (text == null || text.isBlank()) return 0;
        int count = 0;
        for (String token : text.split("\\s+")) {
            if (!token.replaceAll("[^a-zA-Z]", "").isEmpty()) count++;
        }
        return count;
    }

    private int countSentences(String text) {
        if (text == null || text.isBlank()) return 0;
        int count = 0;
        for (String s : text.split("[.?!]+")) {
            if (s.trim().split("\\s+").length >= 3) count++;
        }
        return count;
    }

    private int countFactualStatements(String text) {
        if (text == null || text.isBlank()) return 0;
        int count = 0;
        for (String s : text.split("[.?!]+")) {
            String trimmed = s.trim();
            if (trimmed.split("\\s+").length < 3) continue;
            if (FACTUAL_PATTERN.matcher(trimmed).find()) count++;
        }
        return count;
    }

    private int countTechnicalTerms(String text) {
        if (text == null || text.isBlank()) return 0;
        Matcher m = TECHNICAL_TERM_PATTERN.matcher(text);
        Set<String> seen = new HashSet<>();
        while (m.find()) {
            String term = m.group().trim();
            if (term.length() > 3) seen.add(term.toLowerCase());
        }
        return seen.size();
    }

    private String extractMeta(Document doc, String... names) {
        for (String name : names) {
            Element el = doc.selectFirst("meta[property=" + name + "]");
            if (el == null) el = doc.selectFirst("meta[name=" + name + "]");
            if (el == null) el = doc.selectFirst("time[itemprop=" + name + "]");
            if (el != null) {
                String val = el.attr("content");
                if (val.isEmpty()) val = el.attr("datetime");
                if (!val.isEmpty()) return val;
            }
        }
        // Try JSON-LD
        String key = names[names.length - 1];
        Pattern p = Pattern.compile("\"" + key + "\"\\s*:\\s*\"([^\"]+)\"");
        for (Element script : doc.select("script[type=application/ld+json]")) {
            Matcher m = p.matcher(script.html());
            if (m.find()) return m.group(1);
        }
        return "";
    }
}
