const express = require('express');
const authenticate = require('../middleware/auth.middleware');
const { requireDoctor } = require('../middleware/role.middleware');

const {
  listPatients,
  getPatientReport,
} = require('../controllers/doctor.controller');

const router = express.Router();

router.use(authenticate, requireDoctor);

router.get('/patients', listPatients);
router.get('/patients/:id/reports/:kind', getPatientReport);

module.exports = router;