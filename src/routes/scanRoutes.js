const express = require('express');
const router = express.Router();
const orchestrator = require('../services/scanOrchestrator');

router.post('/scan', (req, res) => {
  let { url } = req.body;
  if (!url || !url.trim()) {
    return res.status(400).json({ error: 'URL is required' });
  }

  url = url.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: `Invalid URL: ${url}` });
  }

  const scanId = orchestrator.startScan(url);
  res.json({ scanId });
});

router.get('/scan/:scanId', (req, res) => {
  const result = orchestrator.getResult(req.params.scanId);
  if (!result) return res.status(404).json({ error: 'Scan not found' });
  res.json(result);
});

router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'content-velocity-scanner' });
});

module.exports = router;
