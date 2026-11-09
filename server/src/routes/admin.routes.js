const express = require('express');
const requireAdminKey = require('../middleware/admin.middleware');

const {
  listPendingDoctors,
  approveDoctor,
} = require('../controllers/admin.controller');

const router = express.Router();

router.use(requireAdminKey);

router.get('/doctors/pending', listPendingDoctors);
router.post('/doctors/approve', approveDoctor);

module.exports = router;