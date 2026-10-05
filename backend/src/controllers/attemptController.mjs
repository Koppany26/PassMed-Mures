/* 
Teszt kitöltések és eredmények kezelése
*/
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db_drizzle/index.js';
import { tests, testQuestions, attempts, studentAnswers, studentAnswerOptions } from '../db_drizzle/tests.js';
import { questions, options } from '../db_drizzle/questions.js';

// --- TESZT KITÖLTÉSÉNEK INDÍTÁSA (STUDENT) ---
export const startAttempt = async (req, res) => {
    try {
        const { id } = req.params; // teszt id
        const studentId = req.user.id;

        // Teszt létezik-e?
        const foundTests = await db.select().from(tests).where(eq(tests.id, Number(id))).limit(1);
        if (foundTests.length === 0) {
            return res.status(404).json({ success: false, message: 'Teszt nem található.' });
        }

        // Van-e már folyamatban lévő kitöltése a diáknak ehhez a teszthez?
        const existing = await db.select().from(attempts)
            .where(and(
                eq(attempts.studentId, studentId),
                eq(attempts.testId, Number(id)),
                eq(attempts.status, 'IN_PROGRESS')
            ))
            .limit(1);

        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'Már van folyamatban lévő kitöltésed ehhez a teszthez.', attempt: existing[0] });
        }

        // Új kitöltés létrehozása
        const newAttempt = await db.insert(attempts).values({
            studentId,
            testId: Number(id),
        }).returning();

        return res.status(201).json({ success: true, message: 'Kitöltés elindítva!', attempt: newAttempt[0] });
    } catch (error) {
        console.error('Kitöltés indítási hiba:', error);
        return res.status(500).json({ success: false, message: 'Szerverhiba történt.' });
    }
};

// --- KITÖLTÉS BEADÁSA ÉS AUTOMATIKUS JAVÍTÁS (STUDENT) ---
export const submitAttempt = async (req, res) => {
    try {
        const { id } = req.params; // attempt id
        const { answers: submittedAnswers } = req.body; // [{ questionId, optionIds: [1,2] }]
        const studentId = req.user.id;

        // Kitöltés létezik-e és a diákhoz tartozik-e?
        const foundAttempts = await db.select().from(attempts).where(eq(attempts.id, Number(id))).limit(1);
        if (foundAttempts.length === 0) {
            return res.status(404).json({ success: false, message: 'Kitöltés nem található.' });
        }
        const attempt = foundAttempts[0];

        if (attempt.studentId !== studentId) {
            return res.status(403).json({ success: false, message: 'Ez a kitöltés nem a te kitöltésed.' });
        }

        if (attempt.status === 'COMPLETED') {
            return res.status(400).json({ success: false, message: 'Ez a kitöltés már be van fejezve.' });
        }

        if (!submittedAnswers || !Array.isArray(submittedAnswers)) {
            return res.status(400).json({ success: false, message: 'Az answers mező kötelező és tömbnek kell lennie.' });
        }

        // Teszt kérdéseinek betöltése pontszámokkal
        const tqList = await db.select().from(testQuestions)
            .where(eq(testQuestions.testId, attempt.testId));

        // Kérdés -> pontszám térkép
        const pointsMap = {};
        for (const tq of tqList) {
            pointsMap[tq.questionId] = tq.points || 1;
        }

        let totalScore = 0;
        let maxScore = 0;

        // Válaszok feldolgozása
        for (const answer of submittedAnswers) {
            const { questionId, optionIds } = answer;
            if (!questionId || !optionIds || !Array.isArray(optionIds)) continue;

            // Kérdés betöltése
            const qList = await db.select().from(questions).where(eq(questions.id, Number(questionId))).limit(1);
            if (qList.length === 0) continue;
            const question = qList[0];

            // Helyes opciók betöltése
            const correctOpts = await db.select().from(options)
                .where(and(eq(options.questionId, question.id), eq(options.isCorrect, true)));

            const correctIds = correctOpts.map(o => o.id).sort();
            const submittedIds = optionIds.map(Number).sort();

            const questionPoints = pointsMap[question.id] || 1;
            maxScore += questionPoints;

            // Pontozás: minden helyes opciót eltalált, és nincs rossz opció
            const isCorrect = correctIds.length === submittedIds.length &&
                correctIds.every((val, idx) => val === submittedIds[idx]);

            if (isCorrect) {
                totalScore += questionPoints;
            }

            // Válasz mentése
            const newAnswer = await db.insert(studentAnswers).values({
                attemptId: attempt.id,
                questionId: question.id,
            }).returning();

            // Kiválasztott opciók mentése
            for (const optionId of optionIds) {
                await db.insert(studentAnswerOptions).values({
                    studentAnswerId: newAnswer[0].id,
                    optionId: Number(optionId),
                });
            }
        }

        // Kitöltés befejezése
        const updated = await db.update(attempts)
            .set({
                status: 'COMPLETED',
                completedAt: new Date(),
                totalScore,
            })
            .where(eq(attempts.id, attempt.id))
            .returning();

        return res.status(200).json({
            success: true,
            message: 'Kitöltés beadva és kijavítva!',
            attempt: updated[0],
            totalScore,
            maxScore,
        });
    } catch (error) {
        console.error('Kitöltés beadási hiba:', error);
        return res.status(500).json({ success: false, message: 'Szerverhiba történt.' });
    }
};

// --- KITÖLTÉS RÉSZLETEI (eredménnyel) ---
export const getAttemptById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;

        const foundAttempts = await db.select().from(attempts).where(eq(attempts.id, Number(id))).limit(1);
        if (foundAttempts.length === 0) {
            return res.status(404).json({ success: false, message: 'Kitöltés nem található.' });
        }
        const attempt = foundAttempts[0];

        // Csak a saját kitöltését nézheti meg a diák, vagy tanár/admin bármelyiket
        if (userRole === 'STUDENT' && attempt.studentId !== userId) {
            return res.status(403).json({ success: false, message: 'Ez a kitöltés nem a te kitöltésed.' });
        }

        // Teszt adatai
        const foundTests = await db.select().from(tests).where(eq(tests.id, attempt.testId)).limit(1);
        const test = foundTests[0];

        // Válaszok betöltése
        const answers = await db.select().from(studentAnswers).where(eq(studentAnswers.attemptId, attempt.id));

        // Részletes válaszok opciókkal
        const detailedAnswers = [];
        for (const ans of answers) {
            const qList = await db.select().from(questions).where(eq(questions.id, ans.questionId)).limit(1);
            if (qList.length === 0) continue;
            const question = qList[0];

            const selectedOpts = await db.select().from(studentAnswerOptions)
                .where(eq(studentAnswerOptions.studentAnswerId, ans.id));

            const selectedOptionIds = selectedOpts.map(so => so.optionId);

            // Helyes opciók (tanár/admin láthatja)
            const correctOpts = await db.select().from(options)
                .where(and(eq(options.questionId, question.id), eq(options.isCorrect, true)));

            const correctOptionIds = correctOpts.map(o => o.id);

            detailedAnswers.push({
                questionId: question.id,
                questionText: question.questionText,
                selectedOptionIds,
                correctOptionIds,
                isCorrect: selectedOptionIds.length === correctOptionIds.length &&
                    [...selectedOptionIds].sort().every((val, idx) => val === [...correctOptionIds].sort()[idx]),
            });
        }

        return res.status(200).json({
            success: true,
            attempt: { ...attempt, test, answers: detailedAnswers }
        });
    } catch (error) {
        console.error('Kitöltés részlet hiba:', error);
        return res.status(500).json({ success: false, message: 'Szerverhiba történt.' });
    }
};

// --- DIAK SAJÁT KITÖLTÉSEINEK LISTÁJA ---
export const getMyAttempts = async (req, res) => {
    try {
        const studentId = req.user.id;

        const result = await db.select().from(attempts)
            .where(eq(attempts.studentId, studentId))
            .orderBy(desc(attempts.startedAt));

        // Teszt címek hozzáadása
        const detailed = [];
        for (const att of result) {
            const foundTests = await db.select().from(tests).where(eq(tests.id, att.testId)).limit(1);
            detailed.push({
                ...att,
                testTitle: foundTests.length > 0 ? foundTests[0].title : 'Ismeretlen teszt',
            });
        }

        return res.status(200).json({ success: true, attempts: detailed });
    } catch (error) {
        console.error('Kitöltés lista hiba:', error);
        return res.status(500).json({ success: false, message: 'Szerverhiba történt.' });
    }
};