// ================================================================
// GALERIA IFPR — DESKTOP (Electron) - REFATORADO
// ================================================================

// ================================================================
// 1. CONFIGURAÇÃO E ESTADO GLOBAL
// ================================================================
const API_BASE_URL = 'http://localhost:3000';

let isOnline = navigator.onLine;
let currentStudents = [];
let activeFilter = "todos";
let searchTerm = "";
let currentUser = null;
let authToken = localStorage.getItem('authToken');

// ================================================================
// 2. ELEMENTOS DO DOM (Centralizados)
// ================================================================
const DOM = {
    galeria: document.getElementById("galeriaContainer"),
    filtros: document.querySelectorAll("#filtrosContainer button"),
    studentCount: document.getElementById("studentCount"),
    addFormPanel: document.getElementById("addFormPanel"),
    showFormBtn: document.getElementById("showFormBtn"),
    confirmAddBtn: document.getElementById("confirmAddBtn"),
    studentName: document.getElementById("studentName"),
    studentYear: document.getElementById("studentYear"),
    imageUrl: document.getElementById("imageUrl"),
    imageUpload: document.getElementById("imageUpload"),
    dynamicActionBtn: document.getElementById("dynamicActionBtn"),
    modal: document.getElementById("customModal"),
    modalTitle: document.getElementById("modalTitle"),
    modalMessage: document.getElementById("modalMessage"),
    modalConfirmBtn: document.getElementById("modalConfirmBtn"),
    modalCancelBtn: document.getElementById("modalCancelBtn"),
    loginModal: document.getElementById("loginModal"),
    loginName: document.getElementById("loginName"),
    loginPassword: document.getElementById("loginPassword"),
    loginForm: document.getElementById("loginForm"),
    loginBtn: document.getElementById("loginBtn"),
    logoutBtn: document.getElementById("logoutBtn"),
    profileBtn: document.getElementById("profileBtn"),
    userInfo: document.getElementById("userInfo"),
    profileModal: document.getElementById("profileModal"),
    profileForm: document.getElementById("profileForm"),
    profileName: document.getElementById("profileName"),
    profileCurrentPassword: document.getElementById("profileCurrentPassword"),
    profileNewPassword: document.getElementById("profileNewPassword"),
    profileConfirmPassword: document.getElementById("profileConfirmPassword"),
    profilePreview: document.getElementById("profilePreview"),
    profileImageUpload: document.getElementById("profileImageUpload"),
    createAdminBtn: document.getElementById("createAdminBtn"),
    newAdminName: document.getElementById("newAdminName"),
    newAdminPassword: document.getElementById("newAdminPassword"),
    toggleAdminPanelBtn: document.getElementById("toggleAdminPanelBtn"),
    adminPanel: document.getElementById("adminPanel"),
    adminList: document.getElementById("adminList"),
    searchInput: document.getElementById("searchInput"),
    themeToggle: document.getElementById("themeToggle"),
    offlineBanner: document.getElementById("offlineBanner")
};

// ================================================================
// 3. SISTEMA DE MODAL UNIFICADO (Substitui alert() e confirm())
// ================================================================
/**
 * Exibe um modal customizado e retorna uma Promise.
 * @param {string} title - Título do modal
 * @param {string} message - Mensagem do modal
 * @param {boolean} isConfirm - Se true, mostra o botão Cancelar
 * @returns {Promise<boolean>} - Resolve true se confirmado, false se cancelado
 */
function showMessage(title, message, isConfirm = false) {
    return new Promise((resolve) => {
        if (!DOM.modal) {
            console.error("ERRO: O elemento #customModal não foi encontrado.");
            return resolve(window.confirm(`${title}\n${message}`));
        }

        DOM.modalTitle.innerText = title;
        DOM.modalMessage.innerText = message;
        DOM.modalCancelBtn.style.display = isConfirm ? 'inline-block' : 'none';
        DOM.modal.style.display = 'flex';

        // Remove eventos antigos para não acumular
        DOM.modalConfirmBtn.onclick = null;
        DOM.modalCancelBtn.onclick = null;

        DOM.modalConfirmBtn.onclick = () => {
            DOM.modal.style.display = 'none';
            resolve(true);
        };

        DOM.modalCancelBtn.onclick = () => {
            DOM.modal.style.display = 'none';
            resolve(false);
        };
    });
}

// ================================================================
// 4. AUTENTICAÇÃO (Login / Logout)
// ================================================================
async function login(name, password) {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, password })
        });
        const data = await response.json();

        if (data.success) {
            currentUser = data.user;
            authToken = data.token;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));

            renderUI();
            closeLoginModal();

            // Aguarda o carregamento dos dados antes de liberar a tela
            await loadStudents();
            await loadAdmins();
        } else {
            await showMessage('Erro', data.error || 'Credenciais inválidas');
            DOM.loginPassword.focus();
        }
    } catch (error) {
        console.error(error);
        await showMessage('Erro', 'Erro ao fazer login. Verifique se o servidor está rodando.');
        DOM.loginPassword.focus();
    }
}

function logout() {
    currentUser = null;
    authToken = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');

    renderUI();
    renderGallery(); // Apenas redesenha a tela com os dados locais, sem buscar no servidor
    showMessage('Sucesso', 'Logout realizado com sucesso');
}

function handleUnauthorized() {
    showMessage('Sessão Expirada', 'Sua sessão expirou. Faça login novamente.').then(() => {
        logout();
        showLoginModal();
    });
}

function showLoginModal() {
    DOM.loginModal.style.display = 'flex';
    DOM.loginName.focus();
}

function closeLoginModal() {
    DOM.loginModal.style.display = 'none';
}

// ================================================================
// 5. CACHE E CONECTIVIDADE
// ================================================================
window.addEventListener('online', () => {
    isOnline = true;
    updateOfflineUI();
    syncWithServer();
});

window.addEventListener('offline', () => {
    isOnline = false;
    updateOfflineUI();
});

function updateOfflineUI() {
    if (DOM.offlineBanner) {
        DOM.offlineBanner.style.display = isOnline ? 'none' : 'block';
    }

    document.querySelectorAll('.admin-only').forEach(el => {
        // NUNCA desabilita os campos de login, mesmo offline
        if (el.id === 'loginName' || el.id === 'loginPassword' || el.id === 'loginBtn' || el.closest('#loginModal')) {
            el.disabled = false;
            el.style.opacity = '1';
            el.style.cursor = 'pointer';
            return;
        }

        el.disabled = !isOnline;
        el.style.opacity = isOnline ? '1' : '0.5';
        el.style.cursor = isOnline ? 'pointer' : 'not-allowed';
    });
}

async function saveCache(key, data) {
    if (window.desktopAPI) {
        await window.desktopAPI.saveCache(key, data);
    } else {
        localStorage.setItem(`cache_${key}`, JSON.stringify(data));
    }
}

async function loadCache(key) {
    if (window.desktopAPI) {
        const result = await window.desktopAPI.loadCache(key);
        return result.success ? result.data : null;
    }
    const raw = localStorage.getItem(`cache_${key}`);
    return raw ? JSON.parse(raw) : null;
}

async function cacheImage(url) {
    if (!window.desktopAPI) return null;
    const result = await window.desktopAPI.downloadImage(url);
    return result.success ? result.path : null;
}

async function getCachedImage(url) {
    if (!window.desktopAPI) return null;
    const result = await window.desktopAPI.imageExists(url);
    return result.exists ? result.path : null;
}

// ================================================================
// 6. FUNÇÕES AUXILIARES
// ================================================================
function getYearLabel(yearClass) {
    const map = { "1ano": "1º Ano", "2ano": "2º Ano", "3ano": "3º Ano", "4ano": "4º Ano" };
    return map[yearClass] || "Turma";
}

function getImageUrl(image) {
    if (!image) return 'https://placehold.co/400x240?text=Sem+Imagem';
    if (image.startsWith('http')) return image;
    return `${API_BASE_URL}${image}`;
}

async function getImageUrlSmart(image) {
    if (!image) return 'https://placehold.co/400x240?text=Sem+Imagem';
    if (image.startsWith('http')) return image;

    if (!isOnline && window.desktopAPI) {
        const cached = await getCachedImage(image);
        if (cached) return `file://${cached}`;
    }
    return `${API_BASE_URL}${image}`;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function (m) {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return map[m];
    });
}

function authHeaders(extra = {}) {
    return { ...extra, 'Authorization': `Bearer ${authToken}` };
}

// ================================================================
// 7. RENDERIZAÇÃO DA UI
// ================================================================
function renderUI() {
    const isAdmin = currentUser && currentUser.role === 'admin';

    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = isAdmin ? 'inline-flex' : 'none';
    });

    if (DOM.adminPanel && DOM.toggleAdminPanelBtn) {
        DOM.adminPanel.style.display = 'none';
        if (isAdmin) {
            DOM.toggleAdminPanelBtn.innerHTML = '<i class="fas fa-user-cog"></i> Gerenciar Admins';
            DOM.toggleAdminPanelBtn.style.background = 'var(--btn-warning)';
        }
    }

    if (currentUser) {
        DOM.loginBtn.style.display = 'none';
        DOM.logoutBtn.style.display = 'inline-flex';
        DOM.profileBtn.style.display = 'inline-flex';
        DOM.userInfo.style.display = 'inline';

        let photoHtml = currentUser.profileImage
            ? `<img src="${getImageUrl(currentUser.profileImage)}" style="width:28px; height:28px; border-radius:50%; object-fit:cover; vertical-align:middle; margin-right:5px;">`
            : `<i class="fas fa-user-shield" style="vertical-align:middle; margin-right:5px;"></i>`;

        DOM.userInfo.innerHTML = `${photoHtml} ${escapeHtml(currentUser.name)}`;
    } else {
        DOM.loginBtn.style.display = 'inline-flex';
        DOM.logoutBtn.style.display = 'none';
        DOM.profileBtn.style.display = 'none';
        DOM.userInfo.style.display = 'none';
    }
}

function highlightActiveFilterButton() {
    DOM.filtros.forEach(btn => {
        const filterVal = btn.getAttribute("data-filter");
        if ((activeFilter === "todos" && filterVal === "todos") || filterVal === activeFilter) {
            btn.classList.add("ativo");
        } else {
            btn.classList.remove("ativo");
        }
    });
}

function updateDynamicButton() {
    if (activeFilter === "todos" || !currentUser || currentUser.role !== 'admin') {
        DOM.dynamicActionBtn.style.display = "none";
        return;
    }
    DOM.dynamicActionBtn.style.display = "inline-flex";

    const actions = {
        "1ano": { label: 'Promover 1º para 2º Ano', cls: "btn-dynamic promote", fn: () => promoteYear("1ano", "2ano", "1º ano", "2º ano") },
        "2ano": { label: 'Promover 2º para 3º Ano', cls: "btn-dynamic promote", fn: () => promoteYear("2ano", "3ano", "2º ano", "3º ano") },
        "3ano": { label: 'Promover 3º para 4º Ano', cls: "btn-dynamic promote", fn: () => promoteYear("3ano", "4ano", "3º ano", "4º ano") },
        "4ano": { label: 'Excluir todos do 4º Ano', cls: "btn-dynamic delete-fourth", fn: () => deleteAllByYear("4ano", "4º ano") },
    };

    const action = actions[activeFilter];
    if (action) {
        const icon = activeFilter === "4ano" ? 'fa-trash-alt' : 'fa-arrow-right';
        DOM.dynamicActionBtn.innerHTML = `<i class="fas ${icon}"></i> ${action.label}`;
        DOM.dynamicActionBtn.className = action.cls;
        DOM.dynamicActionBtn.onclick = action.fn;
    }
}

async function renderGallery() {
    let filtered = [...currentStudents];

    if (activeFilter !== "todos") filtered = filtered.filter(s => s.yearClass === activeFilter);
    if (searchTerm.trim() !== "") {
        const term = searchTerm.trim().toLowerCase();
        filtered = filtered.filter(s => s.name.toLowerCase().includes(term));
    }

    DOM.studentCount.innerHTML = `<i class="fas fa-user-graduate"></i> ${filtered.length} estudantes exibidos`;

    if (filtered.length === 0) {
        DOM.galeria.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:50px; background:var(--bg-surface); border-radius:32px;">
                                    <i class="fas fa-user-slash" style="font-size:3rem; opacity:0.5;"></i>
                                    <p>Nenhum estudante nesta turma. Adicione novos!</p>
                                </div>`;
        highlightActiveFilterButton();
        return;
    }

    const isAdmin = currentUser && currentUser.role === 'admin';
    const imageUrls = await Promise.all(filtered.map(s => getImageUrlSmart(s.image)));

    let html = "";
    filtered.forEach((student, i) => {
        html += `<div class="card" data-id="${student.id}">
                    <img class="card-img" src="${imageUrls[i]}" alt="${escapeHtml(student.name)}" onerror="this.onerror=null; this.src='https://placehold.co/400x240?text=Sem+Imagem';">
                    <div class="info">
                        <h3>${escapeHtml(student.name)}</h3>
                        <p>${getYearLabel(student.yearClass)}</p>
                        ${isAdmin ? `<button class="delete-btn" data-id="${student.id}" title="Remover estudante"><i class="fas fa-trash-alt"></i></button>` : ''}
                    </div>
                </div>`;
    });

    DOM.galeria.innerHTML = html;
    highlightActiveFilterButton();
    updateDynamicButton();
}

// ================================================================
// 8. CRUD DE ESTUDANTES E DADOS
// ================================================================
async function loadStudents() {
    if (!isOnline) {
        const cached = await loadCache('students');
        if (cached && Array.isArray(cached)) {
            currentStudents = cached;
            renderGallery();
        } else {
            DOM.galeria.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:50px;">
                <i class="fas fa-wifi" style="font-size:3rem; opacity:0.5;"></i>
                <p>Sem conexão e sem dados salvos.</p>
            </div>`;
        }
        return;
    }

    try {
        const url = activeFilter === 'todos' ? `${API_BASE_URL}/students` : `${API_BASE_URL}/students?year=${activeFilter}`;
        const response = await fetch(url);
        const data = await response.json();
        currentStudents = data;

        await saveCache('students', data);

        // Baixa as imagens APENAS se não estiverem no cache
        data.forEach(async student => {
            if (student.image && !student.image.startsWith('http')) {
                const cached = await getCachedImage(student.image);
                if (!cached) {
                    cacheImage(student.image);
                }
            }
        });

        renderGallery();
    } catch (error) {
        console.error("Erro ao carregar alunos:", error);
        const cached = await loadCache('students');
        if (cached) {
            currentStudents = cached;
            renderGallery();
        } else {
            showMessage("Erro", "Não foi possível conectar ao servidor.");
        }
    }
}

async function syncWithServer() {
    console.log('Reconectado. Sincronizando...');
    await loadStudents();
    if (currentUser && currentUser.role === 'admin') await loadAdmins();
}

async function addStudentToServer(name, yearClass, imageBase64, file) {
    if (!isOnline) {
        await showMessage('Offline', 'Você está offline. Conecte-se para adicionar estudantes.');
        return false;
    }
    const formData = new FormData();
    formData.append('name', name);
    formData.append('yearClass', yearClass);

    if (file) formData.append('image', file);
    else if (imageBase64 && imageBase64.trim() !== '') formData.append('imageUrl', imageBase64);

    try {
        const response = await fetch(`${API_BASE_URL}/students`, {
            method: 'POST',
            headers: authHeaders(),
            body: formData
        });

        if (response.status === 401) return handleUnauthorized();

        if (response.ok) {
            await loadStudents();
            return true;
        } else {
            const err = await response.json();
            await showMessage("Erro", "Erro ao adicionar: " + (err.error || 'Erro desconhecido'));
            return false;
        }
    } catch (error) {
        console.error(error);
        await showMessage("Erro", "Erro de rede.");
        return false;
    }
}

async function deleteStudentById(id) {
    if (!isOnline) return showMessage('Offline', 'Você está offline. Conecte-se para remover estudantes.');
    const student = currentStudents.find(s => s.id === id);
    if (!student) return;

    const confirm = await showMessage("Remover estudante", `Deseja remover ${student.name} da galeria?`, true);
    if (!confirm) return;

    try {
        const response = await fetch(`${API_BASE_URL}/students/${id}`, {
            method: 'DELETE',
            headers: authHeaders()
        });
        if (response.status === 401) return handleUnauthorized();
        await loadStudents();
    } catch (error) {
        console.error(error);
    }
}

async function promoteYear(fromClass, toClass, fromLabel, toLabel) {
    if (!isOnline) return showMessage('Offline', 'Você está offline. Conecte-se para promover turmas.');
    const studentsToPromote = currentStudents.filter(s => s.yearClass === fromClass);

    if (studentsToPromote.length === 0) {
        await showMessage("Nenhum estudante", `Não há estudantes no ${fromLabel} para promover.`);
        return;
    }

    const confirm = await showMessage("Promover turma", `Promover ${studentsToPromote.length} estudante(s) do ${fromLabel} para o ${toLabel}?`, true);
    if (!confirm) return;

    try {
        const response = await fetch(`${API_BASE_URL}/students/promote`, {
            method: 'POST',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ fromClass, toClass })
        });
        if (response.status === 401) return handleUnauthorized();
        activeFilter = "todos";
        await loadStudents();
    } catch (error) {
        console.error(error);
    }
}

async function deleteAllByYear(yearClass, yearLabel) {
    if (!isOnline) return showMessage('Offline', 'Você está offline. Conecte-se para excluir turmas.');
    const studentsToDelete = currentStudents.filter(s => s.yearClass === yearClass);

    if (studentsToDelete.length === 0) {
        await showMessage("Nenhum estudante", `Não há estudantes no ${yearLabel}.`);
        return;
    }

    const confirm = await showMessage("Excluir todos", `Tem certeza que deseja excluir TODOS os ${studentsToDelete.length} estudante(s) do ${yearLabel}?`, true);
    if (!confirm) return;

    try {
        const response = await fetch(`${API_BASE_URL}/students?year=${yearClass}`, {
            method: 'DELETE',
            headers: authHeaders()
        });
        if (response.status === 401) return handleUnauthorized();
        if (activeFilter === yearClass) activeFilter = "todos";
        await loadStudents();
    } catch (error) {
        console.error(error);
    }
}

function setFilter(filter) {
    activeFilter = filter;
    loadStudents();
}

// ================================================================
// 9. GERENCIAMENTO DE ADMINS
// ================================================================
async function loadAdmins() {
    if (!authToken) return;
    try {
        const response = await fetch(`${API_BASE_URL}/admin/list`, { headers: authHeaders() });
        if (response.status === 401) return handleUnauthorized();
        if (!response.ok) return;

        const admins = await response.json();
        if (!DOM.adminList) return;

        if (admins.length === 0) {
            DOM.adminList.innerHTML = '<p style="color:var(--text-secondary);">Nenhum administrador cadastrado.</p>';
            return;
        }

        DOM.adminList.innerHTML = admins.map(admin => {
            const isMaster = admin.id === 1 || admin.id === 2;
            const isSelf = admin.id === currentUser?.id;

            let actionButtons = '';
            if (isMaster) {
                actionButtons = '<span style="font-size:0.7rem; opacity:0.6; background:var(--if-green-light); padding:2px 10px; border-radius:20px;">Master</span>';
            } else if (isSelf) {
                actionButtons = '<span style="font-size:0.8rem; opacity:0.6;">(você)</span>';
            } else {
                actionButtons = `<button onclick="deleteAdmin(${admin.id})" class="delete-btn" style="position:static; background:#c82333; width:28px; height:28px;"><i class="fas fa-trash"></i></button>`;
            }

            return `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:var(--bg-body); border-radius:30px; margin-bottom:5px;">
                    <span><i class="fas fa-user-shield" style="color:var(--if-green);"></i> ${escapeHtml(admin.name)}</span>
                    ${actionButtons}
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error(error);
    }
}

async function deleteAdmin(id) {
    const confirm = await showMessage('Remover Admin', 'Tem certeza que deseja remover este administrador?', true);
    if (!confirm) return;

    try {
        const response = await fetch(`${API_BASE_URL}/admin/${id}`, {
            method: 'DELETE',
            headers: authHeaders()
        });
        if (response.status === 401) return handleUnauthorized();
        if (response.ok) {
            await showMessage('Sucesso', 'Administrador removido!');
            loadAdmins();
        } else {
            const err = await response.json();
            await showMessage('Erro', err.error || 'Erro desconhecido');
        }
    } catch (error) {
        console.error(error);
    }
}

async function createAdmin(name, password) {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/create`, {
            method: 'POST',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ name, password })
        });

        if (response.status === 401) return handleUnauthorized();

        if (response.ok) {
            await showMessage('Sucesso', 'Administrador criado com sucesso!');
            loadAdmins();
            return true;
        } else {
            const err = await response.json();
            await showMessage('Erro', err.error || 'Erro desconhecido');
            return false;
        }
    } catch (error) {
        console.error(error);
        return false;
    }
}

// ================================================================
// 10. PERFIL DO ADMINISTRADOR
// ================================================================
function showProfileModal() {
    if (!currentUser) return;

    DOM.profileName.value = currentUser.name;
    DOM.profileCurrentPassword.value = '';
    DOM.profileNewPassword.value = '';
    DOM.profileConfirmPassword.value = '';
    DOM.profilePreview.src = currentUser.profileImage ? getImageUrl(currentUser.profileImage) : 'https://placehold.co/100x100?text=Admin';
    DOM.profileModal.style.display = 'flex';
}

function closeProfileModal() {
    DOM.profileModal.style.display = 'none';
}

async function updateProfile(name, currentPassword, newPassword) {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/profile`, {
            method: 'PUT',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ newName: name, currentPassword, newPassword })
        });

        const data = await response.json();
        if (response.ok) {
            await showMessage('Sucesso', 'Perfil atualizado com sucesso!');
            currentUser.name = data.user.name;
            currentUser.profileImage = data.user.profileImage;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));

            if (data.token) {
                authToken = data.token;
                localStorage.setItem('authToken', authToken);
            }

            renderUI();
            closeProfileModal();
            loadAdmins();
            return true;
        } else {
            await showMessage('Erro', data.error || 'Erro desconhecido');
            return false;
        }
    } catch (error) {
        console.error(error);
        await showMessage('Erro', 'Erro ao atualizar perfil');
        return false;
    }
}

async function uploadProfileImage(file) {
    if (!file) return;
    const formData = new FormData();
    formData.append('profileImage', file);

    try {
        const response = await fetch(`${API_BASE_URL}/auth/profile/image`, {
            method: 'POST',
            headers: authHeaders(),
            body: formData
        });

        if (response.status === 401) return handleUnauthorized();

        const data = await response.json();
        if (response.ok) {
            currentUser.profileImage = data.profileImage;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            DOM.profilePreview.src = getImageUrl(data.profileImage);
            renderUI();
            await showMessage('Sucesso', 'Foto de perfil atualizada!');
        } else {
            await showMessage('Erro', data.error || 'Erro desconhecido');
        }
    } catch (error) {
        console.error(error);
        await showMessage('Erro', 'Erro ao enviar imagem');
    }
}

// ================================================================
// 11. TEMA E EVENTOS
// ================================================================
function initTheme() {
    if (!DOM.themeToggle) return;

    function applyTheme(isDark) {
        document.body.classList.toggle("dark", isDark);
        DOM.themeToggle.innerHTML = isDark
            ? '<i class="fas fa-sun"></i> <span id="themeText">Modo Claro</span>'
            : '<i class="fas fa-moon"></i> <span id="themeText">Modo Escuro</span>';
        localStorage.setItem("ifpr_theme", isDark ? "dark" : "light");
    }

    applyTheme(localStorage.getItem("ifpr_theme") === "dark");
    DOM.themeToggle.addEventListener("click", () => applyTheme(!document.body.classList.contains("dark")));
}

function setupDelegation() {
    DOM.galeria.addEventListener("click", (e) => {
        const deleteBtn = e.target.closest(".delete-btn");
        if (deleteBtn && deleteBtn.dataset.id) {
            deleteStudentById(parseInt(deleteBtn.dataset.id));
            e.stopPropagation();
        }
    });
}

function initEventListeners() {
    DOM.filtros.forEach(btn => btn.addEventListener("click", () => setFilter(btn.getAttribute("data-filter"))));

    if (DOM.profileBtn) DOM.profileBtn.addEventListener('click', showProfileModal);

    if (DOM.profileForm) {
        DOM.profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = DOM.profileName.value.trim();
            const currentPassword = DOM.profileCurrentPassword.value;
            const newPassword = DOM.profileNewPassword.value;
            const confirmPassword = DOM.profileConfirmPassword.value;

            if (!name) return showMessage('Aviso', 'Nome não pode ficar vazio');
            if (newPassword && newPassword !== confirmPassword) return showMessage('Aviso', 'Nova senha e confirmação não coincidem');
            if (newPassword && !currentPassword) return showMessage('Aviso', 'Para mudar a senha, informe a senha atual');

            await updateProfile(name, currentPassword, newPassword || '');
        });
    }

    if (DOM.profileImageUpload) {
        DOM.profileImageUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                uploadProfileImage(file);
                e.target.value = '';
            }
        });
    }

    if (DOM.showFormBtn) {
        DOM.showFormBtn.addEventListener("click", () => {
            const isOpen = DOM.addFormPanel.style.display === "block";
            DOM.addFormPanel.style.display = isOpen ? "none" : "block";
            DOM.showFormBtn.innerHTML = isOpen
                ? '<i class="fas fa-plus-circle"></i> Novo Estudante'
                : '<i class="fas fa-minus-circle"></i> Fechar Formulário';
        });
    }

    if (DOM.confirmAddBtn) {
        DOM.confirmAddBtn.addEventListener("click", async () => {
            const name = DOM.studentName.value.trim();
            const year = DOM.studentYear.value;
            const urlImage = DOM.imageUrl.value.trim();
            const file = DOM.imageUpload.files[0];

            if (!name) return showMessage("Campo obrigatório", "Por favor, informe o nome do estudante.");

            const success = await addStudentToServer(name, year, urlImage, file);
            if (success) {
                DOM.studentName.value = "";
                DOM.imageUrl.value = "";
                DOM.imageUpload.value = "";
                DOM.addFormPanel.style.display = "none";
                DOM.showFormBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Novo Estudante';
            }
        });
    }

    if (DOM.loginBtn) DOM.loginBtn.addEventListener('click', showLoginModal);
    if (DOM.logoutBtn) DOM.logoutBtn.addEventListener('click', logout);

    if (DOM.loginForm) {
        DOM.loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await login(DOM.loginName.value, DOM.loginPassword.value);
        });
    }

    if (DOM.createAdminBtn) {
        DOM.createAdminBtn.addEventListener('click', async () => {
            const name = DOM.newAdminName.value.trim();
            const password = DOM.newAdminPassword.value.trim();

            if (!name || !password) return showMessage('Aviso', 'Preencha nome e senha');

            const ok = await createAdmin(name, password);
            if (ok) {
                DOM.newAdminName.value = '';
                DOM.newAdminPassword.value = '';
            }
        });
    }

    if (DOM.toggleAdminPanelBtn && DOM.adminPanel) {
        DOM.toggleAdminPanelBtn.addEventListener('click', () => {
            const isOpen = DOM.adminPanel.style.display === 'block';
            DOM.adminPanel.style.display = isOpen ? 'none' : 'block';
            DOM.toggleAdminPanelBtn.innerHTML = isOpen
                ? '<i class="fas fa-user-cog"></i> Gerenciar Admins'
                : '<i class="fas fa-minus-circle"></i> Fechar Admins';
            DOM.toggleAdminPanelBtn.style.background = isOpen ? 'var(--btn-warning)' : 'var(--btn-danger)';
        });
    }

    if (DOM.searchInput) {
        DOM.searchInput.addEventListener('input', (e) => {
            searchTerm = e.target.value;
            renderGallery();
        });
    }
}

// ================================================================
// 12. INICIALIZAÇÃO
// ================================================================
async function init() {
    try {
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            currentUser = JSON.parse(savedUser);
            authToken = localStorage.getItem('authToken');
        }
    } catch (e) {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('authToken');
    }

    updateOfflineUI();
    await loadStudents();

    renderUI();
    setupDelegation();
    initTheme();
    initEventListeners();

    if (currentUser && currentUser.role === 'admin') {
        loadAdmins();
    }

    setInterval(async () => {
        if (window.desktopAPI) {
            const result = await window.desktopAPI.pingAPI();
            const wasOffline = !isOnline;
            isOnline = result.online;
            updateOfflineUI();
            if (wasOffline && isOnline) syncWithServer();
        }
    }, 30000);
}

init();