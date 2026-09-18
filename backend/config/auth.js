module.exports = {
  jwtSecret: process.env.JWT_SECRET,
  saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10,
  maxAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5,
  blockTime: parseInt(process.env.BLOCK_TIME_MINUTES) * 60 * 1000, // em ms
};