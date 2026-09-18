require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const sequelize = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const syncRoutes = require('./routes/syncRoutes');
const LoginAttempt = require('./models/LoginAttempt');
const { Op } = require('sequelize');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares

//app.use(cors())

setInterval(async () => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const deleted = await LoginAttempt.destroy({
      where: { updatedAt: { [Op.lt]: oneDayAgo } }
    });
    if (deleted > 0) console.log(`Limpeza: ${deleted} tentativas antigas removidas.`);
  } catch (err) {
    console.error('Erro na limpeza de tentativas:', err);
  }
}, 24 * 60 * 60 * 1000);

app.use(cors({
  origin: ['http://localhost:5500', 'http://127.0.0.1:5500'], // <-- alterar
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos (uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rotas
app.use('/auth', authRoutes);
app.use('/students', studentRoutes);
app.use('/admin', adminRoutes);
app.use('/sync', syncRoutes);

// Rota de teste
app.get('/', (req, res) => {
  res.send('API Galeria IFPR - Online');
});

const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('Banco de dados conectado.');

    if (!isProduction) {
      // Em desenvolvimento: sincroniza com alter
      await sequelize.sync({ alter: true });
      console.log('Tabelas sincronizadas (modo dev).');
    } else {
      // Em produção: NÃO mexe no schema. Use migrations.
      console.log('Modo produção: schema não será alterado automaticamente.');
    }

    app.listen(PORT, () => {
      console.log(`Servidor rodando em http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Erro ao iniciar o servidor:', err);
    process.exit(1);
  }
}

startServer();