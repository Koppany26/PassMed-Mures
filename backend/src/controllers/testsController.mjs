/* 
Teszt kezelése
*/
import { eq, desc, asc } from 'drizzle-orm';
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
        const { cim, leiras, idoKorlatPercben } = req.body;

        if (!cim || !cim.trim()) {
            return res.status(400).json({ success: false, message: 'A teszt címe kötelező.' });
        }

        const newTest = await db.insert(tests).values({
            cim: cim.trim(),
            leiras: leiras || null,
            idoKorlatPercben: idoKorlatPercben || null,
        }).returning();

        return res.status(201).json({ success: true, message: 'Teszt létrehozva!', test: newTest[0] });
    } catch (error) {
        console.error('Teszt létrehozási hiba:', error);
        return res.status(500).json({ success: false, message: 'Szerverhiba történt.' });
    }
};

// --- TESZT RÉSZLETEI (kérdésekkel) ---
// DIAK szerepkör esetén a helyes válaszok rejtve maradnak
export const getTestById = async (req, res) => {
    try {
        const { id } = req.params;
        const isDiak = req.user && req.user.szerepkor === 'DIAK';

        const foundTests = await db.select().from(tests).where(eq(tests.id, Number(id))).limit(1);
        if (foundTests.length === 0) {
            return res.status(404).json({ success: false, message: 'Teszt nem található.' });
        }
        const test = foundTests[0];

        // Teszt kérdései sorrend szerint
        const tqList = await db.select().from(testQuestions)
            .where(eq(testQuestions.tesztId, test.id))
            .orderBy(asc(testQuestions.sorrend));

        // Kérdések és opciók betöltése
        const questionList = [];
        for (const tq of tqList) {
            const qList = await db.select().from(questions).where(eq(questions.id, tq.kerdesId)).limit(1);
            if (qList.length === 0) continue;
            const q = qList[0];

            const opts = await db.select().from(options).where(eq(options.kerdesId, q.id)).orderBy(asc(options.sorrend));

            // DIAK-nak ne küldjük el a helyes válaszokat
            const safeOpts = isDiak
                ? opts.map(({ helyesE, ...rest }) => rest)
                : opts;

            questionList.push({
                ...q,
                pontszam: tq.pontszam,
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
        const { kerdesId, sorrend, pontszam } = req.body;

        if (!kerdesId) {
            return res.status(400).json({ success: false, message: 'A kérdés ID kötelező.' });
        }

        // Teszt létezik-e?
        const foundTests = await db.select().from(tests).where(eq(tests.id, Number(id))).limit(1);
        if (foundTests.length === 0) {
            return res.status(404).json({ success: false, message: 'Teszt nem található.' });
        }

        // Kérdés létezik-e?
        const foundQuestions = await db.select().from(questions).where(eq(questions.id, Number(kerdesId))).limit(1);
        if (foundQuestions.length === 0) {
            return res.status(404).json({ success: false, message: 'Kérdés nem található.' });
        }

        // Duplikáció ellenőrzése
        const existing = await db.select().from(testQuestions)
            .where(eq(testQuestions.tesztId, Number(id)))
            .where(eq(testQuestions.kerdesId, Number(kerdesId)))
            .limit(1);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'Ez a kérdés már hozzá van adva a teszthez.' });
        }

        // Sorrend automatikus, ha nincs megadva
        let finalSorrend = sorrend;
        if (finalSorrend === undefined) {
            const countResult = await db.select().from(testQuestions).where(eq(testQuestions.tesztId, Number(id)));
            finalSorrend = countResult.length;
        }

        const newTQ = await db.insert(testQuestions).values({
            tesztId: Number(id),
            kerdesId: Number(kerdesId),
            sorrend: finalSorrend,
            pontszam: pontszam || 1,
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
        const { id, kerdesId } = req.params;

        const existing = await db.select().from(testQuestions)
            .where(eq(testQuestions.tesztId, Number(id)))
            .where(eq(testQuestions.kerdesId, Number(kerdesId)))
            .limit(1);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'A kérdés nem található ebben a tesztben.' });
        }

        await db.delete(testQuestions)
            .where(eq(testQuestions.tesztId, Number(id)))
            .where(eq(testQuestions.kerdesId, Number(kerdesId)));

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