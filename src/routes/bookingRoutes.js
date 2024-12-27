const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { createBookings, getBookings, cancellBooking, getBusinessBookings } = require('../controllers/bookingControllers');


router.post('/', auth, createBookings)
router.get('/', auth, getBookings)
router.get('/:id', auth, getBusinessBookings)
router.put('/:id/cancell', auth, cancellBooking)

module.exports = router;
