const Student = require('../models/Student');
const { Op } = require('sequelize');

exports.sync = async (req, res) => {
  const since = parseInt(req.query.since) || 0;
  const sinceDate = new Date(since);

  try {
    // Buscar estudantes alterados (criados ou atualizados) após a data
    const changed = await Student.findAll({
      where: {
        updatedAt: { [Op.gt]: sinceDate },
        deletedAt: null
      }
    });

    // Buscar IDs de estudantes deletados após a data (se usarmos deletedAt)
    const deleted = await Student.findAll({
      attributes: ['id'],
      where: {
        deletedAt: { [Op.gt]: sinceDate }
      },
      paranoid: false // permite buscar registros com deletedAt not null
    });
    const deletedIds = deleted.map(s => s.id);

    // Também podemos enviar todos os estudantes se since for 0 (primeira sincronização)
    // Mas o app pode fazer uma requisição inicial sem since para pegar todos

    res.json({
      changed,
      deletedIds
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro na sincronização' });
  }
};