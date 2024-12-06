const express = require('express');
const { createBusiness, getAllBusiness, getBusiness, updateBusiness, deleteBusiness, nearByBusinesses } = require('../controllers/BusinessController');
const auth = require('../middleware/auth');
const upload = require('../middleware/multer.middleware');
const router = express.Router();

// Protected routes
router.post('/', auth, upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), createBusiness);
router.put('/', auth, upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), updateBusiness);
router.delete('/', auth, deleteBusiness);

router.get('/nearBy', nearByBusinesses)
router.get('/', getAllBusiness)
router.get('/profile', auth, getBusiness)

module.exports = router;
