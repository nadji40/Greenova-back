const express = require('express');
const router = express.Router();
const { 
    getPendingServices, 
    approveService, 
    rejectService 
} = require('../controllers/adminController');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

// Protect all admin routes with authentication and admin authorization
router.use(auth, adminAuth);

// Get all pending services with pagination
router.get('/pending-services', getPendingServices);

// Approve a service
router.put('/approve-service/:id', approveService);

// Reject a service
router.put('/reject-service/:id', rejectService);

module.exports = router;
