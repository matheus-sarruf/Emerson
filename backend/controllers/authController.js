const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const Admin = require('../models/Admin');
const { jwtSecret } = require('../config/auth');
const { maxAttempts, blockTime } = require('../config/auth');
const loginAttemptService = require('../services/loginAttemptService');

exports.login = async (req, res) => {
  const { name, password } = req.body;
  if (!name || !password) {
    return res.status(400).json({ error: 'Nome e senha são obrigatórios' });
  }

  // Verifica bloqueio
  const blockStatus = await loginAttemptService.checkBlocked(name);
  if (blockStatus.blocked) {
    return res.status(429).json({
      error: `Conta bloqueada. Tente novamente em ${blockStatus.remainingMinutes} minuto(s).`,
      blocked: true,
      remainingMinutes: blockStatus.remainingMinutes
    });
  }

  try {
    const admin = await Admin.findOne({ where: { name } });
    if (!admin) {
      const failStatus = await loginAttemptService.registerFailure(name);
      if (failStatus.blocked) {
        return res.status(401).json({
          error: 'Muitas tentativas. Conta bloqueada por 5 minutos.',
          blocked: true,
          remainingMinutes: failStatus.remainingMinutes
        });
      }
      return res.status(401).json({
        error: `Credenciais inválidas. Tentativas restantes: ${failStatus.attemptsLeft}`,
        attemptsLeft: failStatus.attemptsLeft
      });
    }

    // Verifica senha
    const valid = await admin.comparePassword(password);
    if (!valid) {
      const failStatus = await loginAttemptService.registerFailure(name);
      if (failStatus.blocked) {
        return res.status(401).json({
          error: 'Muitas tentativas. Conta bloqueada por 5 minutos.',
          blocked: true,
          remainingMinutes: failStatus.remainingMinutes
        });
      }
      return res.status(401).json({
        error: `Credenciais inválidas. Tentativas restantes: ${failStatus.attemptsLeft}`,
        attemptsLeft: failStatus.attemptsLeft
      });
    }

    // Login OK: limpa tentativas
    await loginAttemptService.clearAttempts(name);

    const token = jwt.sign(
      { id: admin.id, name: admin.name },
      jwtSecret,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: admin.id,
        name: admin.name,
        role: admin.role,
        profileImage: admin.profileImage || null
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno' });
  }
};


exports.updateProfile = async (req, res) => {
  const { newName, currentPassword, newPassword } = req.body;
  const admin = req.admin;

  try {
    if (newName && newName !== admin.name) {
      const exists = await Admin.findOne({ where: { name: newName } });
      if (exists) {
        return res.status(400).json({ error: 'Nome de administrador já existe' });
      }
      admin.name = newName;
    }

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Para mudar a senha, informe a senha atual' });
      }
      const valid = await admin.comparePassword(currentPassword);
      if (!valid) {
        return res.status(401).json({ error: 'Senha atual incorreta' });
      }
      admin.password = newPassword; // O hook fará o hash
    }

    await admin.save();

    // Gera novo token com nome atualizado
    const token = jwt.sign(
      { id: admin.id, name: admin.name },
      jwtSecret,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: admin.id,
        name: admin.name,
        profileImage: admin.profileImage || null
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao atualizar perfil' });
  }
};

exports.uploadProfileImage = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhuma imagem enviada' });
  }

  try {
    const admin = req.admin;
    // Remove imagem antiga se existir (opcional)
    if (admin.profileImage) {
      const oldPath = path.join(__dirname, '..', admin.profileImage);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    admin.profileImage = `/uploads/profiles/${req.file.filename}`;
    await admin.save();

    res.json({
      success: true,
      profileImage: admin.profileImage
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao salvar imagem' });
  }
};