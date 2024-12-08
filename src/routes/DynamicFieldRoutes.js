const express = require('express');
const { getDynamicFields } = require('../controllers/DynamicFieldController');
const auth = require('../middleware/auth');
const pload = require('../middleware/multer.middleware');
const router = express.Router();

router.get("/", getDynamicFields)

module.exports = router;
