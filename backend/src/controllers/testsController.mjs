/* 
Teszt kezelése
*/
import { eq, desc, asc, and, inArray, isNull, or } from 'drizzle-orm';
import { db } from '../db_drizzle/index.js';
import { tests, testQuestions, testAssignments } from '../db_drizzle/tests.js';
import { categories, questions, options, topics, questionTopics } from '../db_drizzle/questions.js';
import { groupMembers } from '../db_drizzle/users.js';

const findAccessibleTest = async (testId, user) => {
    const found = await db.select().from(tests).where(eq(tests.id, testId)).limit(1);
    if (found.length === 0) return { error: 'Teszt nem található.', status: 404 };
    if (user.role !== 'ADMIN' && found[0].teacherId !== user.id) {
        return { error: 'Csak a saját tesztedet módosíthatod.', status: 403 };
    }
    return { test: found[0] };
};

// --- TESZTEK LISTÁZÁSA ---
export const getTests = async (req, res) => {
    try {
        let query = db.select().from(tests);
        if (req.user.role === 'STUDENT') {
            const assignments = await db.select({ testId: testAssignments.testId })
                .from(testAssignments)
                .innerJoin(groupMembers, eq(testAssignments.groupId, groupMembers.groupId))
                .where(eq(groupMembers.studentId, req.user.id));
            const accessibleTestIds = assignments.map(assignment => assignment.testId);
            const availableToAll = and(isNull(tests.teacherId), isNull(tests.studentOwnerId));
            const availableToStudent = eq(tests.studentOwnerId, req.user.id);
            query = query.where(accessibleTestIds.length > 0
                ? or(availableToAll, availableToStudent, inArray(tests.id, accessibleTestIds))
                : or(availableToAll, availableToStudent));
        }
        const result = await query.orderBy(desc(tests.createdAt));
        return res.status(200).json({ success: true, tests: result });
    } catch (error) {
        console.error('Teszt lista hiba:', error);
        return res.status(500).json({ success: false, message: 'Szerverhiba történt.' });
    }
};

export const createStudentPracticeTest = async (req, res) => {
    try {
        const rawTopicIds = req.body?.topicIds;
        if (!Array.isArray(rawTopicIds) || rawTopicIds.length === 0
            || rawTopicIds.length > 30
            || rawTopicIds.some(id => !Number.isInteger(Number(id)) || Number(id) < 1)) {
            return res.status(400).json({ success: false, message: 'Válassz 1–30 érvényes témakört.' });
        }
        const topicIds = [...new Set(rawTopicIds.map(Number))];
        const selectedTopics = await db.select({ id: topics.id, name: topics.name })
            .from(topics).where(inArray(topics.id, topicIds));
        if (selectedTopics.length !== topicIds.length) {
            return res.status(400).json({ success: false, message: 'A kiválasztott témakörök egy része nem található.' });
        }
        const linkedQuestions = await db.selectDistinct({
            questionId: questionTopics.questionId,
        }).from(questionTopics).where(inArray(questionTopics.topicId, topicIds));
        if (linkedQuestions.length === 0) {
            return res.status(400).json({ success: false, message: 'A kiválasztott témakörökhöz még nem tartozik kérdés.' });
        }

        const titleTopics = selectedTopics.map(topic => topic.name);
        const title = titleTopics.length <= 2
            ? `Gyakorló teszt: ${titleTopics.join(', ')}`
            : `Gyakorló teszt: ${titleTopics.slice(0, 2).join(', ')} (+${titleTopics.length - 2})`;

        const createdTest = await db.transaction(async (tx) => {
            const inserted = await tx.insert(tests).values({
                title,
                description: `Saját gyakorló teszt · ${titleTopics.join(', ')}`,
                testType: 'PRACTICE',
                allowBreak: false,
                allowTabSwitch: true,
                teacherId: null,
                studentOwnerId: req.user.id,
            }).returning();
            const test = inserted[0];
            await tx.insert(testQuestions).values(linkedQuestions.map((question, order) => ({
                testId: test.id,
                questionId: question.questionId,
                order,
                points: 1,
            })));
            return test;
        });

        return res.status(201).json({
            success: true,
            message: 'A saját gyakorló teszted elkészült.',
            test: createdTest,
            questionCount: linkedQuestions.length,
        });
    } catch (error) {
        console.error('Saját gyakorló teszt létrehozási hiba:', error);
        return res.status(500).json({ success: false, message: 'A gyakorló teszt létrehozása nem sikerült.' });
    }
};

// --- TESZT LÉTREHOZÁSA (TANAR/ADMIN) ---
export const createTest = async (req, res) => {
    try {
        const { title, description, timeLimitMinutes, testType, allowBreak } = req.body || {};

        if (typeof title !== 'string' || !title.trim()) {
            return res.status(400).json({ success: false, message: 'A teszt címe kötelező.' });
        }
        const limit = timeLimitMinutes === null || timeLimitMinutes === '' || timeLimitMinutes === undefined
            ? null
            : Number(timeLimitMinutes);
        if (limit !== null && (!Number.isInteger(limit) || limit < 1)) {
            return res.status(400).json({ success: false, message: 'Az időkorlát legalább 1 perc legyen.' });
        }
        if (testType !== undefined && !['PRACTICE', 'EXAM'].includes(testType)) {
            return res.status(400).json({ success: false, message: 'Érvénytelen teszttípus.' });
        }
        if (allowBreak !== undefined && typeof allowBreak !== 'boolean') {
            return res.status(400).json({ success: false, message: 'Érvénytelen szünetbeállítás.' });
        }

        const newTest = await db.insert(tests).values({
            title: title.trim(),
            description: description || null,
            timeLimitMinutes: limit,
            testType: testType || 'PRACTICE',
            allowTabSwitch: (testType || 'PRACTICE') !== 'EXAM',
            allowBreak: allowBreak === true,
            teacherId: req.user ? req.user.id : null,
        }).returning();

        return res.status(201).json({ success: true, message: 'Teszt létrehozva!', test: newTest[0] });
    } catch (error) {
        console.error('Teszt létrehozási hiba:', error);
        return res.status(500).json({ success: false, message: 'Szerverhiba történt.' });
    }
};

// --- TESZT ADATAINAK MÓDOSÍTÁSA (TULAJDONOS TANÁR/ADMIN) ---
export const updateTest = async (req, res) => {
    try {
        const testId = Number(req.params.id);
        const access = await findAccessibleTest(testId, req.user);
        if (access.error) {
            return res.status(access.status).json({ success: false, message: access.error });
        }

        const { title, description, timeLimitMinutes, testType, allowBreak } = req.body || {};
        if (typeof title !== 'string' || !title.trim()) {
            return res.status(400).json({ success: false, message: 'A teszt címe kötelező.' });
        }
        const limit = timeLimitMinutes === null || timeLimitMinutes === '' || timeLimitMinutes === undefined
            ? null
            : Number(timeLimitMinutes);
        if (limit !== null && (!Number.isInteger(limit) || limit < 1)) {
            return res.status(400).json({ success: false, message: 'Az időkorlát legalább 1 perc legyen.' });
        }
        if (testType !== undefined && !['PRACTICE', 'EXAM'].includes(testType)) {
            return res.status(400).json({ success: false, message: 'Érvénytelen teszttípus.' });
        }
        if (allowBreak !== undefined && typeof allowBreak !== 'boolean') {
            return res.status(400).json({ success: false, message: 'Érvénytelen szünetbeállítás.' });
        }

        const updated = await db.update(tests).set({
            title: title.trim(),
            description: typeof description === 'string' && description.trim() ? description.trim() : null,
            timeLimitMinutes: limit,
            testType: testType || access.test.testType,
            allowTabSwitch: (testType || access.test.testType) !== 'EXAM',
            allowBreak: allowBreak === undefined ? access.test.allowBreak : allowBreak,
        }).where(eq(tests.id, testId)).returning();

        return res.status(200).json({ success: true, message: 'Teszt adatai frissítve!', test: updated[0] });
    } catch (error) {
        console.error('Teszt módosítási hiba:', error);
        return res.status(500).json({ success: false, message: 'Szerverhiba történt.' });
    }
};

// --- TESZTBELI KÉRDÉS MÓDOSÍTÁSA (A KÉRDÉSBANK ÉS KORÁBBI KITÖLTÉSEK MEGŐRZÉSÉVEL) ---
export const updateTestQuestion = async (req, res) => {
    try {
        const testId = Number(req.params.id);
        const questionId = Number(req.params.questionId);
        const access = await findAccessibleTest(testId, req.user);
        if (access.error) {
            return res.status(access.status).json({ success: false, message: access.error });
        }

        const linked = await db.select().from(testQuestions).where(and(
            eq(testQuestions.testId, testId),
            eq(testQuestions.questionId, questionId),
        )).limit(1);
        if (linked.length === 0) {
            return res.status(404).json({ success: false, message: 'A kérdés nem található ebben a tesztben.' });
        }

        const { categoryId, questionText, answerType, options: optionList, points, topicIds } = req.body || {};
        const normalizedCategoryId = Number(categoryId);
        if (!Number.isInteger(normalizedCategoryId) || normalizedCategoryId < 1) {
            return res.status(400).json({ success: false, message: 'Válassz kategóriát a kérdéshez.' });
        }
        const category = await db.select().from(categories)
            .where(eq(categories.id, normalizedCategoryId)).limit(1);
        if (category.length === 0) {
            return res.status(400).json({ success: false, message: 'A kiválasztott vizsgatárgy nem létezik.' });
        }
        let normalizedTopicIds;
        if (topicIds === undefined) {
            const existingTopics = await db.select({ topicId: questionTopics.topicId })
                .from(questionTopics)
                .innerJoin(topics, eq(questionTopics.topicId, topics.id))
                .where(and(
                    eq(questionTopics.questionId, questionId),
                    eq(topics.categoryId, normalizedCategoryId),
                ));
            normalizedTopicIds = existingTopics.map(item => item.topicId);
        } else {
            if (!Array.isArray(topicIds) || topicIds.some(id => !Number.isInteger(Number(id)) || Number(id) < 1)) {
                return res.status(400).json({ success: false, message: 'Érvénytelen témakörlista.' });
            }
            normalizedTopicIds = [...new Set(topicIds.map(Number))];
            if (normalizedTopicIds.length > 0) {
                const foundTopics = await db.select({ id: topics.id }).from(topics).where(and(
                    inArray(topics.id, normalizedTopicIds),
                    eq(topics.categoryId, normalizedCategoryId),
                ));
                if (foundTopics.length !== normalizedTopicIds.length) {
                    return res.status(400).json({ success: false, message: 'Minden témakörnek a kiválasztott vizsgatárgyhoz kell tartoznia.' });
                }
            }
        }
        if (typeof questionText !== 'string' || !questionText.trim()) {
            return res.status(400).json({ success: false, message: 'A kérdés szövege kötelező.' });
        }
        if (!['SINGLE', 'MULTIPLE'].includes(answerType)) {
            return res.status(400).json({ success: false, message: 'Érvénytelen válaszadási típus.' });
        }
        if (!Array.isArray(optionList) || optionList.length < 2
            || optionList.some((option) => !option || typeof option !== 'object'
                || typeof option.optionText !== 'string' || !option.optionText.trim())) {
            return res.status(400).json({ success: false, message: 'Legalább 2 kitöltött válaszlehetőség szükséges.' });
        }
        const correctCount = optionList.filter((option) => option.isCorrect === true).length;
        if (answerType === 'SINGLE' && correctCount > 1) {
            return res.status(400).json({ success: false, message: 'Egyszeres választásnál legfeljebb egy helyes válasz jelölhető.' });
        }
        const normalizedPoints = points === undefined ? linked[0].points : Number(points);
        if (!Number.isInteger(normalizedPoints) || normalizedPoints < 1) {
            return res.status(400).json({ success: false, message: 'A pontszám legalább 1 legyen.' });
        }

        const original = await db.select().from(questions)
            .where(eq(questions.id, questionId)).limit(1);
        if (original.length === 0) {
            return res.status(404).json({ success: false, message: 'A kérdés nem található.' });
        }

        const updatedQuestion = await db.transaction(async (tx) => {
            // Fork the question so edits don't affect the bank, other tests, or completed attempts.
            const inserted = await tx.insert(questions).values({
                categoryId: normalizedCategoryId,
                questionText: questionText.trim(),
                imageUrl: original[0].imageUrl,
                explanation: original[0].explanation,
                answerType,
                difficulty: original[0].difficulty,
                answerCount: correctCount || 1,
            }).returning();
            const newQuestion = inserted[0];

            await tx.insert(options).values(optionList.map((option, order) => ({
                questionId: newQuestion.id,
                optionText: option.optionText.trim(),
                isCorrect: option.isCorrect === true,
                order,
            })));

            await tx.delete(testQuestions).where(and(
                eq(testQuestions.testId, testId),
                eq(testQuestions.questionId, questionId),
            ));
            await tx.insert(testQuestions).values({
                testId,
                questionId: newQuestion.id,
                order: linked[0].order,
                points: normalizedPoints,
            });
            if (normalizedTopicIds.length > 0) {
                await tx.insert(questionTopics).values(normalizedTopicIds.map(topicId => ({
                    questionId: newQuestion.id,
                    topicId,
                })));
            }
            return newQuestion;
        });

        return res.status(200).json({ success: true, message: 'Kérdés frissítve!', question: updatedQuestion });
    } catch (error) {
        console.error('Tesztkérdés módosítási hiba:', error);
        return res.status(500).json({ success: false, message: 'Szerverhiba történt.' });
    }
};

// --- TESZT RÉSZLETEI (kérdésekkel) ---
// STUDENT szerepkör esetén a helyes válaszok rejtve maradnak
export const getTestById = async (req, res) => {
    try {
        const { id } = req.params;
        const isStudent = req.user && req.user.role === 'STUDENT';

        const foundTests = await db.select().from(tests).where(eq(tests.id, Number(id))).limit(1);
        if (foundTests.length === 0) {
            return res.status(404).json({ success: false, message: 'Teszt nem található.' });
        }
        const test = foundTests[0];
        if (req.user.role === 'STUDENT' && test.studentOwnerId !== null
            && test.studentOwnerId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Ez a saját gyakorló teszt másik diákhoz tartozik.' });
        }
        if (req.user.role === 'STUDENT' && test.teacherId !== null) {
            const assignment = await db.select({ testId: testAssignments.testId })
                .from(testAssignments)
                .innerJoin(groupMembers, eq(testAssignments.groupId, groupMembers.groupId))
                .where(and(
                    eq(testAssignments.testId, test.id),
                    eq(groupMembers.studentId, req.user.id),
                )).limit(1);
            if (assignment.length === 0) {
                return res.status(403).json({ success: false, message: 'Ezt a tesztet a tanár még nem osztotta meg a csoportoddal.' });
            }
        }

        // Teszt kérdései sorrend szerint
        const tqList = await db.select().from(testQuestions)
            .where(eq(testQuestions.testId, test.id))
            .orderBy(asc(testQuestions.order));

        // Kérdések és opciók betöltése
        const questionList = [];
        for (const tq of tqList) {
            const qList = await db.select().from(questions).where(eq(questions.id, tq.questionId)).limit(1);
            if (qList.length === 0) continue;
            const q = qList[0];

            const opts = await db.select().from(options).where(eq(options.questionId, q.id)).orderBy(asc(options.order));
            const questionTopicRows = await db.select({
                id: topics.id,
                name: topics.name,
                categoryId: topics.categoryId,
            }).from(questionTopics)
                .innerJoin(topics, eq(questionTopics.topicId, topics.id))
                .where(eq(questionTopics.questionId, q.id))
                .orderBy(asc(topics.name));

            // STUDENT-nek ne küldjük el a helyes válaszokat
            const safeOpts = isStudent
                ? opts.map(({ isCorrect, ...rest }) => rest)
                : opts;

            questionList.push({
                ...q,
                points: tq.points,
                options: safeOpts,
                topics: questionTopicRows,
            });
        }

        return res.status(200).json({ success: true, test: { ...test, questions: questionList } });
    } catch (error) {
        console.error('Teszt részlet hiba:', error);
        return res.status(500).json({ success: false, message: 'Szerverhiba történt.' });
    }
};

// --- KÉRDÉS HOZZÁADÁSA TESZTHEZ (TANAR/ADMIN) ---
export const addQuestionToTest = async (req, res) => {
    try {
        const { id } = req.params;
        const { questionId, order, points } = req.body;

        if (!questionId) {
            return res.status(400).json({ success: false, message: 'A kérdés ID kötelező.' });
        }

        const access = await findAccessibleTest(Number(id), req.user);
        if (access.error) {
            return res.status(access.status).json({ success: false, message: access.error });
        }

        // Kérdés létezik-e?
        const foundQuestions = await db.select().from(questions).where(eq(questions.id, Number(questionId))).limit(1);
        if (foundQuestions.length === 0) {
            return res.status(404).json({ success: false, message: 'Kérdés nem található.' });
        }

        // Duplikáció ellenőrzése
        const existing = await db.select().from(testQuestions)
            .where(and(
                eq(testQuestions.testId, Number(id)),
                eq(testQuestions.questionId, Number(questionId))
            ))
            .limit(1);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'Ez a kérdés már hozzá van adva a teszthez.' });
        }

        // Sorrend automatikus, ha nincs megadva
        let finalOrder = order;
        if (finalOrder === undefined) {
            const countResult = await db.select().from(testQuestions).where(eq(testQuestions.testId, Number(id)));
            finalOrder = countResult.length;
        }

        const newTQ = await db.insert(testQuestions).values({
            testId: Number(id),
            questionId: Number(questionId),
            order: finalOrder,
            points: points || 1,
        }).returning();

        return res.status(201).json({ success: true, message: 'Kérdés hozzáadva a teszthez!', testQuestion: newTQ[0] });
    } catch (error) {
        console.error('Kérdés hozzáadási hiba:', error);
        return res.status(500).json({ success: false, message: 'Szerverhiba történt.' });
    }
};

// --- KÉRDÉS ELTÁVOLÍTÁSA TESZTBŐL (TANAR/ADMIN) ---
export const removeQuestionFromTest = async (req, res) => {
    try {
        const { id, questionId } = req.params;
        const access = await findAccessibleTest(Number(id), req.user);
        if (access.error) {
            return res.status(access.status).json({ success: false, message: access.error });
        }

        const existing = await db.select().from(testQuestions)
            .where(and(
                eq(testQuestions.testId, Number(id)),
                eq(testQuestions.questionId, Number(questionId))
            ))
            .limit(1);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'A kérdés nem található ebben a tesztben.' });
        }

        await db.delete(testQuestions)
            .where(and(
                eq(testQuestions.testId, Number(id)),
                eq(testQuestions.questionId, Number(questionId))
            ));

        return res.status(200).json({ success: true, message: 'Kérdés eltávolítva a tesztből!' });
    } catch (error) {
        console.error('Kérdés eltávolítási hiba:', error);
        return res.status(500).json({ success: false, message: 'Szerverhiba történt.' });
    }
};

// --- TESZT TÖRLÉSE (TANAR/ADMIN) ---
export const deleteTest = async (req, res) => {
    try {
        const { id } = req.params;
        const access = await findAccessibleTest(Number(id), req.user);
        if (access.error) {
            return res.status(access.status).json({ success: false, message: access.error });
        }

        await db.delete(tests).where(eq(tests.id, Number(id)));
        return res.status(200).json({ success: true, message: 'Teszt törölve!' });
    } catch (error) {
        console.error('Teszt törlési hiba:', error);
        return res.status(500).json({ success: false, message: 'Szerverhiba történt.' });
    }
};