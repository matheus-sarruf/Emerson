const { maxAttempts, blockTime } = require('../config/auth');

// Armazenamento em memória (para produção, use Redis)
const attempts = {};

module.exports = (req, res, next) => {
  const { name } = req.body;
  if (!name) return next();

  const record = attempts[name] || { count: 0, blockedUntil: 0 };
  if (record.blockedUntil > Date.now()) {
    const remaining = Math.ceil((record.blockedUntil - Date.now()) / 60000);
    return res.status(429).json({
      error: `Conta bloqueada. Tente novamente em ${remaining} minuto(s).`,
      blocked: true,
      remainingMinutes: remaining
    });
  }

  // Se chegou aqui, permite a requisição, mas depois do login (no controller) atualizamos
  req.rateLimit = { record, name };
  next();
};