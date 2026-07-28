require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT || '8080', 10),
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    apiUrl: process.env.ANTHROPIC_API_URL || 'https://api.anthropic.com/v1/messages',
    model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
  },
  scanner: {
    maxPages: parseInt(process.env.MAX_PAGES || '20', 10),
    connectTimeoutMs: parseInt(process.env.CONNECT_TIMEOUT_MS || '10000', 10),
    readTimeoutMs: parseInt(process.env.READ_TIMEOUT_MS || '15000', 10),
    userAgent: process.env.USER_AGENT ||
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  },
};
