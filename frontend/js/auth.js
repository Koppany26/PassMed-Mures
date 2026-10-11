// PassMed - Bejelentkezés/Regisztráció logika
import { login, register, setToken, getToken } from './api.js';

// Ha már van token, átirányítunk a dashboardra
if (getToken()) {
    window.location.href = '/dashboard.html';
}

const alertBox = document.getElementById('alert');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const showRegisterBtn = document.getElementById('showRegister');
const showLoginBtn = document.getElementById('showLogin');

// Alert megjelenítése
function showAlert(message, type = 'error') {
    alertBox.textContent = message;
    alertBox.className = `alert show alert-${type}`;
    setTimeout(() => {
        alertBox.className = 'alert';
    }, 5000);
}

// Űrlapok váltása
showRegisterBtn.addEventListener('click', () => {
    loginForm.classList.add('hidden');
    showRegisterBtn.classList.add('hidden');
    registerForm.classList.remove('hidden');
    showLoginBtn.classList.remove('hidden');
});

showLoginBtn.addEventListener('click', () => {
    registerForm.classList.add('hidden');
    showLoginBtn.classList.add('hidden');
    loginForm.classList.remove('hidden');
    showRegisterBtn.classList.remove('hidden');
});

// Bejelentkezés
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginJelszo').value;

    try {
        const data = await login(email, password);
        setToken(data.token);
        showAlert('Sikeres bejelentkezés!', 'success');
        setTimeout(() => {
            window.location.href = '/dashboard.html';
        }, 500);
    } catch (error) {
        showAlert(error.message);
    }
});

// Regisztráció
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('regNev').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regJelszo').value;

    try {
        await register(name, email, password);
        showAlert('Sikeres regisztráció! Most jelentkezz be.', 'success');
        // Visszaváltás a bejelentkezésre
        registerForm.classList.add('hidden');
        showLoginBtn.classList.add('hidden');
        loginForm.classList.remove('hidden');
        showRegisterBtn.classList.remove('hidden');
        registerForm.reset();
    } catch (error) {
        showAlert(error.message);
    }
});