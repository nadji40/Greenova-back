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

// Public routes
router.get('/', getAllSpareParts);
router.get('/:id', getSparePart);

// Protected routes
router.post('/', auth, createSparePart);
router.put('/:id', auth, updateSparePart);
router.delete('/:id', auth, deleteSparePart);

module.exports = router; 