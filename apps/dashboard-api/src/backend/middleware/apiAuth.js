/**
 * API Authentication Middleware
 * Validates API keys for external CRM access
 */

export function apiKeyAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

  // Check if API key authentication is enabled
  const apiAuthEnabled = process.env.API_AUTH_ENABLED === 'true';

  if (!apiAuthEnabled) {
    // Auth disabled - allow all requests
    return next();
  }

  if (!apiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'API key is required. Provide via X-API-Key header or Authorization Bearer token.'
    });
  }

  // Validate API key
  const validApiKey = process.env.CRM_API_KEY;

  if (!validApiKey) {
    console.error('[Auth] CRM_API_KEY not configured in environment');
    return res.status(500).json({
      error: 'Server Configuration Error',
      message: 'API authentication is enabled but not properly configured'
    });
  }

  if (apiKey !== validApiKey) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid API key'
    });
  }

  // API key is valid, proceed
  next();
}

/**
 * Rate limiting middleware
 * Prevents abuse by limiting requests per IP
 */
const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 100; // 100 requests per minute

export function rateLimiter(req, res, next) {
  const rateLimitEnabled = process.env.RATE_LIMIT_ENABLED !== 'false'; // Enabled by default

  if (!rateLimitEnabled) {
    return next();
  }

  const clientIp = req.ip || req.connection.remoteAddress;
  const now = Date.now();

  if (!requestCounts.has(clientIp)) {
    requestCounts.set(clientIp, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return next();
  }

  const clientData = requestCounts.get(clientIp);

  // Reset if window has passed
  if (now > clientData.resetTime) {
    requestCounts.set(clientIp, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return next();
  }

  // Increment count
  clientData.count++;

  if (clientData.count > MAX_REQUESTS) {
    return res.status(429).json({
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Maximum ${MAX_REQUESTS} requests per minute.`,
      retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
    });
  }

  next();
}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of requestCounts.entries()) {
    if (now > data.resetTime) {
      requestCounts.delete(ip);
    }
  }
}, RATE_LIMIT_WINDOW);

export default { apiKeyAuth, rateLimiter };
