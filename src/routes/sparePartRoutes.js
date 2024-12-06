const express = require('express');
const router = express.Router();
const {
  getAllSpareParts,
  getSparePart,
  createSparePart,
  updateSparePart,
  deleteSparePart,
  getSparePartsBySupplier
} = require('../controllers/sparePartController');
const auth = require('../middleware/auth');
const upload = require('../middleware/multer.middleware');

// Protected routes
router.post('/', auth, upload.array('spareParts_images', 5), createSparePart);
router.put('/:id', auth, upload.array('spareParts_images', 5), updateSparePart);
router.delete('/:id', auth, deleteSparePart);
router.get('/allSpareParts', auth, getSparePartsBySupplier);

// Public routes
router.get('/', getAllSpareParts);
router.get('/:id', getSparePart);


module.exports = router; 