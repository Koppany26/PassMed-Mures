// PassMed - Vezérlőpult logika
import {
    getToken, clearToken, getMe,
    getTests, getTestById, startAttempt, submitAttempt, getMyAttempts,
    getCategories, createCategory, createQuestion, createTest,
    uploadTestFile, getImportPreview, uploadAnswerKey, approveImport
} from './api.js';

// --- ÁLLAPOT ---
let currentUser = null;
let currentTest = null;
let currentAttemptId = null;
let selectedAnswers = {};

// --- ELEMEK ---
const alertBox = document.getElementById('alert');
const userNameEl = document.getElementById('userName');
const userRoleEl = document.getElementById('userRole');
const logoutBtn = document.getElementById('logoutBtn');
const testListEl = document.getElementById('testList');
const testView = document.getElementById('testView');
const testTitle = document.getElementById('testTitle');
const testDescription = document.getElementById('testDescription');
const questionsContainer = document.getElementById('questionsContainer');
const submitTestBtn = document.getElementById('submitTestBtn');
const resultView = document.getElementById('resultView');
const resultScore = document.getElementById('resultScore');
const backToTestsBtn = document.getElementById('backToTestsBtn');
const attemptListEl = document.getElementById('attemptList');
const teacherPanel = document.getElementById('teacherPanel');

// --- SEGÉDFÜGGVÉNYEK ---
function showAlert(message, type = 'error') {
    alertBox.textContent = message;
    alertBox.className = `alert show alert-${type}`;
    setTimeout(() => { alertBox.className = 'alert'; }, 5000);
}

function hideAllViews() {
    testView.classList.add('hidden');
    resultView.classList.add('hidden');
}

// --- BEJELENTKEZÉS ELLENŐRZÉS ---
if (!getToken()) {
    window.location.href = '/index.html';
}

// --- FELHASZNÁLÓ BETÖLTÉSE ---
async function loadUser() {
    try {
        const data = await getMe();
        currentUser = data.user;
        userNameEl.textContent = currentUser.name;
        userRoleEl.textContent = currentUser.role;

        // Tanár panel megjelenítése
        if (currentUser.role === 'TEACHER' || currentUser.role === 'ADMIN') {
            teacherPanel.classList.remove('hidden');
            loadCategories();
        }
    } catch (error) {
        showAlert(error.message);
        clearToken();
        window.location.href = '/index.html';
    }
}

// --- TESZTEK BETÖLTÉSE ---
async function loadTests() {
    try {
        const data = await getTests();
        testListEl.innerHTML = '';

        if (data.tests.length === 0) {
            testListEl.innerHTML = '<li>Nincs elérhető teszt.</li>';
            return;
        }

        data.tests.forEach(test => {
            const li = document.createElement('li');
            li.className = 'test-item';

            const info = document.createElement('div');
            info.className = 'test-info';
            info.innerHTML = `<h4>${test.title}</h4><p>${test.description || 'Nincs leírás'}</p>`;

            const btn = document.createElement('button');
            btn.className = 'btn btn-sm btn-primary';
            btn.textContent = 'Kitöltés';
            btn.addEventListener('click', () => openTest(test.id));

            li.appendChild(info);
            li.appendChild(btn);
            testListEl.appendChild(li);
        });
    } catch (error) {
        showAlert(error.message);
    }
}

// --- TESZT MEGNYITÁSA ---
async function openTest(testId) {
    try {
        const data = await getTestById(testId);
        currentTest = data.test;

        // Kitöltés indítása
        const attemptData = await startAttempt(testId);
        currentAttemptId = attemptData.attempt.id;

        // Nézetek váltása
        hideAllViews();
        testView.classList.remove('hidden');

        testTitle.textContent = currentTest.title;
        testDescription.textContent = currentTest.description || '';

        // Kérdések megjelenítése
        questionsContainer.innerHTML = '';
        selectedAnswers = {};

        currentTest.questions.forEach((q, qIndex) => {
            const block = document.createElement('div');
            block.className = 'question-block';

            const qTitle = document.createElement('h4');
            qTitle.textContent = `${qIndex + 1}. ${q.questionText}`;
            block.appendChild(qTitle);

            const list = document.createElement('ul');
            list.className = 'option-list';

            q.options.forEach(opt => {
                const li = document.createElement('li');
                const label = document.createElement('label');

                const input = document.createElement('input');
                input.type = q.answerType === 'MULTIPLE' ? 'checkbox' : 'radio';
                input.name = `question_${q.id}`;
                input.value = opt.id;

                input.addEventListener('change', () => {
                    if (q.answerType === 'MULTIPLE') {
                        if (!selectedAnswers[q.id]) selectedAnswers[q.id] = [];
                        if (input.checked) {
                            selectedAnswers[q.id].push(Number(opt.id));
                        } else {
                            selectedAnswers[q.id] = selectedAnswers[q.id].filter(id => id !== Number(opt.id));
                        }
                    } else {
                        selectedAnswers[q.id] = [Number(opt.id)];
                    }
                });

                label.appendChild(input);
                label.appendChild(document.createTextNode(opt.optionText));
                li.appendChild(label);
                list.appendChild(li);
            });

            block.appendChild(list);
            questionsContainer.appendChild(block);
        });
    } catch (error) {
        showAlert(error.message);
    }
}

// --- TESZT BEADÁSA ---
async function submitTest() {
    if (!currentAttemptId) return;

    // Válaszok összegyűjtése
    const answers = Object.entries(selectedAnswers).map(([questionId, optionIds]) => ({
        questionId: Number(questionId),
        optionIds,
    }));

    try {
        const data = await submitAttempt(currentAttemptId, answers);

        // Eredmény megjelenítése
        hideAllViews();
        resultView.classList.remove('hidden');
        resultScore.textContent = `${data.totalScore}/${data.maxScore}`;

        // Kitöltések frissítése
        loadAttempts();
    } catch (error) {
        showAlert(error.message);
    }
}

// --- KITÖLTÉSEK BETÖLTÉSE ---
async function loadAttempts() {
    try {
        const data = await getMyAttempts();
        attemptListEl.innerHTML = '';

        if (data.attempts.length === 0) {
            attemptListEl.innerHTML = '<li>Még nincs kitöltésed.</li>';
            return;
        }

        data.attempts.forEach(att => {
            const li = document.createElement('li');
            li.className = 'attempt-item';

            const info = document.createElement('div');
            info.className = 'attempt-info';
            info.innerHTML = `<h4>${att.testTitle}</h4><p>${new Date(att.startedAt).toLocaleString('hu-HU')}</p>`;

            const badge = document.createElement('span');
            badge.className = `status-badge status-${att.status}`;
            badge.textContent = att.status === 'BEFEJEZVE' ? `Befejezve (${att.totalScore} pont)` : att.status;

            li.appendChild(info);
            li.appendChild(badge);
            attemptListEl.appendChild(li);
        });
    } catch (error) {
        showAlert(error.message);
    }
}

// --- KATEGÓRIÁK BETÖLTÉSE (TANÁR) ---
async function loadCategories() {
    try {
        const data = await getCategories();
        const select = document.getElementById('newQuestionKategoria');
        select.innerHTML = '<option value="">Kategória kiválasztása...</option>';
        data.categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.id;
            opt.textContent = cat.name;
            select.appendChild(opt);
        });
    } catch (error) {
        showAlert(error.message);
    }
}

// --- TANÁR: ÚJ TESZT ---
async function handleCreateTest() {
    const title = document.getElementById('newTestCim').value.trim();
    const description = document.getElementById('newTestLeiras').value.trim();
    const timeLimit = document.getElementById('newTestIdo').value;

    if (!title) {
        showAlert('A teszt címe kötelező.');
        return;
    }

    try {
        await createTest({ title, description, timeLimitMinutes: timeLimit ? Number(timeLimit) : null });
        showAlert('Teszt létrehozva!', 'success');
        document.getElementById('newTestCim').value = '';
        document.getElementById('newTestLeiras').value = '';
        document.getElementById('newTestIdo').value = '';
        loadTests();
    } catch (error) {
        showAlert(error.message);
    }
}

// --- TANÁR: ÚJ KATEGÓRIA ---
async function handleCreateCategory() {
    const name = document.getElementById('newCategoryNev').value.trim();
    if (!name) {
        showAlert('A kategória neve kötelező.');
        return;
    }

    try {
        await createCategory(name);
        showAlert('Kategória létrehozva!', 'success');
        document.getElementById('newCategoryNev').value = '';
        loadCategories();
    } catch (error) {
        showAlert(error.message);
    }
}

// --- TANÁR: OPCIÓK KEZELÉSE ---
let optionCount = 0;
function addOption() {
    optionCount++;
    const container = document.getElementById('optionsContainer');
    const div = document.createElement('div');
    div.className = 'option-editor';
    div.innerHTML = `
        <div class="form-row">
            <input type="text" class="option-text" placeholder="Válasz szövege">
            <label>
                <input type="checkbox" class="option-correct"> Helyes
            </label>
        </div>
    `;
    container.appendChild(div);
}

// --- TANÁR: ÚJ KÉRDÉS ---
async function handleCreateQuestion() {
    const categoryId = document.getElementById('newQuestionKategoria').value;
    const questionText = document.getElementById('newQuestionSzoveg').value.trim();
    const answerType = document.getElementById('newQuestionTipus').value;

    if (!categoryId) {
        showAlert('Válassz kategóriát!');
        return;
    }
    if (!questionText) {
        showAlert('A kérdés szövege kötelező.');
        return;
    }

    // Opciók összegyűjtése
    const optionEditors = document.querySelectorAll('.option-editor');
    const options = [];
    optionEditors.forEach(editor => {
        const text = editor.querySelector('.option-text').value.trim();
        const correct = editor.querySelector('.option-correct').checked;
        if (text) {
            options.push({ optionText: text, isCorrect: correct });
        }
    });

    if (options.length < 2) {
        showAlert('Legalább 2 válaszlehetőség szükséges.');
        return;
    }

    try {
        await createQuestion({ categoryId: Number(categoryId), questionText, answerType, options });
        showAlert('Kérdés létrehozva!', 'success');
        document.getElementById('newQuestionSzoveg').value = '';
        document.getElementById('optionsContainer').innerHTML = '';
        optionCount = 0;
    } catch (error) {
        showAlert(error.message);
    }
}

// --- ESEMÉNYKEZELŐK ---
logoutBtn.addEventListener('click', () => {
    clearToken();
    window.location.href = '/index.html';
});

submitTestBtn.addEventListener('click', submitTest);
backToTestsBtn.addEventListener('click', () => {
    hideAllViews();
    loadTests();
});

document.getElementById('createTestBtn').addEventListener('click', handleCreateTest);
document.getElementById('createCategoryBtn').addEventListener('click', handleCreateCategory);
document.getElementById('addOptionBtn').addEventListener('click', addOption);
document.getElementById('createQuestionBtn').addEventListener('click', handleCreateQuestion);

// ======== TESZT IMPORT (feltöltés + beolvasás) ========
let importToken = null;
const importResult = document.getElementById('importResult');
const importQuestionsEl = document.getElementById('importQuestions');

function escapeHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function resetImportView() {
    importToken = null;
    importResult.classList.add('hidden');
    importQuestionsEl.innerHTML = '';
    document.getElementById('importFile').value = '';
    document.getElementById('baremFile').value = '';
}

function renderImportPreview(preview) {
    document.getElementById('importTitle').value = preview.title || '';
    document.getElementById('importDesc').value = preview.description || '';
    document.getElementById('importTime').value = preview.timeLimitMinutes ? preview.timeLimitMinutes : '';
    importQuestionsEl.innerHTML = '';

    preview.questions.forEach(q => {
        const block = document.createElement('div');
        block.className = 'question-block import-question';
        block.dataset.num = q.num;

        const head = document.createElement('div');
        head.className = 'form-row';
        head.innerHTML = `<label>Kérdés ${escapeHtml(q.num)}:</label>`;
        block.appendChild(head);

        const ta = document.createElement('textarea');
        ta.className = 'import-q-text';
        ta.value = q.text;
        ta.rows = 2;
        ta.style.width = '100%';
        block.appendChild(ta);

        q.options.forEach(opt => {
            const row = document.createElement('div');
            row.className = 'form-row';
            const txtInput = document.createElement('input');
            txtInput.type = 'text';
            txtInput.className = 'import-opt-text';
            txtInput.value = opt.text;
            txtInput.style.width = '100%';
            const label = document.createElement('label');
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'import-opt-correct';
            cb.checked = !!opt.isCorrect;
            label.appendChild(cb);
            label.appendChild(document.createTextNode(' Helyes'));
            row.appendChild(txtInput);
            row.appendChild(label);
            block.appendChild(row);
        });

        importQuestionsEl.appendChild(block);
    });
}

function collectImportData() {
    const questions = [];
    document.querySelectorAll('#importQuestions .import-question').forEach(block => {
        const text = block.querySelector('.import-q-text').value.trim();
        const opts = [];
        block.querySelectorAll('.form-row').forEach(row => {
            const t = row.querySelector('.import-opt-text');
            const c = row.querySelector('.import-opt-correct');
            if (t && t.value.trim()) {
                opts.push({ text: t.value.trim(), isCorrect: c ? c.checked : false });
            }
        });
        if (text && opts.length >= 2) {
            questions.push({ text, options: opts });
        }
    });
    return {
        title: document.getElementById('importTitle').value.trim(),
        description: document.getElementById('importDesc').value.trim(),
        timeLimitMinutes: document.getElementById('importTime').value ? Number(document.getElementById('importTime').value) : null,
        questions,
    };
}

document.getElementById('importBtn').addEventListener('click', async () => {
    const fileInput = document.getElementById('importFile');
    const file = fileInput.files && fileInput.files[0];
    if (!file) { showAlert('Válassz egy tesztfájlt (docx/pdf).'); return; }
    const formData = new FormData();
    formData.append('file', file);
    try {
        const data = await uploadTestFile(formData);
        importToken = data.preview.token;
        renderImportPreview(data.preview);
        importResult.classList.remove('hidden');
        showAlert(data.message, 'success');
    } catch (error) {
        showAlert(error.message);
    }
});

document.getElementById('baremBtn').addEventListener('click', async () => {
    if (!importToken) { showAlert('Előbb feltölt a tesztet.'); return; }
    const fileInput = document.getElementById('baremFile');
    const file = fileInput.files && fileInput.files[0];
    if (!file) { showAlert('Válassz egy javítókulcs fájlt.'); return; }
    const formData = new FormData();
    formData.append('file', file);
    try {
        const data = await uploadAnswerKey(importToken, formData);
        renderImportPreview(data.preview);
        showAlert(data.message, 'success');
    } catch (error) {
        showAlert(error.message);
    }
});

document.getElementById('approveImportBtn').addEventListener('click', async () => {
    if (!importToken) { showAlert('Előbb feltölt a tesztet.'); return; }
    const data = collectImportData();
    if (data.questions.length === 0) { showAlert('Nincs érvényes kérdés a mentésre.'); return; }
    try {
        const result = await approveImport(importToken, data);
        showAlert(result.message, 'success');
        resetImportView();
        loadTests();
    } catch (error) {
        showAlert(error.message);
    }
});

document.getElementById('cancelImportBtn').addEventListener('click', () => {
    resetImportView();
});

// --- INDÍTÁS ---
loadUser();
loadTests();
loadAttempts();