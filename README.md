# Content Velocity Scanner

AI-powered SEO + GEO content audit tool built with Spring Boot.

## Prerequisites

- Java 17+
- Maven 3.8+
- An Anthropic API key (get one at https://console.anthropic.com)

## Setup

### 1. Set your Anthropic API key

**Option A — environment variable (recommended):**
```bash
export ANTHROPIC_API_KEY=sk-ant-your-key-here
```

**Option B — edit application.properties:**
```
anthropic.api.key=sk-ant-your-key-here
```

### 2. Run the application

```bash
cd content-velocity
mvn spring-boot:run
```

### 3. Open in browser

```
http://localhost:8080
```

Paste any website URL, click **Scan site**, and watch the results come in.

---

## How it works

1. **Sitemap discovery** — fetches `/sitemap.xml` or `/sitemap_index.xml` to find all page URLs (max 20 pages per scan)
2. **Page crawl** — uses Jsoup to fetch and parse each page's HTML
3. **Deterministic rules** — 13 SEO/GEO checks run instantly (title, meta, H1, schema, canonical, etc.)
4. **AI analysis** — calls Claude (claude-haiku) per page for GEO scoring: BLUF structure, tone, factual density, entity clarity, Q&A fit, and 3 specific improvement suggestions
5. **Score calculation** — SEO score (0–100) + GEO score (0–100) → combined Content Velocity Score

---

## Configuration (application.properties)

| Property | Default | Description |
|---|---|---|
| `server.port` | 8080 | Server port |
| `anthropic.api.key` | (required) | Your Anthropic API key |
| `anthropic.model` | claude-haiku-4-5-20251001 | Model to use (haiku = fast + cheap) |
| `scanner.max-pages` | 20 | Max pages to scan per site |
| `scanner.connect-timeout-ms` | 10000 | HTTP connect timeout |

---

## Project structure

```
src/main/java/com/contentvelocity/
├── ContentVelocityApplication.java   — entry point
├── config/
│   └── AsyncConfig.java              — thread pool for async scanning
├── controller/
│   └── ScanController.java           — REST: POST /api/scan, GET /api/scan/{id}
├── model/
│   ├── ScanRequest.java
│   ├── ScanResult.java
│   ├── PageAudit.java
│   ├── PageData.java
│   ├── AuditCheck.java
│   ├── PageScores.java
│   └── AiScores.java
└── service/
    ├── SitemapService.java           — discovers URLs from sitemap.xml
    ├── CrawlerService.java           — fetches + parses page HTML with Jsoup
    ├── SeoRuleEngine.java            — 13 deterministic SEO/GEO checks
    ├── ScoreCalculator.java          — computes SEO, GEO, combined scores
    ├── AnthropicService.java         — calls Claude API for AI scoring
    └── ScanOrchestrator.java         — async pipeline coordinator

src/main/resources/static/
├── index.html                        — single-page UI
├── css/style.css                     — all styles
└── js/app.js                         — fetch, polling, DOM rendering
```

---

## REST API

### Start a scan
```
POST /api/scan
Content-Type: application/json

{ "url": "https://example.com" }

→ { "scanId": "abc123def456" }
```

### Poll for results
```
GET /api/scan/{scanId}

→ {
    "id": "abc123def456",
    "status": "running" | "complete" | "error",
    "totalPages": 7,
    "scannedPages": 3,
    "progressLabel": "Scanning /about (3/7)",
    "avgSeo": 72,
    "avgGeo": 58,
    "avgCombined": 65,
    "pages": [ ... ]
  }
```

Poll every 1–2 seconds until `status === "complete"`.

---

## Sprint 2 ideas (after demo)

- AEM connector — pull content via AEM Query Builder API, push suggestions back as workflow tasks
- Bloomreach connector — Content Delivery API integration  
- Scheduled recurring scans with score tracking over time
- PDF export of the audit report
- Before/after score comparison view
- Content rewrite assistant — expand AI suggestions into full draft rewrites
