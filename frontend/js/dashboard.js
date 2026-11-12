// PassMed - Vezérlőpult logika
import {
    getToken, clearToken, getMe,
    getTests, getTestById, startAttempt, submitAttempt, getMyAttempts, logProctorEvent,
    getCategories, getTopics, getBodyRegions, updateTopicBodyRegion,
    getTopicMaterials, uploadTopicMaterial, getUploadUrl,
    getQuestions, answerTopicPractice, createCategory, createQuestion, createTest,
    createStudentPracticeTest,
    updateTest, updateTestQuestion, addQuestionToTest, removeQuestionFromTest,
    reportTestIssue, getOpenTestReports, resolveTestReport,
    getMyGroups, createGroup, inviteToGroup, assignTestToGroup, getGroupAttempts,
    getMyGroupInvitations, acceptGroupInvitation,
    uploadTestFile, getImportPreview, uploadAnswerKey, approveImport
} from './api.js';

// --- ÁLLAPOT ---
let currentUser = null;
let currentTest = null;
let currentAttemptId = null;
let selectedAnswers = {};
let categoryList = [];
let topicList = [];
let bodyRegionList = [];
let availableTests = [];
let editingTest = null;
let attemptTimerInterval = null;
let attemptDeadline = null;
let remainingAttemptSeconds = null;
let attemptPaused = false;
let tabSwitchLogged = false;
let reportRefreshInterval = null;

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
    document.getElementById('topicPracticePanel').classList.add('hidden');
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
            await loadCategories();
            await loadBodyMappings();
            await loadTestReports();
        } else if (currentUser.role === 'STUDENT') {
            document.getElementById('topicPracticePanel').classList.remove('hidden');
            document.getElementById('studentGroupsPanel').classList.remove('hidden');
            await loadCategories();
        }
        await loadTests();
        if (currentUser.role === 'TEACHER' || currentUser.role === 'ADMIN') {
            await loadGroups();
            if (reportRefreshInterval === null) {
                reportRefreshInterval = setInterval(loadTestReports, 60000);
            }
        } else if (currentUser.role === 'STUDENT') {
            await loadGroupInvitations();
        }
    } catch (error) {
        showAlert(error.message);
        clearToken();
        window.location.href = '/index.html';
    }
}

// --- CSOPORTOK ---
async function loadGroups() {
    const container = document.getElementById('teacherGroupsList');
    container.replaceChildren();
    try {
        const data = await getMyGroups();
        if (data.groups.length === 0) {
            container.textContent = 'Még nincs csoport.';
            return;
        }
        data.groups.forEach(group => {
            const card = document.createElement('article');
            card.className = 'question-block';
            const heading = document.createElement('h4');
            heading.textContent = `${group.name} · Meghívókód: ${group.joinCode}`;

            const inviteRow = document.createElement('div');
            inviteRow.className = 'form-row';
            const email = document.createElement('input');
            email.type = 'email';
            email.placeholder = 'Diák e-mail-címe';
            const inviteButton = document.createElement('button');
            inviteButton.type = 'button';
            inviteButton.className = 'btn btn-sm btn-secondary';
            inviteButton.textContent = 'Meghívás';
            inviteButton.addEventListener('click', async () => {
                try {
                    const result = await inviteToGroup(group.id, email.value);
                    showAlert(result.message, 'success');
                    email.value = '';
                } catch (error) {
                    showAlert(error.message);
                }
            });
            inviteRow.append(email, inviteButton);

            const assignRow = document.createElement('div');
            assignRow.className = 'form-row';
            const testSelect = document.createElement('select');
            testSelect.add(new Option('Megosztandó teszt kiválasztása...', ''));
            availableTests.filter(test => currentUser.role === 'ADMIN' || test.teacherId === currentUser.id)
                .forEach(test => testSelect.add(new Option(test.title, String(test.id))));
            const assignButton = document.createElement('button');
            assignButton.type = 'button';
            assignButton.className = 'btn btn-sm btn-primary';
            assignButton.textContent = 'Teszt megosztása';
            assignButton.addEventListener('click', async () => {
                if (!testSelect.value) {
                    showAlert('Válassz tesztet a megosztáshoz.');
                    return;
                }
                try {
                    const result = await assignTestToGroup(group.id, Number(testSelect.value));
                    showAlert(result.message, 'success');
                } catch (error) {
                    showAlert(error.message);
                }
            });
            assignRow.append(testSelect, assignButton);

            const attemptsButton = document.createElement('button');
            attemptsButton.type = 'button';
            attemptsButton.className = 'btn btn-sm btn-secondary';
            attemptsButton.textContent = 'Csoportkitöltések megtekintése';
            const attemptsContainer = document.createElement('div');
            attemptsButton.addEventListener('click', async () => {
                attemptsContainer.textContent = 'Betöltés...';
                try {
                    const result = await getGroupAttempts(group.id);
                    renderGroupAttempts(attemptsContainer, result.attempts);
                } catch (error) {
                    attemptsContainer.textContent = error.message;
                }
            });
            card.append(heading, inviteRow, assignRow, attemptsButton, attemptsContainer);
            container.appendChild(card);
        });
    } catch (error) {
        container.textContent = error.message;
        showAlert(error.message);
    }
}

function renderGroupAttempts(container, attempts) {
    container.replaceChildren();
    if (attempts.length === 0) {
        container.textContent = 'Még nincs megosztott teszten végzett kitöltés.';
        return;
    }
    attempts.forEach(attempt => {
        const card = document.createElement('article');
        card.className = 'question-block';
        const heading = document.createElement('h4');
        heading.textContent = `${attempt.studentName} · ${attempt.testTitle}`;
        const score = document.createElement('p');
        score.textContent = `${attempt.status} · ${attempt.totalScore ?? '—'} pont`;
        card.append(heading, score);
        (attempt.answers || []).forEach(answer => {
            const detail = document.createElement('p');
            const selected = answer.selectedOptions.map(option => option.optionText).join(', ') || 'Nem válaszolt';
            const correct = answer.correctOptions.map(option => option.optionText).join(', ');
            detail.textContent = `${answer.questionText} — diák válasza: ${selected}; helyes: ${correct}`;
            card.appendChild(detail);
        });
        container.appendChild(card);
    });
}

async function loadGroupInvitations() {
    const container = document.getElementById('studentInvitationsList');
    container.replaceChildren();
    try {
        const data = await getMyGroupInvitations();
        if (data.invitations.length === 0) {
            container.textContent = 'Nincs függő csoportmeghívód.';
            return;
        }
        data.invitations.forEach(invitation => {
            const row = document.createElement('div');
            row.className = 'form-row';
            const label = document.createElement('span');
            label.textContent = invitation.groupName;
            const acceptButton = document.createElement('button');
            acceptButton.type = 'button';
            acceptButton.className = 'btn btn-sm btn-primary';
            acceptButton.textContent = 'Meghívó elfogadása';
            acceptButton.addEventListener('click', async () => {
                try {
                    const result = await acceptGroupInvitation(invitation.id);
                    showAlert(result.message, 'success');
                    await loadGroupInvitations();
                } catch (error) {
                    showAlert(error.message);
                }
            });
            row.append(label, acceptButton);
            container.appendChild(row);
        });
    } catch (error) {
        container.textContent = error.message;
    }
}

async function loadBodyMappings() {
    const container = document.getElementById('bodyMappingsList');
    container.replaceChildren();
    try {
        const [topicData, regionData] = await Promise.all([getTopics(), getBodyRegions()]);
        const materialTopicSelect = document.getElementById('materialTopicSelect');
        materialTopicSelect.replaceChildren(new Option('Témakör kiválasztása...', ''));
        topicData.topics.forEach(topic => {
            materialTopicSelect.add(new Option(topic.name, String(topic.id)));
        });
        if (topicData.topics.length === 0) {
            container.textContent = 'Nincs beállítható témakör.';
            return;
        }
        topicData.topics.forEach(topic => {
            const row = document.createElement('div');
            row.className = 'form-row body-mapping-row';
            const label = document.createElement('label');
            label.textContent = topic.name;
            const select = document.createElement('select');
            select.add(new Option('Nincs hozzárendelve', ''));
            regionData.regions.forEach(region => {
                select.add(new Option(region.name, String(region.id)));
            });
            select.value = topic.bodyRegionId ? String(topic.bodyRegionId) : '';
            const saveButton = document.createElement('button');
            saveButton.type = 'button';
            saveButton.className = 'btn btn-sm btn-secondary';
            saveButton.textContent = 'Mentés';
            saveButton.addEventListener('click', async () => {
                saveButton.disabled = true;
                try {
                    await updateTopicBodyRegion(topic.id, select.value ? Number(select.value) : null);
                    showAlert('A témakör testrész-hozzárendelése mentve.', 'success');
                } catch (error) {
                    showAlert(error.message);
                } finally {
                    saveButton.disabled = false;
                }
            });
            row.append(label, select, saveButton);
            container.appendChild(row);
        });
    } catch (error) {
        container.textContent = error.message;
        showAlert(error.message);
    }
}

function updatePracticeTestBodyMap() {
    const container = document.getElementById('practiceTestBodyMapContainer');
    const summary = document.getElementById('practiceTestSelectedRegions');
    const selectedTopics = Array.from(
        document.getElementById('practiceTestTopics').selectedOptions,
        option => topicList.find(topic => topic.id === Number(option.value)),
    ).filter(Boolean);

    summary.replaceChildren();
    const shapeElements = [...document.querySelectorAll('#practiceTestBodyMap .body-region')];
    shapeElements.forEach(element => { element.style.fill = '#d1d5db'; });
    container.classList.toggle('hidden', selectedTopics.length === 0);
    if (selectedTopics.length === 0) return;

    const selectedRegionIds = new Set(
        selectedTopics.map(topic => topic.bodyRegionId).filter(Boolean),
    );
    const selectedRegions = bodyRegionList.filter(region => selectedRegionIds.has(region.id));
    const mappedSvgIds = new Set(selectedRegions.map(region => `practice-${region.svgRegionId}`));
    if (selectedRegions.some(region => region.regionKey === 'whole_body')) {
        shapeElements.forEach(element => { element.style.fill = '#d94f4f'; });
    } else {
        mappedSvgIds.forEach(id => {
            const shape = document.getElementById(id);
            if (shape) shape.style.fill = '#d94f4f';
        });
    }

    if (selectedRegions.length === 0) {
        const item = document.createElement('li');
        item.textContent = 'A kiválasztott témakörökhöz a tanár még nem rendelt testrészt.';
        summary.appendChild(item);
        return;
    }
    selectedRegions.forEach(region => {
        const item = document.createElement('li');
        item.textContent = region.name;
        summary.appendChild(item);
    });
}

async function loadTopicMaterials(topicId) {
    const container = document.getElementById('topicMaterialsList');
    container.replaceChildren();
    try {
        const data = await getTopicMaterials(topicId);
        if (data.materials.length === 0) {
            container.textContent = 'Ehhez a témakörhöz még nincs feltöltött tananyag.';
            return;
        }
        data.materials.forEach(material => {
            const row = document.createElement('p');
            const link = document.createElement('a');
            link.href = getUploadUrl(material.fileUrl);
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = `${material.title} (${material.fileType})`;
            row.appendChild(link);
            if (material.teacherName) {
                row.appendChild(document.createTextNode(` · ${material.teacherName}`));
            }
            container.appendChild(row);
        });
    } catch (error) {
        container.textContent = error.message;
    }
}

// --- TESZTEK BETÖLTÉSE ---
async function loadTests() {
    try {
        const data = await getTests();
        availableTests = data.tests;
        testListEl.innerHTML = '';

        if (data.tests.length === 0) {
            testListEl.innerHTML = '<li>Nincs elérhető teszt.</li>';
            const editSelect = document.getElementById('editTestSelect');
            editSelect.innerHTML = '<option value="">Nincs szerkeszthető teszt</option>';
        }

        data.tests.forEach(test => {
            const li = document.createElement('li');
            li.className = 'test-item';

            const info = document.createElement('div');
            info.className = 'test-info';
            const title = document.createElement('h4');
            title.textContent = test.title;
            const description = document.createElement('p');
            const testDetails = [
                test.description || 'Nincs leírás',
                test.testType === 'EXAM' ? 'Vizsga' : 'Próba',
                test.allowBreak ? 'Szünet engedélyezett' : null,
            ].filter(Boolean);
            description.textContent = testDetails.join(' · ');
            info.append(title, description);

            const btn = document.createElement('button');
            btn.className = 'btn btn-sm btn-primary';
            btn.textContent = 'Kitöltés';
            btn.addEventListener('click', () => openTest(test.id));

            li.appendChild(info);
            if (currentUser && (currentUser.role === 'ADMIN' || test.teacherId === currentUser.id)) {
                const editBtn = document.createElement('button');
                editBtn.className = 'btn btn-sm btn-secondary';
                editBtn.textContent = 'Szerkesztés';
                editBtn.addEventListener('click', () => {
                    document.getElementById('editTestSelect').value = String(test.id);
                    loadTestForEditing(test.id);
                    document.getElementById('teacherPanel').scrollIntoView({ behavior: 'smooth' });
                });
                const actions = document.createElement('div');
                actions.className = 'test-actions';
                actions.append(editBtn, btn);
                li.appendChild(actions);
            } else {
                li.appendChild(btn);
            }
            testListEl.appendChild(li);
        });

        const editSelect = document.getElementById('editTestSelect');
        editSelect.innerHTML = '<option value="">Teszt kiválasztása...</option>';
        const editableTests = data.tests.filter(test =>
            currentUser && (currentUser.role === 'ADMIN' || test.teacherId === currentUser.id)
        );
        if (editableTests.length === 0) {
            editSelect.innerHTML = '<option value="">Nincs saját szerkeszthető teszt</option>';
        }
        editableTests.forEach(test => {
            const option = document.createElement('option');
            option.value = test.id;
            option.textContent = test.title;
            editSelect.appendChild(option);
        });
    } catch (error) {
        showAlert(error.message);
    }
}

async function loadTestReports() {
    const list = document.getElementById('testReportsList');
    const count = document.getElementById('testReportCount');
    try {
        const data = await getOpenTestReports();
        count.textContent = `(${data.reports.length})`;
        list.innerHTML = '';
        if (data.reports.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'editor-hint';
            empty.textContent = 'Nincs új hibajelzés.';
            list.appendChild(empty);
            return;
        }

        data.reports.forEach(report => {
            const card = document.createElement('div');
            card.className = 'question-block';
            const heading = document.createElement('h4');
            heading.textContent = report.testTitle;
            const details = document.createElement('p');
            details.textContent = report.questionText
                ? `Érintett kérdés: ${report.questionText}`
                : 'A teljes tesztet érinti.';
            const message = document.createElement('p');
            message.textContent = report.message;
            const reporter = document.createElement('p');
            reporter.className = 'editor-hint';
            reporter.textContent = `${report.reporterName || 'Ismeretlen diák'} · ${new Date(report.createdAt).toLocaleString('hu-HU')}`;
            const actions = document.createElement('div');
            actions.className = 'test-actions';
            const editButton = document.createElement('button');
            editButton.type = 'button';
            editButton.className = 'btn btn-sm btn-secondary';
            editButton.textContent = 'Teszt javítása';
            editButton.addEventListener('click', async () => {
                document.getElementById('editTestSelect').value = String(report.testId);
                await loadTestForEditing(report.testId);
                document.getElementById('testEditor').scrollIntoView({ behavior: 'smooth' });
            });
            const resolveButton = document.createElement('button');
            resolveButton.type = 'button';
            resolveButton.className = 'btn btn-sm btn-primary';
            resolveButton.textContent = 'Lezárás';
            resolveButton.addEventListener('click', async () => {
                try {
                    await resolveTestReport(report.id);
                    await loadTestReports();
                } catch (error) {
                    showAlert(error.message);
                }
            });
            actions.append(editButton, resolveButton);
            card.append(heading, details, message, reporter, actions);
            list.appendChild(card);
        });
    } catch (error) {
        count.textContent = '';
        list.textContent = error.message;
        showAlert(error.message);
    }
}

// --- TESZT MEGNYITÁSA ---
async function openTest(testId) {
    try {
        stopAttemptTimer();
        const data = await getTestById(testId);
        currentTest = data.test;

        // Kitöltés indítása
        const attemptData = await startAttempt(testId);
        currentAttemptId = attemptData.attempt.id;

        // Nézetek váltása
        hideAllViews();
        testView.classList.remove('hidden');

        testTitle.textContent = currentTest.title;
        testDescription.textContent = [
            currentTest.description || '',
            currentTest.testType === 'EXAM' && currentTest.allowTabSwitch === false
                ? 'Vizsgamód: az oldal elhagyását a rendszer naplózza.'
                : '',
        ].filter(Boolean).join(' · ');
        tabSwitchLogged = false;
        const reportForm = document.getElementById('testReportForm');
        reportForm.classList.toggle('hidden', currentUser.role !== 'STUDENT');
        const reportQuestionSelect = document.getElementById('reportQuestionSelect');
        reportQuestionSelect.replaceChildren(new Option('A teljes teszt', ''));
        currentTest.questions.forEach((question, index) => {
            reportQuestionSelect.add(new Option(`Kérdés ${index + 1}`, String(question.id)));
        });
        document.getElementById('reportMessage').value = '';
        initializeAttemptControls();

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

function stopAttemptTimer() {
    if (attemptTimerInterval) {
        clearInterval(attemptTimerInterval);
        attemptTimerInterval = null;
    }
    attemptDeadline = null;
    remainingAttemptSeconds = null;
    attemptPaused = false;
}

document.addEventListener('visibilitychange', () => {
    if (!currentAttemptId || currentTest?.testType !== 'EXAM'
        || currentTest.allowTabSwitch !== false || !document.hidden || tabSwitchLogged) return;
    tabSwitchLogged = true;
    logProctorEvent(currentAttemptId, 'TAB_SWITCH').catch(error => showAlert(error.message));
});

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function updateAttemptTimer() {
    if (attemptDeadline === null) return;
    remainingAttemptSeconds = Math.max(0, Math.ceil((attemptDeadline - Date.now()) / 1000));
    document.getElementById('attemptTimer').textContent = `Hátralévő idő: ${formatTime(remainingAttemptSeconds)}`;
    if (remainingAttemptSeconds === 0) {
        clearInterval(attemptTimerInterval);
        attemptTimerInterval = null;
        submitTest();
    }
}

function startAttemptTimer() {
    attemptDeadline = Date.now() + remainingAttemptSeconds * 1000;
    updateAttemptTimer();
    if (remainingAttemptSeconds > 0) {
        attemptTimerInterval = setInterval(updateAttemptTimer, 250);
    }
}

function initializeAttemptControls() {
    const controls = document.getElementById('attemptControls');
    const pauseButton = document.getElementById('pauseTestBtn');
    const timer = document.getElementById('attemptTimer');
    const hasTimer = Number.isInteger(currentTest.timeLimitMinutes) && currentTest.timeLimitMinutes > 0;
    const canPause = currentTest.allowBreak === true;

    controls.classList.toggle('hidden', !hasTimer && !canPause);
    pauseButton.classList.toggle('hidden', !canPause);
    pauseButton.textContent = 'Szünet';
    document.getElementById('submitTestBtn').disabled = false;
    document.querySelectorAll('#questionsContainer input').forEach(input => { input.disabled = false; });

    if (hasTimer) {
        remainingAttemptSeconds = currentTest.timeLimitMinutes * 60;
        timer.classList.remove('hidden');
        startAttemptTimer();
    } else {
        timer.textContent = '';
        timer.classList.add('hidden');
    }
}

function toggleAttemptPause() {
    if (!currentAttemptId || currentTest.allowBreak !== true) return;
    const pauseButton = document.getElementById('pauseTestBtn');
    const isPausedNow = !attemptPaused;

    if (isPausedNow && attemptDeadline !== null) {
        remainingAttemptSeconds = Math.max(0, Math.ceil((attemptDeadline - Date.now()) / 1000));
        clearInterval(attemptTimerInterval);
        attemptTimerInterval = null;
        attemptDeadline = null;
    } else if (!isPausedNow && remainingAttemptSeconds !== null) {
        startAttemptTimer();
    }

    attemptPaused = isPausedNow;
    pauseButton.textContent = attemptPaused ? 'Folytatás' : 'Szünet';
    document.querySelectorAll('#questionsContainer input').forEach(input => { input.disabled = attemptPaused; });
    document.getElementById('submitTestBtn').disabled = attemptPaused;
}

// --- TESZT BEADÁSA ---
async function submitTest() {
    if (!currentAttemptId || attemptPaused) return;

    // Válaszok összegyűjtése
    const answers = Object.entries(selectedAnswers).map(([questionId, optionIds]) => ({
        questionId: Number(questionId),
        optionIds,
    }));

    try {
        const data = await submitAttempt(currentAttemptId, answers);

        // Eredmény megjelenítése
        stopAttemptTimer();
        currentAttemptId = null;
        hideAllViews();
        resultView.classList.remove('hidden');
        resultScore.textContent = `${data.totalScore}/${data.maxScore}`;
        const feedbackContainer = document.getElementById('attemptFeedback');
        feedbackContainer.replaceChildren();
        if (Array.isArray(data.feedback)) {
            data.feedback.forEach(item => {
                const card = document.createElement('article');
                card.className = 'question-block';
                const heading = document.createElement('h4');
                heading.textContent = `${item.isCorrect ? 'Helyes' : 'Helytelen'}: ${item.questionText}`;
                const detail = document.createElement('p');
                detail.textContent = item.explanation
                    || `Helyes válasz(ok): ${item.correctOptions.join(', ')}`;
                card.append(heading, detail);
                feedbackContainer.appendChild(card);
            });
        }

        // Kitöltések frissítése
        loadAttempts();
    } catch (error) {
        if (remainingAttemptSeconds === 0) {
            document.getElementById('submitTestBtn').disabled = false;
        }
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
        const [categoryData, topicData, bodyRegionData] = await Promise.all([
            getCategories(),
            getTopics(),
            getBodyRegions(),
        ]);
        categoryList = categoryData.categories;
        topicList = topicData.topics;
        bodyRegionList = bodyRegionData.regions;
        fillCategorySelect(document.getElementById('newQuestionKategoria'), 'Vizsgatárgy kiválasztása...');
        fillCategorySelect(document.getElementById('bankCategorySelect'), 'Vizsgatárgy szűrése...');
        fillCategorySelect(document.getElementById('practiceCategorySelect'), 'Vizsgatárgy kiválasztása...');
        fillCategorySelect(document.getElementById('importCategory'), 'Vizsgatárgy kiválasztása...');
        const practiceCategory = document.getElementById('practiceCategorySelect');
        if (categoryList.length > 0) practiceCategory.value = String(categoryList[0].id);
        fillTopicSelect(document.getElementById('newQuestionTopics'), '');
        fillTopicSelect(document.getElementById('practiceTopicSelect'), practiceCategory.value);
        fillTopicSelect(document.getElementById('practiceTestTopics'), practiceCategory.value);
    } catch (error) {
        showAlert(error.message);
    }
}

async function loadTopicPracticeQuestions() {
    const categoryId = document.getElementById('practiceCategorySelect').value;
    const topicId = document.getElementById('practiceTopicSelect').value;
    const container = document.getElementById('topicPracticeQuestions');
    container.replaceChildren();
    if (!categoryId || !topicId) {
        showAlert('Válassz vizsgatárgyat és témakört.');
        return;
    }

    await loadTopicMaterials(topicId);
    try {
        const data = await getQuestions(categoryId, topicId);
        if (data.questions.length === 0) {
            container.textContent = 'Ehhez a témakörhöz még nincs kérdés.';
            return;
        }
        data.questions.forEach((question, index) => {
            const card = document.createElement('article');
            card.className = 'question-block';
            const heading = document.createElement('h4');
            heading.textContent = `${index + 1}. ${question.questionText}`;
            card.appendChild(heading);
            const optionsList = document.createElement('div');
            const optionType = question.answerType === 'MULTIPLE' ? 'checkbox' : 'radio';
            question.options.forEach(option => {
                const label = document.createElement('label');
                label.className = 'form-row';
                const input = document.createElement('input');
                input.type = optionType;
                input.name = `practice_${question.id}`;
                input.value = option.id;
                label.append(input, document.createTextNode(option.optionText));
                optionsList.appendChild(label);
            });
            const checkButton = document.createElement('button');
            checkButton.type = 'button';
            checkButton.className = 'btn btn-sm btn-primary';
            checkButton.textContent = 'Válasz ellenőrzése';
            const feedback = document.createElement('p');
            feedback.setAttribute('aria-live', 'polite');
            checkButton.addEventListener('click', async () => {
                const selectedIds = Array.from(optionsList.querySelectorAll('input:checked'), input => Number(input.value));
                if (selectedIds.length === 0) {
                    showAlert('Válassz ki legalább egy választ.');
                    return;
                }
                checkButton.disabled = true;
                try {
                    const result = await answerTopicPractice(question.id, topicId, selectedIds);
                    feedback.textContent = `${result.isCorrect ? 'Helyes válasz!' : 'Nem helyes.'} ${
                        result.explanation || `Helyes válasz(ok): ${result.correctOptions.join(', ')}`
                    }`;
                    feedback.className = result.isCorrect ? 'alert-success' : 'alert-error';
                    optionsList.querySelectorAll('input').forEach(input => { input.disabled = true; });
                } catch (error) {
                    checkButton.disabled = false;
                    showAlert(error.message);
                }
            });
            card.append(heading, optionsList, checkButton, feedback);
            container.appendChild(card);
        });
    } catch (error) {
        showAlert(error.message);
    }
}

function fillTopicSelect(select, categoryId, selectedIds = []) {
    select.replaceChildren();
    const selected = new Set(selectedIds.map(Number));
    const matchingTopics = topicList.filter(topic => String(topic.categoryId) === String(categoryId));
    matchingTopics.forEach(topic => {
        const option = new Option(topic.name, String(topic.id));
        option.selected = selected.has(topic.id);
        select.add(option);
    });
    select.disabled = matchingTopics.length === 0;
}

function getSelectedTopicIds(select) {
    return Array.from(select.selectedOptions, option => Number(option.value));
}

function fillCategorySelect(select, placeholder, selectedId = '') {
    select.innerHTML = '';
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = placeholder;
    select.appendChild(empty);
    categoryList.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.name;
        option.selected = String(category.id) === String(selectedId);
        select.appendChild(option);
    });
}

async function loadTestForEditing(testId) {
    const editor = document.getElementById('testEditor');
    try {
        const data = await getTestById(testId);
        editingTest = data.test;
        document.getElementById('editTestSelect').value = String(testId);
        document.getElementById('editTestTitle').value = editingTest.title;
        document.getElementById('editTestDescription').value = editingTest.description || '';
        document.getElementById('editTestTime').value = editingTest.timeLimitMinutes || '';
        document.getElementById('editTestType').value = editingTest.testType || 'PRACTICE';
        document.getElementById('editTestAllowBreak').checked = editingTest.allowBreak === true;
        renderEditableQuestions();
        editor.classList.remove('hidden');
        await loadBankQuestions();
    } catch (error) {
        editingTest = null;
        editor.classList.add('hidden');
        showAlert(error.message);
    }
}

function renderEditableQuestions() {
    const container = document.getElementById('editTestQuestions');
    container.innerHTML = '';
    const questions = editingTest.questions || [];
    document.getElementById('editQuestionCount').textContent =
        `${questions.length} ${questions.length === 1 ? 'kérdés' : 'kérdés'}`;

    if (questions.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'editor-hint';
        empty.textContent = 'Ehhez a teszthez még nincs kérdés. A kérdésbankból hozzáadhatsz egyet.';
        container.appendChild(empty);
    }

    questions.forEach((question, index) => {
        const card = document.createElement('article');
        card.className = 'question-block editor-question';

        const heading = document.createElement('div');
        heading.className = 'editor-question-heading';
        const number = document.createElement('span');
        number.className = 'question-number';
        number.textContent = `KÉRDÉS ${index + 1}`;
        heading.appendChild(number);
        card.appendChild(heading);

        const text = document.createElement('textarea');
        text.className = 'edit-question-text';
        text.value = question.questionText;
        text.rows = 3;
        text.setAttribute('aria-label', `Kérdés ${index + 1} szövege`);
        card.appendChild(text);

        const settings = document.createElement('div');
        settings.className = 'editor-question-settings';
        const category = document.createElement('select');
        category.className = 'edit-question-category';
        category.setAttribute('aria-label', `Kérdés ${index + 1} vizsgatárgya`);
        fillCategorySelect(category, 'Vizsgatárgy kiválasztása...', question.categoryId);
        const topicSelect = document.createElement('select');
        topicSelect.className = 'edit-question-topics';
        topicSelect.multiple = true;
        topicSelect.size = 5;
        topicSelect.setAttribute('aria-label', `Kérdés ${index + 1} témakörei`);
        fillTopicSelect(topicSelect, question.categoryId, (question.topics || []).map(topic => topic.id));
        category.addEventListener('change', () => fillTopicSelect(topicSelect, category.value));
        const type = document.createElement('select');
        type.className = 'edit-question-type';
        type.setAttribute('aria-label', `Kérdés ${index + 1} válaszadási módja`);
        [
            { value: 'SINGLE', label: 'Egyszeres választás' },
            { value: 'MULTIPLE', label: 'Többszörös választás' },
        ].forEach(item => {
            const option = document.createElement('option');
            option.value = item.value;
            option.textContent = item.label;
            option.selected = question.answerType === item.value;
            type.appendChild(option);
        });
        const points = document.createElement('input');
        points.className = 'edit-question-points';
        points.type = 'number';
        points.min = '1';
        points.value = question.points || 1;
        points.setAttribute('aria-label', `Kérdés ${index + 1} pontértéke`);
        settings.append(category, topicSelect, type, points);
        card.appendChild(settings);

        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'edit-question-options';
        (question.options || []).forEach(option => {
            optionsContainer.appendChild(createEditableOption(option.optionText, option.isCorrect));
        });
        card.appendChild(optionsContainer);

        const actions = document.createElement('div');
        actions.className = 'editor-question-actions';
        const addOptionButton = document.createElement('button');
        addOptionButton.type = 'button';
        addOptionButton.className = 'btn btn-sm btn-secondary';
        addOptionButton.textContent = '+ Válaszlehetőség';
        addOptionButton.addEventListener('click', () => optionsContainer.appendChild(createEditableOption('', false)));

        const saveButton = document.createElement('button');
        saveButton.type = 'button';
        saveButton.className = 'btn btn-sm btn-primary';
        saveButton.textContent = 'Kérdés mentése';
        saveButton.addEventListener('click', () => saveEditedQuestion(question.id, card));

        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'btn btn-sm btn-danger';
        removeButton.textContent = 'Eltávolítás';
        removeButton.addEventListener('click', () => removeEditedQuestion(question.id));
        actions.append(addOptionButton, saveButton, removeButton);
        card.appendChild(actions);
        container.appendChild(card);
    });
}

function createEditableOption(value, isCorrect) {
    const row = document.createElement('div');
    row.className = 'editor-option';
    const text = document.createElement('input');
    text.type = 'text';
    text.className = 'edit-option-text';
    text.placeholder = 'Válaszlehetőség';
    text.value = value || '';
    const correctLabel = document.createElement('label');
    const correct = document.createElement('input');
    correct.type = 'checkbox';
    correct.className = 'edit-option-correct';
    correct.checked = !!isCorrect;
    correctLabel.append(correct, document.createTextNode(' Helyes'));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'option-remove';
    remove.textContent = 'Törlés';
    remove.addEventListener('click', () => row.remove());
    row.append(text, correctLabel, remove);
    return row;
}

async function saveEditedQuestion(questionId, card) {
    const options = Array.from(card.querySelectorAll('.editor-option')).map(row => ({
        optionText: row.querySelector('.edit-option-text').value.trim(),
        isCorrect: row.querySelector('.edit-option-correct').checked,
    })).filter(option => option.optionText);
    const data = {
        categoryId: Number(card.querySelector('.edit-question-category').value),
        topicIds: getSelectedTopicIds(card.querySelector('.edit-question-topics')),
        questionText: card.querySelector('.edit-question-text').value.trim(),
        answerType: card.querySelector('.edit-question-type').value,
        points: Number(card.querySelector('.edit-question-points').value),
        options,
    };
    if (!data.categoryId) {
        showAlert('Válassz vizsgatárgyat a kérdéshez.');
        return;
    }
    if (!data.questionText || options.length < 2) {
        showAlert('A kérdés szövege és legalább 2 válaszlehetőség szükséges.');
        return;
    }
    try {
        await updateTestQuestion(editingTest.id, questionId, data);
        await loadTestForEditing(editingTest.id);
        showAlert('Kérdés és téma mentve!', 'success');
    } catch (error) {
        showAlert(error.message);
    }
}

async function removeEditedQuestion(questionId) {
    if (!window.confirm('Biztosan eltávolítod ezt a kérdést a tesztből?')) return;
    try {
        await removeQuestionFromTest(editingTest.id, questionId);
        await loadTestForEditing(editingTest.id);
        showAlert('Kérdés eltávolítva a tesztből.', 'success');
    } catch (error) {
        showAlert(error.message);
    }
}

async function loadBankQuestions() {
    const categoryId = document.getElementById('bankCategorySelect').value;
    const select = document.getElementById('bankQuestionSelect');
    const addButton = document.getElementById('addBankQuestionBtn');
    select.innerHTML = '';
    if (!categoryId) {
        select.add(new Option('Előbb válassz témát...', ''));
        select.disabled = true;
        addButton.disabled = true;
        return;
    }
    try {
        const data = await getQuestions(categoryId);
        const existingIds = new Set((editingTest.questions || []).map(question => question.id));
        const available = data.questions.filter(question => !existingIds.has(question.id));
        if (available.length === 0) {
            select.add(new Option('Nincs hozzáadható kérdés ebben a témában', ''));
            select.disabled = true;
            addButton.disabled = true;
            return;
        }
        select.add(new Option('Kérdés kiválasztása...', ''));
        available.forEach(question => {
            const option = document.createElement('option');
            option.value = question.id;
            option.textContent = question.questionText;
            select.appendChild(option);
        });
        select.disabled = false;
        addButton.disabled = false;
    } catch (error) {
        showAlert(error.message);
    }
}

async function addBankQuestion() {
    const questionId = Number(document.getElementById('bankQuestionSelect').value);
    if (!questionId || !editingTest) {
        showAlert('Válassz ki egy kérdést a hozzáadáshoz.');
        return;
    }
    try {
        await addQuestionToTest(editingTest.id, questionId);
        await loadTestForEditing(editingTest.id);
        showAlert('Kérdés hozzáadva a teszthez.', 'success');
    } catch (error) {
        showAlert(error.message);
    }
}

// --- TANÁR: ÚJ TESZT ---
async function handleCreateTest() {
    const title = document.getElementById('newTestCim').value.trim();
    const description = document.getElementById('newTestLeiras').value.trim();
    const timeLimit = document.getElementById('newTestIdo').value;
    const testType = document.getElementById('newTestType').value;
    const allowBreak = document.getElementById('newTestAllowBreak').checked;

    if (!title) {
        showAlert('A teszt címe kötelező.');
        return;
    }

    try {
        await createTest({
            title,
            description,
            timeLimitMinutes: timeLimit ? Number(timeLimit) : null,
            testType,
            allowBreak,
        });
        showAlert('Teszt létrehozva!', 'success');
        document.getElementById('newTestCim').value = '';
        document.getElementById('newTestLeiras').value = '';
        document.getElementById('newTestIdo').value = '';
        document.getElementById('newTestType').value = 'PRACTICE';
        document.getElementById('newTestAllowBreak').checked = false;
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
        await loadCategories();
        if (editingTest) renderEditableQuestions();
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
        await createQuestion({
            categoryId: Number(categoryId),
            topicIds: getSelectedTopicIds(document.getElementById('newQuestionTopics')),
            questionText,
            answerType,
            options,
        });
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
document.getElementById('pauseTestBtn').addEventListener('click', toggleAttemptPause);
document.getElementById('sendTestReportBtn').addEventListener('click', async () => {
    if (!currentTest) return;
    const message = document.getElementById('reportMessage').value.trim();
    const questionId = document.getElementById('reportQuestionSelect').value;
    if (message.length < 5) {
        showAlert('Írd le a hibát legalább 5 karakterben.');
        return;
    }
    try {
        const result = await reportTestIssue(currentTest.id, {
            message,
            questionId: questionId ? Number(questionId) : null,
        });
        document.getElementById('reportMessage').value = '';
        showAlert(result.message, 'success');
    } catch (error) {
        showAlert(error.message);
    }
});
document.getElementById('refreshTestReportsBtn').addEventListener('click', loadTestReports);
backToTestsBtn.addEventListener('click', () => {
    hideAllViews();
    if (currentUser?.role === 'STUDENT') {
        document.getElementById('topicPracticePanel').classList.remove('hidden');
    }
    loadTests();
});

document.getElementById('createTestBtn').addEventListener('click', handleCreateTest);
document.getElementById('createCategoryBtn').addEventListener('click', handleCreateCategory);
document.getElementById('addOptionBtn').addEventListener('click', addOption);
document.getElementById('createQuestionBtn').addEventListener('click', handleCreateQuestion);
document.getElementById('editTestSelect').addEventListener('change', event => {
    if (event.target.value) {
        loadTestForEditing(Number(event.target.value));
    } else {
        editingTest = null;
        document.getElementById('testEditor').classList.add('hidden');
    }
});
document.getElementById('saveTestDetailsBtn').addEventListener('click', async () => {
    if (!editingTest) return;
    const title = document.getElementById('editTestTitle').value.trim();
    const rawTime = document.getElementById('editTestTime').value;
    const timeLimitMinutes = rawTime ? Number(rawTime) : null;
    if (!title) {
        showAlert('A teszt címe kötelező.');
        return;
    }
    if (timeLimitMinutes !== null && (!Number.isInteger(timeLimitMinutes) || timeLimitMinutes < 1)) {
        showAlert('Az időkorlát legalább 1 perc legyen.');
        return;
    }
    try {
        await updateTest(editingTest.id, {
            title,
            description: document.getElementById('editTestDescription').value.trim(),
            timeLimitMinutes,
            testType: document.getElementById('editTestType').value,
            allowBreak: document.getElementById('editTestAllowBreak').checked,
        });
        await loadTests();
        await loadTestForEditing(editingTest.id);
        showAlert('Teszt adatai mentve!', 'success');
    } catch (error) {
        showAlert(error.message);
    }
});
document.getElementById('bankCategorySelect').addEventListener('change', loadBankQuestions);
document.getElementById('addBankQuestionBtn').addEventListener('click', addBankQuestion);
document.getElementById('newQuestionKategoria').addEventListener('change', event => {
    fillTopicSelect(document.getElementById('newQuestionTopics'), event.target.value);
});
document.getElementById('practiceCategorySelect').addEventListener('change', event => {
    fillTopicSelect(document.getElementById('practiceTopicSelect'), event.target.value);
    fillTopicSelect(document.getElementById('practiceTestTopics'), event.target.value);
    updatePracticeTestBodyMap();
});
document.getElementById('practiceTestTopics').addEventListener('change', updatePracticeTestBodyMap);
document.getElementById('createPracticeTestBtn').addEventListener('click', async () => {
    const topicIds = Array.from(
        document.getElementById('practiceTestTopics').selectedOptions,
        option => Number(option.value),
    );
    if (topicIds.length === 0) {
        showAlert('Válassz legalább egy témakört a gyakorló teszthez.');
        return;
    }

    const button = document.getElementById('createPracticeTestBtn');
    button.disabled = true;
    try {
        const result = await createStudentPracticeTest(topicIds);
        showAlert(`${result.message} ${result.questionCount} kérdés került bele.`, 'success');
        await loadTests();
        await openTest(result.test.id);
    } catch (error) {
        showAlert(error.message);
    } finally {
        button.disabled = false;
    }
});
document.getElementById('practiceTopicSelect').addEventListener('change', event => {
    if (event.target.value) {
        loadTopicMaterials(event.target.value);
    } else {
        document.getElementById('topicMaterialsList').replaceChildren();
    }
});
document.getElementById('loadTopicPracticeBtn').addEventListener('click', loadTopicPracticeQuestions);
document.getElementById('uploadMaterialBtn').addEventListener('click', async () => {
    const topicId = document.getElementById('materialTopicSelect').value;
    const file = document.getElementById('materialFile').files[0];
    if (!topicId || !file) {
        showAlert('Válassz témakört és tananyagot.');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', document.getElementById('materialTitle').value.trim());
    const button = document.getElementById('uploadMaterialBtn');
    button.disabled = true;
    try {
        const result = await uploadTopicMaterial(topicId, formData);
        showAlert(result.message, 'success');
        document.getElementById('materialFile').value = '';
        document.getElementById('materialTitle').value = '';
    } catch (error) {
        showAlert(error.message);
    } finally {
        button.disabled = false;
    }
});
document.getElementById('createGroupBtn').addEventListener('click', async () => {
    const nameInput = document.getElementById('newGroupName');
    const name = nameInput.value.trim();
    if (!name) {
        showAlert('Add meg a csoport nevét.');
        return;
    }
    try {
        await createGroup(name);
        nameInput.value = '';
        await loadGroups();
        showAlert('Csoport létrehozva.', 'success');
    } catch (error) {
        showAlert(error.message);
    }
});

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
    document.getElementById('importTestType').value = 'PRACTICE';
    document.getElementById('importAllowBreak').checked = false;
}

function renderImportPreview(preview) {
    const previousTopicIds = Array.from(
        document.querySelectorAll('#importQuestions .import-question-topics'),
        select => getSelectedTopicIds(select),
    );
    document.getElementById('importTitle').value = preview.title || '';
    document.getElementById('importDesc').value = preview.description || '';
    document.getElementById('importTime').value = preview.timeLimitMinutes ? preview.timeLimitMinutes : '';
    importQuestionsEl.innerHTML = '';

    preview.questions.forEach((q, index) => {
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
        const topicLabel = document.createElement('label');
        topicLabel.textContent = 'Témakörök (több is választható):';
        const topicSelect = document.createElement('select');
        topicSelect.className = 'import-question-topics';
        topicSelect.multiple = true;
        topicSelect.size = 4;
        fillTopicSelect(
            topicSelect,
            document.getElementById('importCategory').value,
            q.topicIds || previousTopicIds[index] || [],
        );
        block.append(topicLabel, topicSelect);

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
            questions.push({
                text,
                options: opts,
                topicIds: getSelectedTopicIds(block.querySelector('.import-question-topics')),
            });
        }
    });
    return {
        title: document.getElementById('importTitle').value.trim(),
        description: document.getElementById('importDesc').value.trim(),
        timeLimitMinutes: document.getElementById('importTime').value ? Number(document.getElementById('importTime').value) : null,
        categoryId: Number(document.getElementById('importCategory').value),
        testType: document.getElementById('importTestType').value,
        allowBreak: document.getElementById('importAllowBreak').checked,
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
document.getElementById('importCategory').addEventListener('change', event => {
    document.querySelectorAll('#importQuestions .import-question-topics').forEach(select => {
        fillTopicSelect(select, event.target.value);
    });
});

document.getElementById('approveImportBtn').addEventListener('click', async () => {
    if (!importToken) { showAlert('Előbb feltölt a tesztet.'); return; }
    const data = collectImportData();
    if (!data.categoryId) { showAlert('Válassz vizsgatárgyat.'); return; }
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
loadAttempts();