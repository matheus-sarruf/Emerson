const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopAPI', {
    // Cache de dados
    saveCache: (key, data) => ipcRenderer.invoke('cache:save', key, data),
    loadCache: (key) => ipcRenderer.invoke('cache:load', key),

    // Cache de imagens
    downloadImage: (url) => ipcRenderer.invoke('image:download', url),
    imageExists: (url) => ipcRenderer.invoke('image:exists', url),

    // Testar conexão
    pingAPI: () => ipcRenderer.invoke('api:ping')
});