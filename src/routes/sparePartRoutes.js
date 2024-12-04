const express = require('express');
const router = express.Router();
const {
  getAllSpareParts,
  getSparePart,
  createSparePart,
  updateSparePart,
  deleteSparePart
} = require('../controllers/sparePartController');
const auth = require('../middleware/auth');
const upload = require('../middleware/multer.middleware');

// Public routes
router.get('/', getAllSpareParts);
router.get('/:id', getSparePart);

// Protected routes
router.post('/', auth, upload.array('spareParts_images', 5), createSparePart);
router.put('/:id', auth, upload.array('spareParts_images', 5), updateSparePart);
router.delete('/:id', auth, deleteSparePart);

module.exports = router; 