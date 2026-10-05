/* 
Teszt kezelése
*/
import { eq, desc, asc, and } from 'drizzle-orm';
import { db } from '../db_drizzle/index.js';
import { tests, testQuestions } from '../db_drizzle/tests.js';
import { questions, options } from '../db_drizzle/questions.js';

// --- TESZTEK LISTÁZÁSA ---
export const getTests = async (req, res) => {
    try {
        const result = await db.select().from(tests).orderBy(desc(tests.createdAt));
        return res.status(200).json({ success: true, tests: result });
    } catch (error) {
        console.error('Teszt lista hiba:', error);
        return res.status(500).json({ success: false, message: 'Szerverhiba történt.' });
    }
};

// --- TESZT LÉTREHOZÁSA (TANAR/ADMIN) ---
export const createTest = async (req, res) => {
    try {
        const { title, description, timeLimitMinutes } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, message: 'A teszt címe kötelező.' });
        }

        const newTest = await db.insert(tests).values({
            title: title.trim(),
            description: description || null,
            timeLimitMinutes: timeLimitMinutes || null,
            teacherId: req.user ? req.user.id : null,
        }).returning();

        return res.status(201).json({ success: true, message: 'Teszt létrehozva!', test: newTest[0] });
    } catch (error) {
        console.error('Teszt létrehozási hiba:', error);
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

            // STUDENT-nek ne küldjük el a helyes válaszokat
            const safeOpts = isStudent
                ? opts.map(({ isCorrect, ...rest }) => rest)
                : opts;

            questionList.push({
                ...q,
                points: tq.points,
                options: safeOpts,
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

        // Teszt létezik-e?
        const foundTests = await db.select().from(tests).where(eq(tests.id, Number(id))).limit(1);
        if (foundTests.length === 0) {
            return res.status(404).json({ success: false, message: 'Teszt nem található.' });
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

        const existing = await db.select().from(tests).where(eq(tests.id, Number(id))).limit(1);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Teszt nem található.' });
        }

        await db.delete(tests).where(eq(tests.id, Number(id)));
        return res.status(200).json({ success: true, message: 'Teszt törölve!' });
    } catch (error) {
        console.error('Teszt törlési hiba:', error);
        return res.status(500).json({ success: false, message: 'Szerverhiba történt.' });
    }
};