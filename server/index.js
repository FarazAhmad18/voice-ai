const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const rateLimit = require('express-rate-limit');

// Load .env from project root
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const logger = require('./services/logger');
require('./services/scheduler');
const authRouter = require('./routes/auth');
const retellWebhookRouter = require('./routes/retellWebhook');
const firmsRouter = require('./routes/firms');
const templatesRouter = require('./routes/templates');
const staffRouter = require('./routes/staff');
const settingsRouter = require('./routes/settings');
const leadsRouter = require('./routes/leads');
const appointmentsRouter = require('./routes/appointments');
const logsRouter = require('./routes/logs');
const messagesRouter = require('./routes/messages');
const twilioWebhookRouter = require('./routes/twilioWebhook');
const knowledgeRouter = require('./routes/knowledge');

const requestId = require('./middleware/requestId');
const requestLogger = require('./middleware/requestLogger');

const app = express();
const PORT = process.env.PORT || 3000;

// Request ID must be first — before all other middleware
app.use(requestId);

// Trust proxy for rate limiting behind reverse proxies (Render, etc.)
app.set('trust proxy', 1);

// --- CORS lockdown ---
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && !process.env.FRONTEND_URL) {
  logger.error('system', 'FRONTEND_URL is required in production — server refusing to start with wildcard CORS');
  process.exit(1);
}

const frontendUrl = (process.env.FRONTEND_URL || '').trim().replace(/\/+$/, '');
const allowedOrigins = isProduction
  ? [frontendUrl]
  : [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
      'http://127.0.0.1:3000',
      ...(frontendUrl ? [frontendUrl] : []),
    ];

// Log allowed origins on startup for debugging
logger.info('system', `CORS allowed origins: ${JSON.stringify(allowedOrigins)}`);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// --- Security headers ---
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co https://api.retellai.com");
  }
  next();
});

// --- Body size limit ---
app.use(express.json({ limit: '1mb' }));

// --- Rate limiters ---
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: { error: 'Too many signup attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1000, // High limit — webhooks are already authenticated via signature verification
  message: { error: 'Too many webhook requests.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Request/response logging — after body parser, before routes
app.use(requestLogger);

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'VoibixAI Backend' });
});

// --- Routes with rate limiters ---
// Auth routes with specific limiters
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/signup', signupLimiter);
app.use('/api/auth', authRouter);

// Webhook routes with webhook limiter (higher threshold)
app.use('/api/retell', webhookLimiter, retellWebhookRouter);
app.use('/api/twilio', webhookLimiter, twilioWebhookRouter);

// All other API routes with general limiter
app.use('/api/firms', generalApiLimiter, firmsRouter);
app.use('/api/templates', generalApiLimiter, templatesRouter);
app.use('/api/staff', generalApiLimiter, staffRouter);
app.use('/api/settings', generalApiLimiter, settingsRouter);
app.use('/api/leads', generalApiLimiter, leadsRouter);
app.use('/api/appointments', generalApiLimiter, appointmentsRouter);
app.use('/api/logs', generalApiLimiter, logsRouter);
app.use('/api/messages', generalApiLimiter, messagesRouter);
app.use('/api/knowledge', generalApiLimiter, knowledgeRouter);

// Global error handler — catches unhandled Express errors
app.use((err, req, res, next) => {
  logger.error('system', `Unhandled error: ${err.message}`, {
    details: { error: err.message, stack: err.stack, method: req.method, url: req.url },
    ip: req.ip,
  });
  res.status(500).json({ error: 'Internal server error' });
});

// Startup health check and listen
(async () => {
  const supabase = require('./services/supabase');
  if (supabase) {
    try {
      const { error } = await supabase.from('firms').select('id').limit(1);
      if (error) {
        logger.error('system', `Startup health check failed: ${error.message}`);
        process.exit(1);
      }
      logger.info('system', 'Startup health check passed — Supabase is reachable');
    } catch (err) {
      logger.error('system', `Startup health check failed: ${err.message}`);
      process.exit(1);
    }
  }

  server = app.listen(PORT, () => {
    logger.info('system', `Server started on port ${PORT}`);
  });
})();

// Catch unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  logger.error('system', `Unhandled promise rejection: ${reason}`, {
    details: { error: String(reason), stack: reason?.stack },
  });
});

// Catch uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('system', `Uncaught exception: ${err.message}`, {
    details: { error: err.message, stack: err.stack },
  });
  // Give logger time to flush, then exit
  setTimeout(() => process.exit(1), 1000);
});

// Graceful shutdown handler
let server;
function gracefulShutdown(signal) {
  logger.info('system', `${signal} received — shutting down gracefully`);
  if (server) {
    server.close(() => {
      logger.info('system', 'All connections closed — exiting');
      process.exit(0);
    });
    // Force exit after 30 seconds if connections don't close
    setTimeout(() => {
      logger.warn('system', 'Forced exit after 30s timeout');
      process.exit(1);
    }, 30000);
  } else {
    process.exit(0);
  }
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
