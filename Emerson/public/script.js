// ================================================
// CONFIGURAÇÃO: URL do servidor 

// ================================================


const API_BASE_URL = 'http://localhost:3000'; //<--- alterar

// ================================================
// VARIÁVEIS GLOBAIS
// ================================================

let currentStudents = [];
let activeFilter = "todos";
let searchTerm = "";
let currentUser = null;
let authToken = localStorage.getItem('authToken');

// ================================================
// DOM ELEMENTOS
// ================================================

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

// ================================================
// FUNÇÕES AUXILIARES
// ================================================
function getYearLabel(yearClass) {
    const map = { "1ano": "1º Ano", "2ano": "2º Ano", "3ano": "3º Ano", "4ano": "4º Ano" };
    return map[yearClass] || "Turma";
}
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function (m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
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
// ================================================
// SISTEMA DE LOGIN Total
// ================================================

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

function renderUI() {
    const isAdmin = currentUser && currentUser.role === 'admin';

    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = isAdmin ? 'inline-flex' : 'none';
    });

    // Controle específico para o painel de admin
    const adminPanel = document.getElementById('adminPanel');
    const toggleBtn = document.getElementById('toggleAdminPanelBtn');
    if (adminPanel) {
        if (isAdmin) {
            adminPanel.style.display = 'none'; // Começa fechado
            toggleBtn.innerHTML = '<i class="fas fa-user-cog"></i> Gerenciar Admins';
            toggleBtn.style.background = 'var(--btn-warning)';
        } else {
            adminPanel.style.display = 'none';
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
            photoHtml = `<img src="${currentUser.profileImage}" style="width:28px; height:28px; border-radius:50%; object-fit:cover; vertical-align:middle; margin-right:5px;">`;
        } else {
            photoHtml = `<i class="fas fa-user-shield" style="vertical-align:middle; margin-right:5px;"></i>`;
        }
        userInfo.innerHTML = `${photoHtml} ${currentUser.name}`;
    } else {
        loginBtn.style.display = 'inline-flex';
        logoutBtn.style.display = 'none';
        profileBtn.style.display = 'none';
        userInfo.style.display = 'none';
    }
}

function showLoginModal() {
    document.getElementById('loginModal').style.display = 'flex';
}

function closeLoginModal() {
    document.getElementById('loginModal').style.display = 'none';
}

// ================================================
// FUNÇÕES DE COMUNICAÇÃO COM O SERVIDOR (API)
// ================================================

async function loadStudents() {
    try {
        const url = activeFilter === 'todos'
            ? `${API_BASE_URL}/students`
            : `${API_BASE_URL}/students?year=${activeFilter}`;
        const response = await fetch(url);
        const data = await response.json();
        currentStudents = data;
        renderGallery();
    } catch (error) {
        console.error("Erro ao carregar alunos:", error);
        alert("Não foi possível conectar ao servidor. Certifique-se que o servidor está rodando.");
    }
}

async function addStudentToServer(name, yearClass, imageBase64, file) {
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
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: formData
        });

        if (response.status === 401) {
            alert('Você precisa estar logado como administrador para fazer isso.');
            showLoginModal();
            return false;
        }

        if (response.ok) {
            await loadStudents();
            return true;
        } else {
            const err = await response.json();
            alert("Erro ao adicionar: " + err.error);
            return false;
        }
    } catch (error) {
        console.error(error);
        alert("Erro de rede.");
        return false;
    }
}

async function deleteStudentById(id) {
    const student = currentStudents.find(s => s.id === id);
    if (!student) return;
    showModal("Remover estudante", `Deseja remover ${student.name} da galeria?`, async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/students/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (response.status === 401) {
                alert('Você precisa estar logado como administrador.');
                showLoginModal();
                return;
            }
            await loadStudents();
        } catch (error) {
            console.error(error);
        }
    });
}

async function promoteYear(fromClass, toClass, fromLabel, toLabel) {
    const studentsToPromote = currentStudents.filter(s => s.yearClass === fromClass);
    if (studentsToPromote.length === 0) {
        showModal("Nenhum estudante", `Não há estudantes no ${fromLabel} para promover.`, () => { });
        return;
    }
    showModal("Promover turma", `Promover ${studentsToPromote.length} estudante(s) do ${fromLabel} para o ${toLabel}?`, async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/students/promote`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ fromClass, toClass })
            });
            if (response.status === 401) {
                alert('Você precisa estar logado como administrador.');
                showLoginModal();
                return;
            }
            activeFilter = "todos";
            await loadStudents();
            updateDynamicButton();
        } catch (error) {
            console.error(error);
        }
    });
}

async function deleteAllByYear(yearClass, yearLabel) {
    const studentsToDelete = currentStudents.filter(s => s.yearClass === yearClass);
    if (studentsToDelete.length === 0) {
        showModal("Nenhum estudante", `Não há estudantes no ${yearLabel}.`, () => { });
        return;
    }
    showModal("Excluir todos", `Tem certeza que deseja excluir TODOS os ${studentsToDelete.length} estudante(s) do ${yearLabel}?`, async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/students?year=${yearClass}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (response.status === 401) {
                alert('Você precisa estar logado como administrador.');
                showLoginModal();
                return;
            }
            if (activeFilter === yearClass) activeFilter = "todos";
            await loadStudents();
            updateDynamicButton();
        } catch (error) {
            console.error(error);
        }
    });
}

// ================================================
// ADMIN: Gerenciar administradores
// ================================================

async function loadAdmins() {
    if (!authToken) return;
    try {
        const response = await fetch(`${API_BASE_URL}/admin/list`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (response.ok) {
            const admins = await response.json();
            const list = document.getElementById('adminList');
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
                        <span><i class="fas fa-user-shield" style="color:var(--if-green);"></i> ${admin.name}</span>
                        ${actionButtons}
                    </div>
                `;
            }).join('');
        }
    } catch (error) {
        console.error(error);
    }
}

async function deleteAdmin(id) {
    if (!confirm('Tem certeza que deseja remover este administrador?')) return;
    try {
        const response = await fetch(`${API_BASE_URL}/admin/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (response.ok) {
            alert('Administrador removido!');
            loadAdmins();
        } else {
            const err = await response.json();
            alert('Erro: ' + err.error);
        }
    } catch (error) {
        console.error(error);
    }
}

// ================================================
// PERFIL DO ADMINISTRADOR
// ================================================

function showProfileModal() {
    if (!currentUser) return;

    document.getElementById('profileName').value = currentUser.name;
    document.getElementById('profileCurrentPassword').value = '';
    document.getElementById('profileNewPassword').value = '';
    document.getElementById('profileConfirmPassword').value = '';

    if (currentUser.profileImage) {
        document.getElementById('profilePreview').src = currentUser.profileImage;
    } else {
        document.getElementById('profilePreview').src = 'https://placehold.co/100x100?text=Admin';
    }

    document.getElementById('profileModal').style.display = 'flex';
}

function closeProfileModal() {
    document.getElementById('profileModal').style.display = 'none';
}

async function updateProfile(name, currentPassword, newPassword) {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ newName: name, currentPassword, newPassword })
        });

        const data = await response.json();
        if (response.ok) {
            alert('Perfil atualizado com sucesso!');
            currentUser.name = data.user.name;
            currentUser.profileImage = data.user.profileImage;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            renderUI();
            closeProfileModal();
            loadAdmins();
            return true;
        } else {
            alert('Erro: ' + data.error);
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
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: formData
        });

        const data = await response.json();
        if (response.ok) {
            currentUser.profileImage = data.profileImage;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            document.getElementById('profilePreview').src = data.profileImage;
            renderUI();
            alert('Foto de perfil atualizada!');
        } else {
            alert('Erro: ' + data.error);
        }
    } catch (error) {
        console.error(error);
        alert('Erro ao enviar imagem');
    }
}

// ================================================
// FUNÇÕES DE RENDERIZAÇÃO (Visuais)
// ================================================

function updateDynamicButton() {
    if (activeFilter === "todos") {
        dynamicActionBtn.style.display = "none";
        return;
    }
    if (!currentUser || currentUser.role !== 'admin') {
        dynamicActionBtn.style.display = "none";
        return;
    }
    dynamicActionBtn.style.display = "inline-flex";
    if (activeFilter === "1ano") {
        dynamicActionBtn.innerHTML = '<i class="fas fa-arrow-right"></i> Promover 1º para 2º Ano';
        dynamicActionBtn.className = "btn-dynamic promote";
        dynamicActionBtn.onclick = () => promoteYear("1ano", "2ano", "1º ano", "2º ano");
    } else if (activeFilter === "2ano") {
        dynamicActionBtn.innerHTML = '<i class="fas fa-arrow-right"></i> Promover 2º para 3º Ano';
        dynamicActionBtn.className = "btn-dynamic promote";
        dynamicActionBtn.onclick = () => promoteYear("2ano", "3ano", "2º ano", "3º ano");
    } else if (activeFilter === "3ano") {
        dynamicActionBtn.innerHTML = '<i class="fas fa-arrow-right"></i> Promover 3º para 4º Ano';
        dynamicActionBtn.className = "btn-dynamic promote";
        dynamicActionBtn.onclick = () => promoteYear("3ano", "4ano", "3º ano", "4º ano");
    } else if (activeFilter === "4ano") {
        dynamicActionBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Excluir todos do 4º Ano';
        dynamicActionBtn.className = "btn-dynamic delete-fourth";
        dynamicActionBtn.onclick = () => deleteAllByYear("4ano", "4º ano");
    }
}

function renderGallery() {
    let filtered = [...currentStudents];
    if (activeFilter !== "todos") {
        filtered = filtered.filter(student => student.yearClass === activeFilter);
    }

    if (searchTerm.trim() !== "") {
        const term = searchTerm.trim().toLowerCase();
        filtered = filtered.filter(student =>
            student.name.toLowerCase().includes(term)
        );
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
    let html = "";
    filtered.forEach(student => {
        const yearLabel = getYearLabel(student.yearClass);
        html += `<div class="card" data-id="${student.id}">
                    <img class="card-img" src="${student.image}" alt="${escapeHtml(student.name)}" onerror="this.onerror=null; this.src='https://placehold.co/400x240?text=Sem+Imagem';">
                    <div class="info">
                        <h3>${escapeHtml(student.name)}</h3>
                        <p>${yearLabel}</p>
                        ${currentUser && currentUser.role === 'admin' ? `<button class="delete-btn" data-id="${student.id}" title="Remover estudante"><i class="fas fa-trash-alt"></i></button>` : ''}
                    </div>
                </div>`;
    });
    galeriaDiv.innerHTML = html;
    highlightActiveFilterButton();
    updateDynamicButton();
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

function setFilter(filter) {
    activeFilter = filter;
    loadStudents();
}

// ================================================
// EVENTOS E INICIALIZAÇÃO
// ================================================

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

function initTheme() {
    const themeBtn = document.getElementById("themeToggle");
    function applyTheme(isDark) {
        if (isDark) {
            document.body.classList.add("dark");
            themeBtn.innerHTML = '<i class="fas fa-sun"></i> <span id="themeText">Modo Claro</span>';
            localStorage.setItem("ifpr_theme", "dark");
        } else {
            document.body.classList.remove("dark");
            themeBtn.innerHTML = '<i class="fas fa-moon"></i> <span id="themeText">Modo Escuro</span>';
            localStorage.setItem("ifpr_theme", "light");
        }
        const newSpan = themeBtn.querySelector("#themeText");
        if (newSpan) newSpan.innerText = isDark ? "Modo Claro" : "Modo Escuro";
    }
    const savedTheme = localStorage.getItem("ifpr_theme");
    if (savedTheme === "dark") applyTheme(true);
    else applyTheme(false);
    themeBtn.addEventListener("click", () => {
        const isDark = document.body.classList.contains("dark");
        applyTheme(!isDark);
    });
}

function initEventListeners() {
    filtrosBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const filterValue = btn.getAttribute("data-filter");
            setFilter(filterValue);
        });
    });

    // Botão Perfil
    document.getElementById('profileBtn').addEventListener('click', showProfileModal);

    // Formulário Perfil
    document.getElementById('profileForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('profileName').value.trim();
        const currentPassword = document.getElementById('profileCurrentPassword').value;
        const newPassword = document.getElementById('profileNewPassword').value;
        const confirmPassword = document.getElementById('profileConfirmPassword').value;

        if (!name) {
            alert('Nome não pode ficar vazio');
            return;
        }

        if (newPassword && newPassword !== confirmPassword) {
            alert('Nova senha e confirmação não coincidem');
            return;
        }

        if (newPassword && !currentPassword) {
            alert('Para mudar a senha, informe a senha atual');
            return;
        }

        await updateProfile(name, currentPassword, newPassword || '');
    });

    // Upload de foto de perfil
    document.getElementById('profileImageUpload').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            uploadProfileImage(file);
            e.target.value = '';
        }
    });

    showFormBtn.addEventListener("click", () => {
        if (addFormPanel.style.display === "none" || addFormPanel.style.display === "") {
            addFormPanel.style.display = "block";
            showFormBtn.innerHTML = '<i class="fas fa-minus-circle"></i> Fechar Formulário';
        } else {
            addFormPanel.style.display = "none";
            showFormBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Novo Estudante';
        }
    });

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

    document.getElementById('loginBtn').addEventListener('click', showLoginModal);
    document.getElementById('logoutBtn').addEventListener('click', logout);

    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('loginName').value;
        const password = document.getElementById('loginPassword').value;
        await login(name, password);
    });

    document.getElementById('createAdminBtn').addEventListener('click', async () => {
        const name = document.getElementById('newAdminName').value.trim();
        const password = document.getElementById('newAdminPassword').value.trim();

        if (!name || !password) {
            alert('Preencha nome e senha');
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/admin/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ name, password })
            });

            if (response.ok) {
                alert('Administrador criado com sucesso!');
                document.getElementById('newAdminName').value = '';
                document.getElementById('newAdminPassword').value = '';
                loadAdmins();
            } else {
                const err = await response.json();
                alert('Erro: ' + err.error);
            }
        } catch (error) {
            console.error(error);
        }
    });

    const toggleAdminPanelBtn = document.getElementById('toggleAdminPanelBtn');
    const adminPanel = document.getElementById('adminPanel');

    toggleAdminPanelBtn.addEventListener('click', () => {
        if (adminPanel.style.display === 'none' || adminPanel.style.display === '') {
            adminPanel.style.display = 'block';
            toggleAdminPanelBtn.innerHTML = '<i class="fas fa-minus-circle"></i> Fechar Admins';
            toggleAdminPanelBtn.style.background = 'var(--btn-danger)';
        } else {
            adminPanel.style.display = 'none';
            toggleAdminPanelBtn.innerHTML = '<i class="fas fa-user-cog"></i> Gerenciar Admins';
            toggleAdminPanelBtn.style.background = 'var(--btn-warning)';
        }
    });
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchTerm = e.target.value;
            renderGallery(); // re-renderiza com o filtro
        });
    }
}

// ================================================
// INICIALIZAÇÃO
// ================================================

async function init() {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        authToken = localStorage.getItem('authToken');
    }

    renderUI();
    await loadStudents();
    setupDelegation();
    initTheme();
    initEventListeners();

    if (currentUser && currentUser.role === 'admin') {
        loadAdmins();
    }
}

init();