const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const upload = require('../middleware/multer.middleware');
const {
    createMachinery,
    getAllMachinery,
    getMachinery,
    updateMachinery,
    deleteMachinery,
    getMachinesByBusiness
} = require('../controllers/machinerySaleController');

// Protected routes
router.post('/', auth, upload.array('machine_images', 5), createMachinery);
router.put('/:id', auth, upload.array('machine_images', 5), updateMachinery);
router.delete('/:id', auth, deleteMachinery);
router.get('/allMachines', auth, getMachinesByBusiness);

// Public routes
router.get('/', getAllMachinery);
router.get('/:id', getMachinery);


module.exports = router;
