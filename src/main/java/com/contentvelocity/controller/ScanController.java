package com.contentvelocity.controller;

import com.contentvelocity.model.ScanRequest;
import com.contentvelocity.model.ScanResult;
import com.contentvelocity.service.ScanOrchestrator;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class ScanController {

    @Autowired
    private ScanOrchestrator orchestrator;

    /**
     * POST /api/scan
     * Body: { "url": "https://example.com" }
     * Returns: { "scanId": "abc123" }
     */
    @PostMapping("/scan")
    public ResponseEntity<?> startScan(@RequestBody ScanRequest request) {
        if (request.url == null || request.url.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "URL is required"));
        }

        String url = request.url.trim();
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            url = "https://" + url;
        }

        try {
            new java.net.URL(url).toURI();
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid URL: " + url));
        }

        String scanId = orchestrator.startScan(url);
        return ResponseEntity.ok(Map.of("scanId", scanId));
    }

    /**
     * GET /api/scan/{scanId}
     * Returns the current state of the scan (poll this from the frontend)
     */
    @GetMapping("/scan/{scanId}")
    public ResponseEntity<?> getScan(@PathVariable String scanId) {
        ScanResult result = orchestrator.getResult(scanId);
        if (result == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(result);
    }

    /**
     * GET /api/health
     */
    @GetMapping("/health")
    public ResponseEntity<?> health() {
        return ResponseEntity.ok(Map.of("status", "ok", "service", "content-velocity-scanner"));
    }
}
