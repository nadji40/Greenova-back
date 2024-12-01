const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { placeOrder, getOrders } = require('../controllers/OrderController');

router.post('/', auth, placeOrder)
router.get('/', auth, getOrders)

module.exports = router;
