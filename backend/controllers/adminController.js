const Admin = require('../models/Admin');
const bcrypt = require('bcryptjs');

// Listar admins (sem senhas)
exports.list = async (req, res) => {
  try {
    const admins = await Admin.findAll({
      attributes: { exclude: ['password'] },
      order: [['id', 'ASC']]
    });
    res.json(admins);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao listar administradores' });
  }
};

// Criar admin (apenas master)
exports.create = async (req, res) => {
  const { name, password } = req.body;
  if (!name || !password) {
    return res.status(400).json({ error: 'Nome e senha são obrigatórios' });
  }

  try {
    const existing = await Admin.findOne({ where: { name } });
    if (existing) {
      return res.status(400).json({ error: 'Nome já utilizado' });
    }

    const admin = await Admin.create({ name, password }); // hook faz hash
    const { password: _, ...adminWithoutPassword } = admin.toJSON();
    res.status(201).json({ success: true, user: adminWithoutPassword });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar administrador' });
  }
};

// Deletar admin
exports.delete = async (req, res) => {
  const id = parseInt(req.params.id);

  // Proteger admins mestres (ids 1 e 2, por exemplo)
  if (id <= 2) {
    return res.status(403).json({ error: 'Administrador master não pode ser removido' });
  }

  if (id === req.admin.id) {
    return res.status(400).json({ error: 'Você não pode remover a si mesmo' });
  }

  try {
    const admin = await Admin.findByPk(id);
    if (!admin) {
      return res.status(404).json({ error: 'Administrador não encontrado' });
    }
    await admin.destroy();
    res.json({ success: true, message: 'Administrador removido' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao excluir administrador' });
  }
};