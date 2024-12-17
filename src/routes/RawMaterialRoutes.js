const express = require('express');
const router = express.Router();
const { createRawMaterial, getRawMaterial, updateRawMaterial, deleteRawMaterial, getRawMaterialBySupplier, getAllRawMaterials } = require('../controllers/RawMaterialController');
const auth = require('../middleware/auth');
const upload = require('../middleware/multer.middleware');

// Protected routes
router.post('/', auth, upload.array('material_images', 5), createRawMaterial);
router.put('/:id', auth, upload.array('material_images', 5), updateRawMaterial);
router.delete('/:id', auth, deleteRawMaterial);
router.get('/allRawMaterial', auth, getRawMaterialBySupplier);

// Public routes
router.get('/', getAllRawMaterials);
router.get('/:id', getRawMaterial);


module.exports = router; 