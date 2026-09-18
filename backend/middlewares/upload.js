const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Define onde salvar as imagens com base na turma ou perfil
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = 'outros';

    // Combina baseUrl + path para pegar a URL completa (ex: /auth/profile/image)
    const fullUrl = req.baseUrl + req.path;

    if (fullUrl.includes('/profile')) {
      folder = 'profiles';
    } else if (req.body.yearClass) {
      folder = req.body.yearClass;
    } else if (req.params.id) {
      folder = 'alunos';
    }

    const dir = path.join(__dirname, '..', 'uploads', folder);
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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/jpg'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Formato de imagem não suportado'), false);
    }
  }
});

module.exports = upload;