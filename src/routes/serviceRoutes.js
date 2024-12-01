const express = require('express');
const { createService, updateService, deleteService, getServices, getService } = require('../controllers/serviceController');
const auth = require('../middleware/auth');
const upload = require('../middleware/multer.middleware');
const router = express.Router();


router.post('/',  upload.array('images', 5), createService);
router.put('/:id', auth, upload.array('images', 5), updateService);
router.delete('/:id', auth, deleteService);

router.get('/' , getServices)
router.get('/:id' , getService)


module.exports = router;
