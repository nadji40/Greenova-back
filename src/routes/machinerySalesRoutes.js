const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const upload = require('../middleware/multer.middleware');
const {
    createMachinery,
    getAllMachinery,
    getMachinery,
    updateMachinery,
    deleteMachinery
} = require('../controllers/machinerySaleController');

// Public routes
router.get('/', getAllMachinery);
router.get('/:id', getMachinery);

// Protected routes
router.post('/',  upload.array('machine_images', 5), createMachinery);
router.put('/:id', auth, upload.array('machine_images', 5), updateMachinery);
router.delete('/:id', auth, deleteMachinery);

module.exports = router;
