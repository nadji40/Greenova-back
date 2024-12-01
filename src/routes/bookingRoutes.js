const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { createBookings, getBookings, cancellBooking } = require('../controllers/bookingControllers');


router.post('/', auth, createBookings)
router.get('/', auth, getBookings)
router.put('/:id/cancell', auth, cancellBooking)

module.exports = router;
