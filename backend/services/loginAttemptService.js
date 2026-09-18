const LoginAttempt = require('../models/LoginAttempt');

const MAX_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
const BLOCK_TIME_MS = (parseInt(process.env.BLOCK_TIME_MINUTES) || 5) * 60 * 1000;

/**
 * Verifica se um nome está bloqueado.
 * Retorna { blocked: true, remainingMinutes } ou { blocked: false }
 */
async function checkBlocked(name) {
  const record = await LoginAttempt.findOne({ where: { name } });
  if (!record || !record.blockedUntil) return { blocked: false };

  if (record.blockedUntil > new Date()) {
    const remainingMs = record.blockedUntil - new Date();
    const remainingMinutes = Math.ceil(remainingMs / 60000);
    return { blocked: true, remainingMinutes };
  }

  // Bloqueio expirou, reseta
  record.blockedUntil = null;
  record.count = 0;
  await record.save();
  return { blocked: false };
}

/**
 * Registra uma tentativa falha. Retorna quantas faltam ou se bloqueou.
 */
async function registerFailure(name) {
  let record = await LoginAttempt.findOne({ where: { name } });
  if (!record) {
    record = await LoginAttempt.create({ name, count: 0 });
  }

  record.count += 1;

  if (record.count >= MAX_ATTEMPTS) {
    record.blockedUntil = new Date(Date.now() + BLOCK_TIME_MS);
    await record.save();
    return { blocked: true, remainingMinutes: BLOCK_TIME_MS / 60000 };
  }

  await record.save();
  return { blocked: false, attemptsLeft: MAX_ATTEMPTS - record.count };
}

/**
 * Limpa tentativas após login bem-sucedido.
 */
async function clearAttempts(name) {
  await LoginAttempt.destroy({ where: { name } });
}

module.exports = { checkBlocked, registerFailure, clearAttempts };