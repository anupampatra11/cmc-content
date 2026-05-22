package com.contentvelocity.service;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.parser.Parser;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.logging.Logger;

@Service
public class SitemapService {

    private static final Logger log = Logger.getLogger(SitemapService.class.getName());

    @Value("${scanner.max-pages:20}")
    private int maxPages;

    @Value("${scanner.connect-timeout-ms:10000}")
    private int connectTimeout;

    @Value("${scanner.user-agent}")
    private String userAgent;

    /**
     * Given a base URL, discovers all page URLs via sitemap.xml
     * Falls back to crawling from the homepage if no sitemap found.
     */
    public List<String> discoverUrls(String baseUrl) {
        String normalised = normalise(baseUrl);
        List<String> urls = new ArrayList<>();

        // Try sitemap.xml
        urls = tryFetchSitemap(normalised + "/sitemap.xml");
        if (!urls.isEmpty()) {
            log.info("Found " + urls.size() + " URLs in sitemap.xml");
            return urls.subList(0, Math.min(urls.size(), maxPages));
        }

        // Try sitemap_index.xml
        urls = tryFetchSitemap(normalised + "/sitemap_index.xml");
        if (!urls.isEmpty()) {
            log.info("Found " + urls.size() + " URLs in sitemap_index.xml");
            return urls.subList(0, Math.min(urls.size(), maxPages));
        }

        // Fallback: just scan the homepage
        log.info("No sitemap found, falling back to homepage only: " + normalised);
        urls.add(normalised + "/");
        return urls;
    }

    private List<String> tryFetchSitemap(String sitemapUrl) {
        List<String> urls = new ArrayList<>();
        try {
            Document doc = Jsoup.connect(sitemapUrl)
                    .userAgent(userAgent)
                    .timeout(connectTimeout)
                    .parser(Parser.xmlParser())
                    .get();

            // Handle sitemap index — recursively fetch child sitemaps
            for (Element sitemap : doc.select("sitemap > loc")) {
                List<String> child = tryFetchSitemap(sitemap.text().trim());
                urls.addAll(child);
                if (urls.size() >= maxPages) break;
            }

            // Handle regular sitemap
            for (Element url : doc.select("url > loc")) {
                String u = url.text().trim();
                if (!u.isEmpty() && !urls.contains(u)) {
                    urls.add(u);
                }
                if (urls.size() >= maxPages) break;
            }

        } catch (Exception e) {
            log.fine("Could not fetch sitemap at " + sitemapUrl + ": " + e.getMessage());
        }
        return urls;
    }

    private String normalise(String url) {
        try {
            URI uri = new URI(url.trim());
            if (uri.getScheme() == null) {
                uri = new URI("https://" + url.trim());
            }
            // Strip trailing slash
            String result = uri.getScheme() + "://" + uri.getHost();
            if (uri.getPort() != -1 && uri.getPort() != 80 && uri.getPort() != 443) {
                result += ":" + uri.getPort();
            }
            return result;
        } catch (Exception e) {
            return url.trim().replaceAll("/$", "");
        }
    }
}
