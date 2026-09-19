const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/auth');
const upload = require('../middlewares/upload');

// Rota de login (adicione esta linha)
router.post('/login', authController.login);

router.put('/profile', authMiddleware, authController.updateProfile);
router.post('/profile/image', authMiddleware, upload.single('profileImage'), authController.uploadProfileImage);

module.exports = router;