const express = require('express');
const cors = require('cors');

const app = express();
const authRoutes = require('./routes/auth.routes');
const readingsRoutes = require('./routes/readings.routes'); 
const reportsRoutes = require('./routes/reports.routes');
const usersRoutes = require('./routes/users.routes');
const doctorRoutes = require('./routes/doctor.routes');

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Routes will be mounted here as we build them:
app.use('/api/auth', authRoutes);
app.use('/api/readings', readingsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/doctor', doctorRoutes);

module.exports = app;