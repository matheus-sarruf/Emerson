const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// ============================================================
// CONTROLE DE TENTATIVAS DE LOGIN
// ============================================================
const loginAttempts = {};
const MAX_ATTEMPTS = 5;
const BLOCK_TIME = 5 * 60 * 1000;

// ============================================================
// MIDDLEWARES
// ============================================================

app.use((req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', 'true');
  next();
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use('/fotos', express.static('fotos'));

// ============================================================
// CONFIGURAÇÃO DO MULTER
// ============================================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = req.path.includes('/profile') ? 'profiles' : (req.body.yearClass || 'outros');
    const dir = path.join(__dirname, 'uploads', folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, unique + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// ============================================================
// PERSISTÊNCIA
// ============================================================

const DATA_FILE = path.join(__dirname, 'data', 'students.json');

const readData = () => {
  if (!fs.existsSync(DATA_FILE)) {
    const defaultAdmin = {
      id: 1,
      name: 'admin',
      yearClass: 'admin',
      image: 'https://placehold.co/400x240?text=Admin',
      role: 'admin',
      password: 'admin123',
      profileImage: null
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify([defaultAdmin], null, 2));
    return [defaultAdmin];
  }
  const data = fs.readFileSync(DATA_FILE, 'utf8');
  return JSON.parse(data);
};

const writeData = (data) => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
};

// ============================================================
// MIDDLEWARE DE AUTENTICAÇÃO
// ============================================================

const authenticate = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const [userId] = decoded.split(':');
    const students = readData();
    const user = students.find(s => s.id === parseInt(userId) && s.role === 'admin');

    if (!user) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido' });
  }
};

// ============================================================
// ROTA DE LOGIN
// ============================================================

app.post('/login', (req, res) => {
  const { name, password } = req.body;
  const students = readData();

  const attempt = loginAttempts[name];
  if (attempt && attempt.blockedUntil > Date.now()) {
    const remaining = Math.ceil((attempt.blockedUntil - Date.now()) / 60000);
    return res.status(401).json({
      success: false,
      error: `Conta bloqueada. Tente novamente em ${remaining} minuto(s).`,
      blocked: true,
      remainingMinutes: remaining
    });
  }

  const user = students.find(s => s.name === name && s.password === password && s.role === 'admin');

  if (user) {
    delete loginAttempts[name];
    const token = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');
    res.json({
      success: true,
      token: token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        profileImage: user.profileImage || null
      }
    });
  } else {
    if (!loginAttempts[name]) {
      loginAttempts[name] = { attempts: 0, blockedUntil: 0 };
    }
    loginAttempts[name].attempts += 1;

    if (loginAttempts[name].attempts >= MAX_ATTEMPTS) {
      loginAttempts[name].blockedUntil = Date.now() + BLOCK_TIME;
      return res.status(401).json({
        success: false,
        error: `Muitas tentativas. Conta bloqueada por 5 minutos.`,
        blocked: true,
        remainingMinutes: 5
      });
    }

    const remaining = MAX_ATTEMPTS - loginAttempts[name].attempts;
    res.status(401).json({
      success: false,
      error: `Credenciais inválidas. Tentativas restantes: ${remaining}`,
      attemptsLeft: remaining
    });
  }
});

// ============================================================
// ROTA PARA ATUALIZAR PERFIL DO ADMIN
// ============================================================

app.put('/admin/profile', authenticate, (req, res) => {
  const { newName, currentPassword, newPassword } = req.body;
  let students = readData();
  const user = students.find(s => s.id === req.user.id);

  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado' });
  }

  if (newPassword) {
    if (user.password !== currentPassword) {
      return res.status(401).json({ error: 'Senha atual incorreta' });
    }
    user.password = newPassword;
  }

  if (newName && newName !== user.name) {
    if (students.some(s => s.name === newName && s.role === 'admin' && s.id !== user.id)) {
      return res.status(400).json({ error: 'Nome de administrador já existe' });
    }
    user.name = newName;
  }

  writeData(students);
  res.json({
    success: true,
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      profileImage: user.profileImage || null
    }
  });
});

app.post('/admin/profile/image', authenticate, upload.single('profileImage'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhuma imagem enviada' });
  }

  let students = readData();
  const user = students.find(s => s.id === req.user.id);

  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado' });
  }

  if (user.profileImage && user.profileImage.startsWith('/uploads/profiles/')) {
    const oldPath = path.join(__dirname, user.profileImage);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  user.profileImage = `/uploads/profiles/${req.file.filename}`;
  writeData(students);

  res.json({
    success: true,
    profileImage: user.profileImage
  });
});

// ============================================================
// ROTAS PÚBLICAS
// ============================================================

app.get('/students', (req, res) => {
  const { year } = req.query;
  let students = readData();
  students = students.filter(s => s.role !== 'admin').map(({ password, role, ...rest }) => rest);

  if (year) {
    students = students.filter(s => s.yearClass === year);
  }
  res.json(students);
});

// ============================================================
// ROTAS PROTEGIDAS
// ============================================================

app.post('/students', authenticate, upload.single('image'), (req, res) => {
  const { name, yearClass } = req.body;
  if (!name || !yearClass) {
    return res.status(400).json({ error: 'Nome e turma são obrigatórios' });
  }

  const students = readData();
  const newId = students.length ? Math.max(...students.map(s => s.id)) + 1 : 1;

  let imageUrl = '';
  if (req.file) {
    imageUrl = `/uploads/${yearClass}/${req.file.filename}`;
  } else if (req.body.imageUrl) {
    imageUrl = req.body.imageUrl;
  }

  const newStudent = {
    id: newId,
    name: name.trim(),
    yearClass: yearClass,
    image: imageUrl || 'https://placehold.co/400x240?text=Estudante+IFPR',
    role: 'user',
    password: null
  };

  students.push(newStudent);
  writeData(students);
  res.status(201).json(newStudent);
});

app.put('/students/:id', authenticate, upload.single('image'), (req, res) => {
  const id = parseInt(req.params.id);
  const { name, yearClass } = req.body;
  let students = readData();
  const index = students.findIndex(s => s.id === id);
  if (index === -1) return res.status(404).json({ error: 'Estudante não encontrado' });

  if (name) students[index].name = name;
  if (yearClass) students[index].yearClass = yearClass;
  if (req.file) {
    students[index].image = `/uploads/${yearClass || students[index].yearClass}/${req.file.filename}`;
  } else if (req.body.imageUrl) {
    students[index].image = req.body.imageUrl;
  }
  writeData(students);
  res.json(students[index]);
});

app.delete('/students/:id', authenticate, (req, res) => {
  const id = parseInt(req.params.id);
  let students = readData();
  const index = students.findIndex(s => s.id === id);
  if (index === -1) return res.status(404).json({ error: 'Estudante não encontrado' });

  const student = students[index];
  if (student.image && !student.image.startsWith('http')) {
    const imagePath = path.join(__dirname, student.image);
    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
  }

  students.splice(index, 1);
  writeData(students);
  res.json({ message: 'Removido com sucesso' });
});

app.delete('/students', authenticate, (req, res) => {
  const { year } = req.query;
  if (!year) return res.status(400).json({ error: 'Parâmetro year obrigatório' });
  let students = readData();
  const toRemove = students.filter(s => s.yearClass === year && s.role !== 'admin');

  toRemove.forEach(s => {
    if (s.image && !s.image.startsWith('http')) {
      const imagePath = path.join(__dirname, s.image);
      if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    }
  });

  students = students.filter(s => s.yearClass !== year || s.role === 'admin');
  writeData(students);
  res.json({ message: `Removidos ${toRemove.length} estudantes do ${year}` });
});

app.post('/students/promote', authenticate, (req, res) => {
  const { fromClass, toClass } = req.body;
  if (!fromClass || !toClass) {
    return res.status(400).json({ error: 'fromClass e toClass são obrigatórios' });
  }
  let students = readData();
  let promoted = 0;
  students.forEach(s => {
    if (s.yearClass === fromClass && s.role !== 'admin') {
      s.yearClass = toClass;
      promoted++;
    }
  });
  writeData(students);
  res.json({ message: `${promoted} estudantes promovidos de ${fromClass} para ${toClass}` });
});

// ============================================================
// ROTAS DE ADMINISTRAÇÃO
// ============================================================

app.get('/admin/list', authenticate, (req, res) => {
  const students = readData();
  const admins = students.filter(s => s.role === 'admin').map(({ password, ...rest }) => rest);
  res.json(admins);
});

app.post('/admin/create', authenticate, (req, res) => {
  const { name, password } = req.body;
  if (!name || !password) {
    return res.status(400).json({ error: 'Nome e senha são obrigatórios' });
  }

  const students = readData();
  if (students.some(s => s.name === name && s.role === 'admin')) {
    return res.status(400).json({ error: 'Administrador já existe' });
  }

  const newId = students.length ? Math.max(...students.map(s => s.id)) + 1 : 1;
  const newAdmin = {
    id: newId,
    name: name.trim(),
    yearClass: 'admin',
    image: 'https://placehold.co/400x240?text=Admin',
    role: 'admin',
    password: password.trim(),
    profileImage: null
  };

  students.push(newAdmin);
  writeData(students);
  res.status(201).json({ success: true, user: { id: newAdmin.id, name: newAdmin.name, role: newAdmin.role } });
});

app.delete('/admin/:id', authenticate, (req, res) => {
  const id = parseInt(req.params.id);
  let students = readData();

  if (id === 1 || id === 2) {
    return res.status(403).json({ error: 'O administrador master não pode ser removido!' });
  }

  if (id === req.user.id) {
    return res.status(400).json({ error: 'Você não pode remover a si mesmo' });
  }

  const index = students.findIndex(s => s.id === id && s.role === 'admin');
  if (index === -1) {
    return res.status(404).json({ error: 'Administrador não encontrado' });
  }
  students.splice(index, 1);
  writeData(students);
  res.json({ success: true, message: 'Administrador removido' });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  /* console.log(`Maximo de tentativas: ${MAX_ATTEMPTS} (bloqueio de ${BLOCK_TIME / 60000} min)`); */
});