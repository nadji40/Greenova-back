const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { placeOrder, getOrders, getOrder } = require('../controllers/OrderController');

router.post('/', auth, placeOrder)
router.get('/', auth, getOrders)
router.get('/:id', getOrder)

module.exports = router;
