package com.contentvelocity.model;

import java.util.List;

public class ScanResult {
    public String id;
    public String status;        // "running" | "complete" | "error"
    public String targetUrl;
    public int totalPages;
    public int scannedPages;
    public List<PageAudit> pages;
    public String progressLabel;
    public int avgSeo;
    public int avgGeo;
    public int avgCombined;
    public String errorMessage;
}
