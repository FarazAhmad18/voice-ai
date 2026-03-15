const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load .env from project root
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const logger = require('./services/logger');
const retellWebhookRouter = require('./routes/retellWebhook');
const leadsRouter = require('./routes/leads');
const appointmentsRouter = require('./routes/appointments');
const logsRouter = require('./routes/logs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
}));
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'LeapingAI Backend' });
});

// Routes
app.use('/api/retell', retellWebhookRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/logs', logsRouter);

// Global error handler — catches unhandled Express errors
app.use((err, req, res, next) => {
  logger.error('system', `Unhandled error: ${err.message}`, {
    details: { error: err.message, stack: err.stack, method: req.method, url: req.url },
    ip: req.ip,
  });
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  logger.info('system', `Server started on port ${PORT}`);
});

// Catch unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  logger.error('system', `Unhandled promise rejection: ${reason}`, {
    details: { error: String(reason), stack: reason?.stack },
  });
});
