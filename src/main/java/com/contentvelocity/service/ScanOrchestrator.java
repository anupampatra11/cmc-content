package com.contentvelocity.service;

import com.contentvelocity.model.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Logger;

@Service
public class ScanOrchestrator {

    private static final Logger log = Logger.getLogger(ScanOrchestrator.class.getName());

    // In-memory store of scan results (keyed by scan ID)
    private final Map<String, ScanResult> scanStore = new ConcurrentHashMap<>();

    @Autowired private SitemapService sitemapService;
    @Autowired private CrawlerService crawlerService;
    @Autowired private SeoRuleEngine ruleEngine;
    @Autowired private AnthropicService anthropicService;
    @Autowired private ScoreCalculator scoreCalculator;

    /**
     * Starts a new scan and returns the scan ID immediately.
     * The actual scan runs asynchronously.
     */
    public String startScan(String url) {
        String scanId = UUID.randomUUID().toString().replace("-", "").substring(0, 12);

        ScanResult result = new ScanResult();
        result.id = scanId;
        result.status = "running";
        result.targetUrl = url;
        result.pages = Collections.synchronizedList(new ArrayList<>());
        result.progressLabel = "Starting scan…";
        scanStore.put(scanId, result);

        runScanAsync(scanId, url);
        return scanId;
    }

    public ScanResult getResult(String scanId) {
        return scanStore.get(scanId);
    }

    @Async
    public void runScanAsync(String scanId, String url) {
        ScanResult result = scanStore.get(scanId);
        try {
            // Step 1: Discover URLs
            result.progressLabel = "Fetching sitemap…";
            List<String> urls = sitemapService.discoverUrls(url);
            result.totalPages = urls.size();
            result.progressLabel = "Found " + urls.size() + " pages — scanning…";

            // Step 2: Scan each page
            for (int i = 0; i < urls.size(); i++) {
                String pageUrl = urls.get(i);
                result.progressLabel = "Scanning " + extractPath(pageUrl) +
                                       " (" + (i + 1) + "/" + urls.size() + ")";

                PageAudit audit = scanPage(pageUrl);
                result.pages.add(audit);
                result.scannedPages = result.pages.size();
                updateAverages(result);
            }

            result.status = "complete";
            result.progressLabel = "Scan complete — " + urls.size() + " pages analysed";
            updateAverages(result);

        } catch (Exception e) {
            log.severe("Scan failed for " + url + ": " + e.getMessage());
            result.status = "error";
            result.errorMessage = "Scan failed: " + e.getMessage();
            result.progressLabel = "Scan failed";
        }
    }

    private PageAudit scanPage(String url) {
        PageAudit audit = new PageAudit();
        audit.url = url;
        audit.status = "pending";

        try {
            // Crawl the page
            PageData data = crawlerService.crawl(url);
            audit.title = data.title;
            audit.slug = data.slug;

            // Run deterministic rules
            List<AuditCheck> checks = ruleEngine.runChecks(data);
            audit.checks = checks;

            // Run AI analysis
            AiScores aiScores = anthropicService.analyse(data);
            audit.aiScores = aiScores;

            // Calculate scores
            audit.scores = scoreCalculator.calculate(checks, aiScores, data);
            audit.status = "complete";

        } catch (Exception e) {
            log.warning("Failed to scan page " + url + ": " + e.getMessage());
            audit.status = "error";
            audit.errorMessage = e.getMessage();
            audit.title = extractPath(url);
            audit.slug = extractPath(url);
            audit.checks = new ArrayList<>();
            audit.scores = new PageScores(0, 0);
        }

        return audit;
    }

    private void updateAverages(ScanResult result) {
        if (result.pages == null || result.pages.isEmpty()) return;
        List<PageAudit> completed = result.pages.stream()
                .filter(p -> p.scores != null)
                .toList();
        if (completed.isEmpty()) return;
        result.avgSeo = (int) completed.stream().mapToInt(p -> p.scores.seo).average().orElse(0);
        result.avgGeo = (int) completed.stream().mapToInt(p -> p.scores.geo).average().orElse(0);
        result.avgCombined = (int) completed.stream().mapToInt(p -> p.scores.combined).average().orElse(0);
    }

    private String extractPath(String url) {
        try { return new java.net.URI(url).getPath(); } catch (Exception e) { return url; }
    }
}
