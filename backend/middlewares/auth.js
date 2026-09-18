const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/auth');
const Admin = require('../models/Admin');

module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, jwtSecret);
    const admin = await Admin.findByPk(decoded.id);
    if (!admin) {
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }
    req.admin = admin;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' });
  }
};