const express = require('express');
const authenticate = require('../middleware/auth.middleware');

const {
  getDailyReport,
  getMonthToDateReport,
  getPreviousMonthReport
} = require('../controllers/reports.controller');

const router = express.Router();

router.use(authenticate);

router.get('/daily', getDailyReport);
router.get('/month-to-date', getMonthToDateReport);
router.get('/previous-month', getPreviousMonthReport);

module.exports = router;