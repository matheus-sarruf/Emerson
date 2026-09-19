// ================================================================
// GALERIA IFPR — DESKTOP (Electron)
// Script do renderer (interface)
// ================================================================

// ================================================================
// CONFIGURAÇÃO
// ================================================================
const API_BASE_URL = 'http://localhost:3000';

// ================================================================
// ESTADO GLOBAL
// ================================================================
let isOnline = navigator.onLine;
let currentStudents = [];
let activeFilter = "todos";
let searchTerm = "";
let currentUser = null;
let authToken = localStorage.getItem('authToken');

// ================================================================
// ELEMENTOS DO DOM
// ================================================================
const galeriaDiv = document.getElementById("galeriaContainer");
const filtrosBtns = document.querySelectorAll("#filtrosContainer button");
const studentCountSpan = document.getElementById("studentCount");
const addFormPanel = document.getElementById("addFormPanel");
const showFormBtn = document.getElementById("showFormBtn");
const confirmAddBtn = document.getElementById("confirmAddBtn");
const studentNameInput = document.getElementById("studentName");
const studentYearSelect = document.getElementById("studentYear");
const imageUrlInput = document.getElementById("imageUrl");
const imageUploadInput = document.getElementById("imageUpload");
const dynamicActionBtn = document.getElementById("dynamicActionBtn");
const modal = document.getElementById("customModal");
const modalTitle = document.getElementById("modalTitle");
const modalMessage = document.getElementById("modalMessage");
const modalConfirmBtn = document.getElementById("modalConfirmBtn");
const modalCancelBtn = document.getElementById("modalCancelBtn");

// ================================================================
// SEÇÃO 1: DETECÇÃO DE ONLINE/OFFLINE
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
    const banner = document.getElementById('offlineBanner');
    if (banner) {
        banner.style.display = isOnline ? 'none' : 'block';
    }

    // Desabilita botões de escrita quando offline
    document.querySelectorAll('.admin-only').forEach(el => {
        el.disabled = !isOnline;
        el.style.opacity = isOnline ? '1' : '0.5';
        el.style.cursor = isOnline ? 'pointer' : 'not-allowed';
    });
}

// ================================================================
// SEÇÃO 2: CACHE LOCAL (via Electron preload)
// ================================================================
async function saveCache(key, data) {
    if (window.desktopAPI) {
        await window.desktopAPI.saveCache(key, data);
    } else {
        // Fallback se estiver rodando no navegador
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

// ================================================================
// SEÇÃO 3: CACHE DE IMAGENS
// ================================================================
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
// SEÇÃO 4: FUNÇÕES AUXILIARES
// ================================================================
function getYearLabel(yearClass) {
    const map = { "1ano": "1º Ano", "2ano": "2º Ano", "3ano": "3º Ano", "4ano": "4º Ano" };
    return map[yearClass] || "Turma";
}

// Versão síncrona (para URLs externas e quando online)
function getImageUrl(image) {
    if (!image) return 'https://placehold.co/400x240?text=Sem+Imagem';
    if (image.startsWith('http')) return image;
    return `${API_BASE_URL}${image}`;
}

// Versão assíncrona (tenta usar cache local quando offline)
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

function showModal(title, message, onConfirm) {
    modalTitle.innerText = title;
    modalMessage.innerText = message;
    modal.style.display = "flex";

    const confirmHandler = () => {
        modal.style.display = "none";
        modalConfirmBtn.removeEventListener("click", confirmHandler);
        modalCancelBtn.removeEventListener("click", cancelHandler);
        if (onConfirm) onConfirm();
    };
    const cancelHandler = () => {
        modal.style.display = "none";
        modalConfirmBtn.removeEventListener("click", confirmHandler);
        modalCancelBtn.removeEventListener("click", cancelHandler);
    };
    modalConfirmBtn.addEventListener("click", confirmHandler);
    modalCancelBtn.addEventListener("click", cancelHandler);
}

// ================================================================
// SEÇÃO 5: AUTENTICAÇÃO
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
            loadStudents();
            loadAdmins();
            closeLoginModal();
        } else {
            alert(data.error || 'Credenciais inválidas');
        }
    } catch (error) {
        console.error(error);
        alert('Erro ao fazer login');
    }
}

function logout() {
    currentUser = null;
    authToken = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    renderUI();
    loadStudents();
    alert('Logout realizado com sucesso');
}

function handleUnauthorized() {
    alert('Sessão expirada. Faça login novamente.');
    logout();
    showLoginModal();
}

function showLoginModal() {
    document.getElementById('loginModal').style.display = 'flex';
}

function closeLoginModal() {
    document.getElementById('loginModal').style.display = 'none';
}

// ================================================================
// SEÇÃO 6: RENDERIZAÇÃO DA UI
// ================================================================
function renderUI() {
    const isAdmin = currentUser && currentUser.role === 'admin';

    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = isAdmin ? 'inline-flex' : 'none';
    });

    const adminPanel = document.getElementById('adminPanel');
    const toggleBtn = document.getElementById('toggleAdminPanelBtn');
    if (adminPanel && toggleBtn) {
        adminPanel.style.display = 'none';
        if (isAdmin) {
            toggleBtn.innerHTML = '<i class="fas fa-user-cog"></i> Gerenciar Admins';
            toggleBtn.style.background = 'var(--btn-warning)';
        }
    }

    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const profileBtn = document.getElementById('profileBtn');
    const userInfo = document.getElementById('userInfo');

    if (currentUser) {
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-flex';
        profileBtn.style.display = 'inline-flex';
        userInfo.style.display = 'inline';

        let photoHtml = '';
        if (currentUser.profileImage) {
            const profileImg = getImageUrl(currentUser.profileImage);
            photoHtml = `<img src="${profileImg}" style="width:28px; height:28px; border-radius:50%; object-fit:cover; vertical-align:middle; margin-right:5px;">`;
        } else {
            photoHtml = `<i class="fas fa-user-shield" style="vertical-align:middle; margin-right:5px;"></i>`;
        }
        userInfo.innerHTML = `${photoHtml} ${escapeHtml(currentUser.name)}`;
    } else {
        loginBtn.style.display = 'inline-flex';
        logoutBtn.style.display = 'none';
        profileBtn.style.display = 'none';
        userInfo.style.display = 'none';
    }
}

function highlightActiveFilterButton() {
    filtrosBtns.forEach(btn => {
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
        dynamicActionBtn.style.display = "none";
        return;
    }
    dynamicActionBtn.style.display = "inline-flex";

    const actions = {
        "1ano": {
            label: 'Promover 1º para 2º Ano', cls: "btn-dynamic promote",
            fn: () => promoteYear("1ano", "2ano", "1º ano", "2º ano")
        },
        "2ano": {
            label: 'Promover 2º para 3º Ano', cls: "btn-dynamic promote",
            fn: () => promoteYear("2ano", "3ano", "2º ano", "3º ano")
        },
        "3ano": {
            label: 'Promover 3º para 4º Ano', cls: "btn-dynamic promote",
            fn: () => promoteYear("3ano", "4ano", "3º ano", "4º ano")
        },
        "4ano": {
            label: 'Excluir todos do 4º Ano', cls: "btn-dynamic delete-fourth",
            fn: () => deleteAllByYear("4ano", "4º ano")
        },
    };

    const action = actions[activeFilter];
    if (action) {
        const icon = activeFilter === "4ano" ? 'fa-trash-alt' : 'fa-arrow-right';
        dynamicActionBtn.innerHTML = `<i class="fas ${icon}"></i> ${action.label}`;
        dynamicActionBtn.className = action.cls;
        dynamicActionBtn.onclick = action.fn;
    }
}

async function renderGallery() {
    let filtered = [...currentStudents];

    if (activeFilter !== "todos") {
        filtered = filtered.filter(s => s.yearClass === activeFilter);
    }

    if (searchTerm.trim() !== "") {
        const term = searchTerm.trim().toLowerCase();
        filtered = filtered.filter(s => s.name.toLowerCase().includes(term));
    }

    studentCountSpan.innerHTML = `<i class="fas fa-user-graduate"></i> ${filtered.length} estudantes exibidos`;

    if (filtered.length === 0) {
        galeriaDiv.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:50px; background:var(--bg-surface); border-radius:32px;">
                                    <i class="fas fa-user-slash" style="font-size:3rem; opacity:0.5;"></i>
                                    <p>Nenhum estudante nesta turma. Adicione novos!</p>
                                </div>`;
        highlightActiveFilterButton();
        return;
    }

    const isAdmin = currentUser && currentUser.role === 'admin';

    // Pré-carrega todas as URLs (resolvendo cache offline, se necessário)
    const imageUrls = await Promise.all(
        filtered.map(s => getImageUrlSmart(s.image))
    );

    let html = "";
    filtered.forEach((student, i) => {
        const yearLabel = getYearLabel(student.yearClass);
        const imageUrl = imageUrls[i];
        html += `<div class="card" data-id="${student.id}">
                    <img class="card-img" src="${imageUrl}" alt="${escapeHtml(student.name)}" onerror="this.onerror=null; this.src='https://placehold.co/400x240?text=Sem+Imagem';">
                    <div class="info">
                        <h3>${escapeHtml(student.name)}</h3>
                        <p>${yearLabel}</p>
                        ${isAdmin ? `<button class="delete-btn" data-id="${student.id}" title="Remover estudante"><i class="fas fa-trash-alt"></i></button>` : ''}
                    </div>
                </div>`;
    });
    galeriaDiv.innerHTML = html;
    highlightActiveFilterButton();
    updateDynamicButton();
}

// ================================================================
// SEÇÃO 7: CRUD DE ESTUDANTES
// ================================================================
async function loadStudents() {
    if (!isOnline) {
        // Offline: lê do cache
        const cached = await loadCache('students');
        if (cached && Array.isArray(cached)) {
            currentStudents = cached;
            renderGallery();
        } else {
            galeriaDiv.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:50px;">
                <i class="fas fa-wifi" style="font-size:3rem; opacity:0.5;"></i>
                <p>Sem conexão e sem dados salvos.</p>
            </div>`;
        }
        return;
    }

    try {
        const url = activeFilter === 'todos'
            ? `${API_BASE_URL}/students`
            : `${API_BASE_URL}/students?year=${activeFilter}`;
        const response = await fetch(url);
        const data = await response.json();
        currentStudents = data;

        // Salva no cache local
        await saveCache('students', data);

        // Baixa as imagens para uso offline (em background)
        data.forEach(student => {
            if (student.image && !student.image.startsWith('http')) {
                cacheImage(student.image);
            }
        });

        renderGallery();
    } catch (error) {
        console.error("Erro ao carregar alunos:", error);

        // Fallback para cache
        const cached = await loadCache('students');
        if (cached) {
            currentStudents = cached;
            renderGallery();
        } else {
            alert("Não foi possível conectar ao servidor.");
        }
    }
}

async function syncWithServer() {
    console.log('Reconectado. Sincronizando...');
    await loadStudents();

    if (currentUser && currentUser.role === 'admin') {
        await loadAdmins();
    }
}

async function addStudentToServer(name, yearClass, imageBase64, file) {
    if (!isOnline) {
        alert('Você está offline. Conecte-se para adicionar estudantes.');
        return false;
    }
    const formData = new FormData();
    formData.append('name', name);
    formData.append('yearClass', yearClass);

    if (file) {
        formData.append('image', file);
    } else if (imageBase64 && imageBase64.trim() !== '') {
        formData.append('imageUrl', imageBase64);
    }

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
            alert("Erro ao adicionar: " + (err.error || 'Erro desconhecido'));
            return false;
        }
    } catch (error) {
        console.error(error);
        alert("Erro de rede.");
        return false;
    }
}

async function deleteStudentById(id) {
    if (!isOnline) {
        alert('Você está offline. Conecte-se para remover estudantes.');
        return;
    }
    const student = currentStudents.find(s => s.id === id);
    if (!student) return;

    showModal("Remover estudante", `Deseja remover ${student.name} da galeria?`, async () => {
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
    });
}

async function promoteYear(fromClass, toClass, fromLabel, toLabel) {
    if (!isOnline) {
        alert('Você está offline. Conecte-se para promover turmas.');
        return;
    }
    const studentsToPromote = currentStudents.filter(s => s.yearClass === fromClass);
    if (studentsToPromote.length === 0) {
        showModal("Nenhum estudante", `Não há estudantes no ${fromLabel} para promover.`, () => { });
        return;
    }

    showModal("Promover turma", `Promover ${studentsToPromote.length} estudante(s) do ${fromLabel} para o ${toLabel}?`, async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/students/promote`, {
                method: 'POST',
                headers: authHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ fromClass, toClass })
            });
            if (response.status === 401) return handleUnauthorized();
            activeFilter = "todos";
            await loadStudents();
            updateDynamicButton();
        } catch (error) {
            console.error(error);
        }
    });
}

async function deleteAllByYear(yearClass, yearLabel) {
    if (!isOnline) {
        alert('Você está offline. Conecte-se para excluir turmas.');
        return;
    }
    const studentsToDelete = currentStudents.filter(s => s.yearClass === yearClass);
    if (studentsToDelete.length === 0) {
        showModal("Nenhum estudante", `Não há estudantes no ${yearLabel}.`, () => { });
        return;
    }

    showModal("Excluir todos", `Tem certeza que deseja excluir TODOS os ${studentsToDelete.length} estudante(s) do ${yearLabel}?`, async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/students?year=${yearClass}`, {
                method: 'DELETE',
                headers: authHeaders()
            });
            if (response.status === 401) return handleUnauthorized();
            if (activeFilter === yearClass) activeFilter = "todos";
            await loadStudents();
            updateDynamicButton();
        } catch (error) {
            console.error(error);
        }
    });
}

function setFilter(filter) {
    activeFilter = filter;
    loadStudents();
}

// ================================================================
// SEÇÃO 8: GERENCIAMENTO DE ADMINS
// ================================================================
async function loadAdmins() {
    if (!authToken) return;
    try {
        const response = await fetch(`${API_BASE_URL}/admin/list`, {
            headers: authHeaders()
        });
        if (response.status === 401) return handleUnauthorized();
        if (!response.ok) return;

        const admins = await response.json();
        const list = document.getElementById('adminList');
        if (!list) return;

        if (admins.length === 0) {
            list.innerHTML = '<p style="color:var(--text-secondary);">Nenhum administrador cadastrado.</p>';
            return;
        }

        list.innerHTML = admins.map(admin => {
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
    if (!confirm('Tem certeza que deseja remover este administrador?')) return;
    try {
        const response = await fetch(`${API_BASE_URL}/admin/${id}`, {
            method: 'DELETE',
            headers: authHeaders()
        });
        if (response.status === 401) return handleUnauthorized();
        if (response.ok) {
            alert('Administrador removido!');
            loadAdmins();
        } else {
            const err = await response.json();
            alert('Erro: ' + (err.error || 'Erro desconhecido'));
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
            alert('Administrador criado com sucesso!');
            loadAdmins();
            return true;
        } else {
            const err = await response.json();
            alert('Erro: ' + (err.error || 'Erro desconhecido'));
            return false;
        }
    } catch (error) {
        console.error(error);
        return false;
    }
}

// ================================================================
// SEÇÃO 9: PERFIL DO ADMINISTRADOR
// ================================================================
function showProfileModal() {
    if (!currentUser) return;

    document.getElementById('profileName').value = currentUser.name;
    document.getElementById('profileCurrentPassword').value = '';
    document.getElementById('profileNewPassword').value = '';
    document.getElementById('profileConfirmPassword').value = '';

    document.getElementById('profilePreview').src = currentUser.profileImage
        ? getImageUrl(currentUser.profileImage)
        : 'https://placehold.co/100x100?text=Admin';

    document.getElementById('profileModal').style.display = 'flex';
}

function closeProfileModal() {
    document.getElementById('profileModal').style.display = 'none';
}

async function updateProfile(name, currentPassword, newPassword) {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/profile`, {
            method: 'PUT',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ newName: name, currentPassword, newPassword })
        });

        if (response.status === 401 && newPassword) {
            const data = await response.json();
            alert('Erro: ' + (data.error || 'Erro desconhecido'));
            return false;
        }

        const data = await response.json();
        if (response.ok) {
            alert('Perfil atualizado com sucesso!');
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
            alert('Erro: ' + (data.error || 'Erro desconhecido'));
            return false;
        }
    } catch (error) {
        console.error(error);
        alert('Erro ao atualizar perfil');
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
            document.getElementById('profilePreview').src = getImageUrl(data.profileImage);
            renderUI();
            alert('Foto de perfil atualizada!');
        } else {
            alert('Erro: ' + (data.error || 'Erro desconhecido'));
        }
    } catch (error) {
        console.error(error);
        alert('Erro ao enviar imagem');
    }
}

// ================================================================
// SEÇÃO 10: TEMA (Claro/Escuro)
// ================================================================
function initTheme() {
    const themeBtn = document.getElementById("themeToggle");
    if (!themeBtn) return;

    function applyTheme(isDark) {
        document.body.classList.toggle("dark", isDark);
        themeBtn.innerHTML = isDark
            ? '<i class="fas fa-sun"></i> <span id="themeText">Modo Claro</span>'
            : '<i class="fas fa-moon"></i> <span id="themeText">Modo Escuro</span>';
        localStorage.setItem("ifpr_theme", isDark ? "dark" : "light");
    }

    const savedTheme = localStorage.getItem("ifpr_theme");
    applyTheme(savedTheme === "dark");

    themeBtn.addEventListener("click", () => {
        applyTheme(!document.body.classList.contains("dark"));
    });
}

// ================================================================
// SEÇÃO 11: EVENTOS
// ================================================================
function setupDelegation() {
    galeriaDiv.addEventListener("click", (e) => {
        const deleteBtn = e.target.closest(".delete-btn");
        if (deleteBtn && deleteBtn.dataset.id) {
            const studentId = parseInt(deleteBtn.dataset.id);
            deleteStudentById(studentId);
            e.stopPropagation();
        }
    });
}

function initEventListeners() {
    // Filtros
    filtrosBtns.forEach(btn => {
        btn.addEventListener("click", () => setFilter(btn.getAttribute("data-filter")));
    });

    // Botão Perfil
    const profileBtn = document.getElementById('profileBtn');
    if (profileBtn) profileBtn.addEventListener('click', showProfileModal);

    // Formulário Perfil
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('profileName').value.trim();
            const currentPassword = document.getElementById('profileCurrentPassword').value;
            const newPassword = document.getElementById('profileNewPassword').value;
            const confirmPassword = document.getElementById('profileConfirmPassword').value;

            if (!name) return alert('Nome não pode ficar vazio');
            if (newPassword && newPassword !== confirmPassword) return alert('Nova senha e confirmação não coincidem');
            if (newPassword && !currentPassword) return alert('Para mudar a senha, informe a senha atual');

            await updateProfile(name, currentPassword, newPassword || '');
        });
    }

    // Upload de foto de perfil
    const profileImageUpload = document.getElementById('profileImageUpload');
    if (profileImageUpload) {
        profileImageUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                uploadProfileImage(file);
                e.target.value = '';
            }
        });
    }

    // Botão "Novo Estudante"
    if (showFormBtn) {
        showFormBtn.addEventListener("click", () => {
            const isOpen = addFormPanel.style.display === "block";
            addFormPanel.style.display = isOpen ? "none" : "block";
            showFormBtn.innerHTML = isOpen
                ? '<i class="fas fa-plus-circle"></i> Novo Estudante'
                : '<i class="fas fa-minus-circle"></i> Fechar Formulário';
        });
    }

    // Botão "Adicionar Estudante"
    if (confirmAddBtn) {
        confirmAddBtn.addEventListener("click", async () => {
            const name = studentNameInput.value.trim();
            const year = studentYearSelect.value;
            const urlImage = imageUrlInput.value.trim();
            const file = imageUploadInput.files[0];

            if (!name) {
                showModal("Campo obrigatório", "Por favor, informe o nome do estudante.", () => { });
                return;
            }

            const success = await addStudentToServer(name, year, urlImage, file);
            if (success) {
                studentNameInput.value = "";
                imageUrlInput.value = "";
                imageUploadInput.value = "";
                addFormPanel.style.display = "none";
                showFormBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Novo Estudante';
            }
        });
    }

    // Login / Logout
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    if (loginBtn) loginBtn.addEventListener('click', showLoginModal);
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    // Formulário de Login
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('loginName').value;
            const password = document.getElementById('loginPassword').value;
            await login(name, password);
        });
    }

    // Botão "Criar Admin"
    const createAdminBtn = document.getElementById('createAdminBtn');
    if (createAdminBtn) {
        createAdminBtn.addEventListener('click', async () => {
            const name = document.getElementById('newAdminName').value.trim();
            const password = document.getElementById('newAdminPassword').value.trim();

            if (!name || !password) return alert('Preencha nome e senha');

            const ok = await createAdmin(name, password);
            if (ok) {
                document.getElementById('newAdminName').value = '';
                document.getElementById('newAdminPassword').value = '';
            }
        });
    }

    // Painel de Admins (toggle)
    const toggleAdminPanelBtn = document.getElementById('toggleAdminPanelBtn');
    const adminPanel = document.getElementById('adminPanel');
    if (toggleAdminPanelBtn && adminPanel) {
        toggleAdminPanelBtn.addEventListener('click', () => {
            const isOpen = adminPanel.style.display === 'block';
            adminPanel.style.display = isOpen ? 'none' : 'block';
            toggleAdminPanelBtn.innerHTML = isOpen
                ? '<i class="fas fa-user-cog"></i> Gerenciar Admins'
                : '<i class="fas fa-minus-circle"></i> Fechar Admins';
            toggleAdminPanelBtn.style.background = isOpen ? 'var(--btn-warning)' : 'var(--btn-danger)';
        });
    }

    // Busca
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchTerm = e.target.value;
            renderGallery();
        });
    }
}

// ================================================================
// SEÇÃO 12: INICIALIZAÇÃO
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

    // Atualiza UI offline primeiro
    updateOfflineUI();

    // Tenta carregar do servidor
    await loadStudents();

    renderUI();
    setupDelegation();
    initTheme();
    initEventListeners();

    if (currentUser && currentUser.role === 'admin') {
        loadAdmins();
    }

    // Verifica conexão a cada 30 segundos
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