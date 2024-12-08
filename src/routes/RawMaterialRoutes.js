const express = require('express');
const router = express.Router();
const { createRawMaterial, getRawMaterial } = require('../controllers/RawMaterialController');
const auth = require('../middleware/auth');
const upload = require('../middleware/multer.middleware');

// Protected routes
router.post('/', auth, upload.array('material_images', 5), createRawMaterial);
// router.put('/:id', auth, upload.array('spareParts_images', 5), updateSparePart);
// router.delete('/:id', auth, deleteSparePart);
// router.get('/allSpareParts', auth, getSparePartsBySupplier);

// Public routes
// router.get('/', getAllSpareParts);
router.get('/:id', getRawMaterial);


module.exports = router; 