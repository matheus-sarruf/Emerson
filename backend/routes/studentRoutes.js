const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const authMiddleware = require('../middlewares/auth');
const upload = require('../middlewares/upload');

// Rotas públicas (leitura)
router.get('/', studentController.list);

// Rotas protegidas (escrita)
router.post('/', authMiddleware, upload.single('image'), studentController.create);
router.put('/:id', authMiddleware, upload.single('image'), studentController.update);
router.delete('/:id', authMiddleware, studentController.delete);
router.delete('/', authMiddleware, studentController.deleteByYear); // ?year=...
router.post('/promote', authMiddleware, studentController.promote);

module.exports = router;