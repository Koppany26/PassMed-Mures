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
export const register = (nev, email, jelszo) =>
    apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ nev, email, jelszo }),
    });

export const login = (email, jelszo) =>
    apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, jelszo }),
    });

export const getMe = () => apiFetch('/auth/me');

// --- KATEGÓRIÁK ÉS KÉRDÉSEK ---
export const getCategories = () => apiFetch('/categories');
export const createCategory = (nev) =>
    apiFetch('/categories', {
        method: 'POST',
        body: JSON.stringify({ nev }),
    });

export const getQuestions = (kategoriaId) =>
    apiFetch(kategoriaId ? `/questions?kategoriaId=${kategoriaId}` : '/questions');

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

export const addQuestionToTest = (tesztId, kerdesId, pontszam = 1) =>
    apiFetch(`/tests/${tesztId}/questions`, {
        method: 'POST',
        body: JSON.stringify({ kerdesId, pontszam }),
    });

// --- KITÖLTÉSEK ---
export const startAttempt = (tesztId) =>
    apiFetch(`/tests/${tesztId}/attempts`, {
        method: 'POST',
    });

export const submitAttempt = (attemptId, valaszok) =>
    apiFetch(`/attempts/${attemptId}/submit`, {
        method: 'POST',
        body: JSON.stringify({ valaszok }),
    });

export const getMyAttempts = () => apiFetch('/attempts/my');
export const getAttemptById = (id) => apiFetch(`/attempts/${id}`);