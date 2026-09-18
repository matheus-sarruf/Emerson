const Student = require('../models/Student');
const path = require('path');
const fs = require('fs');

// Listar estudantes (com filtro por turma e sem admins)
exports.list = async (req, res) => {
  const { year } = req.query;
  const where = { deletedAt: null };
  if (year) where.yearClass = year;

  try {
    const students = await Student.findAll({ where, order: [['name', 'ASC']] });
    // Remove campos sensíveis (não há, mas podemos mapear)
    res.json(students);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao listar estudantes' });
  }
};

// Criar estudante
exports.create = async (req, res) => {
  const { name, yearClass } = req.body;
  if (!name || !yearClass) {
    return res.status(400).json({ error: 'Nome e turma são obrigatórios' });
  }

  let image = '';
  if (req.file) {
    image = `/uploads/${yearClass}/${req.file.filename}`;
  } else if (req.body.imageUrl) {
    image = req.body.imageUrl;
  }

  try {
    const student = await Student.create({
      name: name.trim(),
      yearClass,
      image: image || 'https://placehold.co/400x240?text=Estudante+IFPR',
    });
    res.status(201).json(student);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar estudante' });
  }
};

// Atualizar estudante
exports.update = async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, yearClass } = req.body;

  try {
    const student = await Student.findByPk(id);
    if (!student) {
      return res.status(404).json({ error: 'Estudante não encontrado' });
    }

    if (name) student.name = name.trim();
    if (yearClass) student.yearClass = yearClass;

    if (req.file) {
      // Remove imagem antiga (se não for URL externa)
      if (student.image && !student.image.startsWith('http')) {
        const oldPath = path.join(__dirname, '..', student.image);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      student.image = `/uploads/${yearClass || student.yearClass}/${req.file.filename}`;
    } else if (req.body.imageUrl) {
      student.image = req.body.imageUrl;
    }

    await student.save();
    res.json(student);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao atualizar estudante' });
  }
};

// Deletar (soft delete)
exports.delete = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const student = await Student.findByPk(id);
    if (!student) {
      return res.status(404).json({ error: 'Estudante não encontrado' });
    }
    // Se quiser apagar o arquivo físico, faça aqui (mas com soft delete, mantemos)
    await student.destroy(); // como paranoid: true, seta deletedAt
    res.json({ message: 'Estudante removido com sucesso' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao excluir estudante' });
  }
};

// Deletar todos por turma (físico, mas com soft delete também)
exports.deleteByYear = async (req, res) => {
  const { year } = req.query;
  if (!year) {
    return res.status(400).json({ error: 'Parâmetro year obrigatório' });
  }

  try {
    const students = await Student.findAll({ where: { yearClass: year, deletedAt: null } });
    for (let s of students) {
      // Remove imagem se for local
      if (s.image && !s.image.startsWith('http')) {
        const imagePath = path.join(__dirname, '..', s.image);
        if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
      }
      await s.destroy(); // soft delete
    }
    res.json({ message: `${students.length} estudantes removidos da turma ${year}` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao excluir turma' });
  }
};

// Promover estudantes
exports.promote = async (req, res) => {
  const { fromClass, toClass } = req.body;
  if (!fromClass || !toClass) {
    return res.status(400).json({ error: 'fromClass e toClass são obrigatórios' });
  }

  try {
    const [updated] = await Student.update(
      { yearClass: toClass },
      { where: { yearClass: fromClass, deletedAt: null } }
    );
    res.json({ message: `${updated} estudantes promovidos de ${fromClass} para ${toClass}` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao promover estudantes' });
  }
};