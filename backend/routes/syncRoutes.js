const express = require('express');
const router = express.Router();
const syncController = require('../controllers/syncController');
const authMiddleware = require('../middlewares/auth');

router.get('/', authMiddleware, syncController.sync);

module.exports = router;