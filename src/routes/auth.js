const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const upload = require('../middleware/multer.middleware');
const auth = require('../middleware/auth');

router.post('/register', upload.single('profilePicture'), authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.put('/edit', auth, upload.single('profilePicture'), authController.editProfile);
router.get('/getUser', authController.getUser);
router.put('/changePassword', auth, authController.changePassword);


module.exports = router;
