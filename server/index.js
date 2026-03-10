const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load .env from project root
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const vapiWebhookRouter = require('./routes/vapiWebhook');
const leadsRouter = require('./routes/leads');
const appointmentsRouter = require('./routes/appointments');

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
  res.json({ status: 'ok', service: 'LawVoice AI Backend' });
});

// Routes
app.use('/api/vapi', vapiWebhookRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/appointments', appointmentsRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
