const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

// ================================================================
// CONFIGURAÇÃO
// ================================================================
const API_BASE_URL = 'http://localhost:3000';

const userDataPath = app.getPath('userData');
const cacheDir = path.join(userDataPath, 'cache');
const imagesDir = path.join(cacheDir, 'images');

[cacheDir, imagesDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ================================================================
// CRIA A JANELA
// ================================================================
let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        title: 'Galeria IFPR',
        icon: path.join(__dirname, 'build', 'icon.ico'),  // ← ícone da janela
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ================================================================
// IPC: CACHE DE DADOS
// ================================================================
ipcMain.handle('cache:save', async (event, key, data) => {
    try {
        const file = path.join(cacheDir, `${key}.json`);
        fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
        return { success: true };
    } catch (err) {
        console.error('Erro ao salvar cache:', err);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('cache:load', async (event, key) => {
    try {
        const file = path.join(cacheDir, `${key}.json`);
        if (!fs.existsSync(file)) return { success: true, data: null };
        const raw = fs.readFileSync(file, 'utf-8');
        return { success: true, data: JSON.parse(raw) };
    } catch (err) {
        console.error('Erro ao ler cache:', err);
        return { success: false, error: err.message };
    }
});

// ================================================================
// IPC: CACHE DE IMAGENS
// ================================================================
ipcMain.handle('image:download', async (event, url) => {
    try {
        const filename = url.split('/').pop().split('?')[0];
        const localPath = path.join(imagesDir, filename);
        if (fs.existsSync(localPath)) {
            return { success: true, path: localPath };
        }

        const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
        const buffer = await downloadFile(fullUrl);
        fs.writeFileSync(localPath, buffer);
        return { success: true, path: localPath };
    } catch (err) {
        console.error('Erro ao baixar imagem:', err.message);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('image:exists', async (event, url) => {
    try {
        const filename = url.split('/').pop().split('?')[0];
        const localPath = path.join(imagesDir, filename);
        return { exists: fs.existsSync(localPath), path: fs.existsSync(localPath) ? localPath : null };
    } catch {
        return { exists: false, path: null };
    }
});

function downloadFile(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, (res) => {
            if (res.statusCode !== 200) {
                return reject(new Error(`HTTP ${res.statusCode}`));
            }
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve(Buffer.concat(chunks)));
        }).on('error', reject);
    });
}

// ================================================================
// IPC: PING NA API
// ================================================================
ipcMain.handle('api:ping', async () => {
    return new Promise((resolve) => {
        const req = http.get(`${API_BASE_URL}/`, { timeout: 3000 }, (res) => {
            resolve({ online: res.statusCode === 200 });
        });
        req.on('error', () => resolve({ online: false }));
        req.on('timeout', () => {
            req.destroy();
            resolve({ online: false });
        });
    });
});