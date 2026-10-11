// PassMed - API segédfüggvények
const API_BASE = 'http://localhost:5000/api';

// Token kezelés localStorage-ban
export const getToken = () => localStorage.getItem('passmed_token');
export const setToken = (token) => localStorage.setItem('passmed_token', token);
export const clearToken = () => localStorage.removeItem('passmed_token');

// Általános fetch wrapper JWT-vel
export async function apiFetch(path, options = {}) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
    });

    // Biztonságos JSON parse: ha üres a válasz, ne dobjon hibát
    let data = {};
    const text = await response.text();
    if (text) {
        try {
            data = JSON.parse(text);
        } catch (e) {
            data = { message: text };
        }
    }

    if (!response.ok) {
        throw new Error(data.message || `Hiba történt a kérés során (${response.status}).`);
    }
    return data;
}

// --- AUTH ---
export const register = (name, email, password) =>
    apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
    });

export const login = (email, password) =>
    apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    });

export const getMe = () => apiFetch('/auth/me');

// --- KATEGÓRIÁK ÉS KÉRDÉSEK ---
export const getCategories = () => apiFetch('/categories');
export const createCategory = (name) =>
    apiFetch('/categories', {
        method: 'POST',
        body: JSON.stringify({ name }),
    });

export const getQuestions = (categoryId) =>
    apiFetch(categoryId ? `/questions?categoryId=${categoryId}` : '/questions');

export const createQuestion = (data) =>
    apiFetch('/questions', {
        method: 'POST',
        body: JSON.stringify(data),
    });

// --- TESZTEK ---
export const getTests = () => apiFetch('/tests');
export const getTestById = (id) => apiFetch(`/tests/${id}`);
export const createTest = (data) =>
    apiFetch('/tests', {
        method: 'POST',
        body: JSON.stringify(data),
    });

export const addQuestionToTest = (testId, questionId, points = 1) =>
    apiFetch(`/tests/${testId}/questions`, {
        method: 'POST',
        body: JSON.stringify({ questionId, points }),
    });

// --- KITÖLTÉSEK ---
export const startAttempt = (testId) =>
    apiFetch(`/tests/${testId}/attempts`, {
        method: 'POST',
    });

export const submitAttempt = (attemptId, answers) =>
    apiFetch(`/attempts/${attemptId}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers }),
    });

export const getMyAttempts = () => apiFetch('/attempts/my');
export const getAttemptById = (id) => apiFetch(`/attempts/${id}`);

// --- TESZT IMPORT (fájlfeltöltés + beolvasás) ---
// Fájlfeltöltés FormData-val (ne POST typeot 'Content-Type' fejlécket!)
export async function apiUpload(path, formData) {
    const token = getToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers,
        body: formData,
    });

    let data = {};
    const text = await response.text();
    if (text) {
        try {
            data = JSON.parse(text);
        } catch (e) {
            data = { message: text };
        }
    }
    if (!response.ok) {
        throw new Error(data.message || `Hiba a feltöltés során (${response.status}).`);
    }
    return data;
}

export const uploadTestFile = (formData) => apiUpload('/tests/import', formData);
export const getImportPreview = (token) => apiFetch(`/tests/import/${token}`);
export const uploadAnswerKey = (token, formData) => apiUpload(`/tests/import/${token}/answer-key`, formData);
export const approveImport = (token, data) =>
    apiFetch(`/tests/import/${token}/approve`, {
        method: 'POST',
        body: JSON.stringify(data),
    });