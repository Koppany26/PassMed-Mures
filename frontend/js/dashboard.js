// PassMed - Vezérlőpult logika
import {
    getToken, clearToken, getMe,
    getTests, getTestById, startAttempt, submitAttempt, getMyAttempts,
    getCategories, createCategory, createQuestion, createTest
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
        userNameEl.textContent = currentUser.nev;
        userRoleEl.textContent = currentUser.szerepkor;

        // Tanár panel megjelenítése
        if (currentUser.szerepkor === 'TANAR' || currentUser.szerepkor === 'ADMIN') {
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
            info.innerHTML = `<h4>${test.cim}</h4><p>${test.leiras || 'Nincs leírás'}</p>`;

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

        testTitle.textContent = currentTest.cim;
        testDescription.textContent = currentTest.leiras || '';

        // Kérdések megjelenítése
        questionsContainer.innerHTML = '';
        selectedAnswers = {};

        currentTest.questions.forEach((q, qIndex) => {
            const block = document.createElement('div');
            block.className = 'question-block';

            const qTitle = document.createElement('h4');
            qTitle.textContent = `${qIndex + 1}. ${q.kerdesSzovege}`;
            block.appendChild(qTitle);

            const list = document.createElement('ul');
            list.className = 'option-list';

            q.options.forEach(opt => {
                const li = document.createElement('li');
                const label = document.createElement('label');

                const input = document.createElement('input');
                input.type = q.valaszTipus === 'TOBBSZOROS' ? 'checkbox' : 'radio';
                input.name = `question_${q.id}`;
                input.value = opt.id;

                input.addEventListener('change', () => {
                    if (q.valaszTipus === 'TOBBSZOROS') {
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
                label.appendChild(document.createTextNode(opt.valaszSzovege));
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
    const valaszok = Object.entries(selectedAnswers).map(([kerdesId, opcioIdk]) => ({
        kerdesId: Number(kerdesId),
        opcioIdk,
    }));

    try {
        const data = await submitAttempt(currentAttemptId, valaszok);

        // Eredmény megjelenítése
        hideAllViews();
        resultView.classList.remove('hidden');
        resultScore.textContent = `${data.osszpontszam}/${data.maxPontszam}`;

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
            info.innerHTML = `<h4>${att.tesztCim}</h4><p>${new Date(att.kezdesIdeje).toLocaleString('hu-HU')}</p>`;

            const badge = document.createElement('span');
            badge.className = `status-badge status-${att.statusz}`;
            badge.textContent = att.statusz === 'BEFEJEZVE' ? `Befejezve (${att.osszpontszam} pont)` : att.statusz;

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
            opt.textContent = cat.nev;
            select.appendChild(opt);
        });
    } catch (error) {
        showAlert(error.message);
    }
}

// --- TANÁR: ÚJ TESZT ---
async function handleCreateTest() {
    const cim = document.getElementById('newTestCim').value.trim();
    const leiras = document.getElementById('newTestLeiras').value.trim();
    const ido = document.getElementById('newTestIdo').value;

    if (!cim) {
        showAlert('A teszt címe kötelező.');
        return;
    }

    try {
        await createTest({ cim, leiras, idoKorlatPercben: ido ? Number(ido) : null });
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
    const nev = document.getElementById('newCategoryNev').value.trim();
    if (!nev) {
        showAlert('A kategória neve kötelező.');
        return;
    }

    try {
        await createCategory(nev);
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
    const kategoriaId = document.getElementById('newQuestionKategoria').value;
    const kerdesSzovege = document.getElementById('newQuestionSzoveg').value.trim();
    const valaszTipus = document.getElementById('newQuestionTipus').value;

    if (!kategoriaId) {
        showAlert('Válassz kategóriát!');
        return;
    }
    if (!kerdesSzovege) {
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
            options.push({ valaszSzovege: text, helyesE: correct });
        }
    });

    if (options.length < 2) {
        showAlert('Legalább 2 válaszlehetőség szükséges.');
        return;
    }

    try {
        await createQuestion({ kategoriaId: Number(kategoriaId), kerdesSzovege, valaszTipus, options });
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

// --- INDÍTÁS ---
loadUser();
loadTests();
loadAttempts();