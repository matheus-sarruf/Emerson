const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middlewares/auth');

router.get('/list', authMiddleware, adminController.list);
router.post('/create', authMiddleware, adminController.create);
router.delete('/:id', authMiddleware, adminController.delete);

module.exports = router;