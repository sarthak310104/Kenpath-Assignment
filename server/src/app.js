const express = require('express');
const cors = require('cors');

const app = express();
const authRoutes = require('./routes/auth.routes');

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Routes will be mounted here as we build them:
app.use('/api/auth', authRoutes);
// app.use('/api/readings', readingRoutes);
// app.use('/api/reports', reportRoutes);

module.exports = app;
