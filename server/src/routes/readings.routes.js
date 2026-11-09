const express = require('express');

const authenticate = require('../middleware/auth.middleware');

const {
  getReadings,
  getReading,
  createReading,
  updateReading,
  deleteReading,
} = require('../controllers/readings.controller');

const router = express.Router();

router.use(authenticate);

router.get('/', getReadings);
router.get('/:id', getReading);
router.post('/', createReading);
router.put('/:id', updateReading);
router.delete('/:id', deleteReading);

module.exports = router;