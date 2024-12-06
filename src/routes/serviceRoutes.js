const express = require('express');
const { createService, updateService, deleteService, getServices, getService, getServicesByBusiness } = require('../controllers/serviceController');
const auth = require('../middleware/auth');
const upload = require('../middleware/multer.middleware');
const router = express.Router();


router.post('/', auth, upload.array('images', 5), createService);
router.put('/:id', auth, upload.array('images', 5), updateService);
router.delete('/:id', auth, deleteService);
router.get('/allServices', auth, getServicesByBusiness)

router.get('/', getServices)
router.get('/:id', getService)


module.exports = router;
