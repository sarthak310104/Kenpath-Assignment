const express = require('express');
const authenticate = require('../middleware/auth.middleware');

const {
  listDoctors,
  setMyDoctor,
} = require('../controllers/users.controller');

const router = express.Router();

router.use(authenticate);

router.get('/doctors', listDoctors);
router.put('/me/doctor', setMyDoctor);

module.exports = router;