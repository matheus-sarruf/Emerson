require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const sequelize = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const syncRoutes = require('./routes/syncRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares

//app.use(cors())

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

// Iniciar servidor e sincronizar banco
sequelize.sync({ alter: true }) // cuidado: em produção, use migrations
  .then(() => {
    console.log('Banco de dados conectado e sincronizado.');
    app.listen(PORT, () => {
      console.log(`Servidor rodando em http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Erro ao conectar ao banco:', err);
  });