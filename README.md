# Content Velocity Scanner

AI-powered SEO + GEO content audit tool built with Node.js and Express.

# Code is deployed to render.com automatically with every change, below is the URL
https://cmc-content.onrender.com/

## Prerequisites

- Node.js 20+
- An Anthropic API key (get one at https://console.anthropic.com)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Set your Anthropic API key

```bash
cp .env.example .env
```

Edit `.env` and add your key:

```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### 3. Run the application

```bash
npm start
```

### 4. Open in browser

```
http://localhost:8080
```

Paste any website URL, click **Scan site**, and watch the results come in.

---

## Docker

```bash
docker build -t content-velocity .
docker run -e ANTHROPIC_API_KEY=sk-ant-your-key-here -p 8080:8080 content-velocity
```

---

## How it works

1. **Sitemap discovery** — fetches `/sitemap.xml` or `/sitemap_index.xml` to find all page URLs (max 20 pages per scan)
2. **Page crawl** — uses Cheerio to fetch and parse each page's HTML
3. **Deterministic rules** — 13 SEO/GEO checks run instantly (title, meta, H1, schema, canonical, etc.)
4. **AI analysis** — calls Claude (claude-haiku) per page for GEO scoring: BLUF structure, tone, factual density, entity clarity, Q&A fit, and 3 specific improvement suggestions
5. **Score calculation** — SEO score (0–100) + GEO score (0–100) → combined Content Velocity Score

---

## Configuration (.env)

| Variable | Default | Description |
|---|---|---|
| `PORT` | 8080 | Server port |
| `ANTHROPIC_API_KEY` | (required) | Your Anthropic API key |
| `ANTHROPIC_MODEL` | claude-haiku-4-5-20251001 | Model to use |
| `MAX_PAGES` | 20 | Max pages to scan per site |
| `CONNECT_TIMEOUT_MS` | 10000 | HTTP connect timeout |

---

## Project structure

```
src/
├── server.js                  — Express app entry point
├── config.js                  — Environment-based configuration
├── routes/
│   └── scanRoutes.js          — REST: POST /api/scan, GET /api/scan/:id, GET /api/health
└── services/
    ├── scanOrchestrator.js    — Async scan pipeline coordinator
    ├── sitemapService.js      — Discovers URLs from sitemap.xml
    ├── crawlerService.js      — Fetches + parses page HTML with Cheerio
    ├── seoRuleEngine.js       — 13 deterministic SEO/GEO checks
    ├── scoreCalculator.js     — Computes SEO, GEO, and combined scores
    └── anthropicService.js    — Calls Claude API for AI scoring

public/
├── index.html                 — Single-page UI
├── css/style.css              — All styles
└── js/app.js                  — Fetch, polling, DOM rendering
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
GET /api/scan/:scanId

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

### Health check
```
GET /api/health

→ { "status": "ok", "service": "content-velocity-scanner" }
```

---

## Contributing

1. Fork the repo or request collaborator access
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes and push: `git push origin feature/your-feature`
4. Open a Pull Request — the maintainer will review and merge

---
