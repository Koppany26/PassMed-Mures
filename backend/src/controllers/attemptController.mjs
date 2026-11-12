/* 
Teszt kitöltések és eredmények kezelése
*/
import { eq, and, desc, gte } from 'drizzle-orm';
import { db } from '../db_drizzle/index.ts';
import {
    tests,
    testQuestions,
    attempts,
    studentAnswers,
    studentAnswerOptions,
    testAssignments,
    proctorEvents,
} from '../db_drizzle/tests.js';
import { groups, groupMembers } from '../db_drizzle/users.js';
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
        if (foundTests[0].studentOwnerId !== null
            && foundTests[0].studentOwnerId !== studentId) {
            return res.status(403).json({ success: false, message: 'Ez a saját gyakorló teszt másik diákhoz tartozik.' });
        }
        if (foundTests[0].teacherId !== null) {
            const assignment = await db.select({ testId: testAssignments.testId })
                .from(testAssignments)
                .innerJoin(groupMembers, eq(testAssignments.groupId, groupMembers.groupId))
                .where(and(
                    eq(testAssignments.testId, Number(id)),
                    eq(groupMembers.studentId, studentId),
                )).limit(1);
            if (assignment.length === 0) {
                return res.status(403).json({ success: false, message: 'Ezt a tesztet a tanár még nem osztotta meg a csoportoddal.' });
            }
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
        const sharedWithStudent = await db.select({ testId: testAssignments.testId })
            .from(testAssignments)
            .innerJoin(groupMembers, eq(testAssignments.groupId, groupMembers.groupId))
            .where(and(
                eq(testAssignments.testId, Number(id)),
                eq(groupMembers.studentId, studentId),
            )).limit(1);
        const newAttempt = await db.insert(attempts).values({
            studentId,
            testId: Number(id),
            isPrivate: sharedWithStudent.length === 0,
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
        const foundTests = await db.select().from(tests).where(eq(tests.id, attempt.testId)).limit(1);
        const test = foundTests[0];

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

        let totalScore = 0;
        const maxScore = tqList.reduce((total, tq) => total + (tq.points || 1), 0);
        const pointsByQuestion = new Map(tqList.map(tq => [tq.questionId, tq.points || 1]));
        const submittedByQuestion = new Map();
        for (const answer of submittedAnswers) {
            const questionId = Number(answer?.questionId);
            if (!pointsByQuestion.has(questionId)) {
                return res.status(400).json({ success: false, message: 'A válasz olyan kérdéshez tartozik, amely nincs a tesztben.' });
            }
            if (submittedByQuestion.has(questionId) || !Array.isArray(answer.optionIds)) {
                return res.status(400).json({ success: false, message: 'Érvénytelen vagy ismételt válasz.' });
            }
            submittedByQuestion.set(questionId, [...new Set(answer.optionIds.map(Number))]);
        }
        const feedback = [];

        // Válaszok feldolgozása
        for (const tq of tqList) {
            const questionId = tq.questionId;
            const optionIds = submittedByQuestion.get(questionId) || [];

            // Kérdés betöltése
            const qList = await db.select().from(questions).where(eq(questions.id, questionId)).limit(1);
            if (qList.length === 0) continue;
            const question = qList[0];

            // Helyes opciók betöltése
            const correctOpts = await db.select().from(options)
                .where(and(eq(options.questionId, question.id), eq(options.isCorrect, true)));

            const correctIds = correctOpts.map(o => o.id).sort();
            const submittedIds = [...new Set(optionIds)].sort((a, b) => a - b);
            const validOptionIds = new Set((await db.select({ id: options.id }).from(options)
                .where(eq(options.questionId, question.id))).map(option => option.id));
            if (submittedIds.some(optionId => !Number.isInteger(optionId) || !validOptionIds.has(optionId))) {
                return res.status(400).json({ success: false, message: 'A válaszlehetőség nem tartozik ehhez a kérdéshez.' });
            }

            const questionPoints = pointsByQuestion.get(question.id) || 1;

            // Pontozás: minden helyes opciót eltalált, és nincs rossz opció
            const isCorrect = correctIds.length > 0
                && correctIds.length === submittedIds.length
                && correctIds.every((val, idx) => val === submittedIds[idx]);

            if (isCorrect) {
                totalScore += questionPoints;
            }
            feedback.push({
                questionId: question.id,
                questionText: question.questionText,
                isCorrect,
                explanation: question.explanation,
                correctOptions: correctOpts.map(option => option.optionText),
            });

            const newAnswer = await db.insert(studentAnswers).values({
                attemptId: attempt.id,
                questionId: question.id,
                isCorrect,
            }).returning();

            for (const optionId of optionIds) {
                await db.insert(studentAnswerOptions).values({
                    studentAnswerId: newAnswer[0].id,
                    optionId,
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
            feedback: test.testType === 'PRACTICE' ? feedback : undefined,
        });
    } catch (error) {
        console.error('Kitöltés beadási hiba:', error);
        return res.status(500).json({ success: false, message: 'Szerverhiba történt.' });
    }
};

export const logProctorEvent = async (req, res) => {
    try {
        const attemptId = Number(req.params.id);
        const eventType = req.body?.eventType;
        if (!Number.isInteger(attemptId) || attemptId < 1
            || !['TAB_SWITCH', 'WINDOW_BLUR', 'FULLSCREEN_EXIT'].includes(eventType)) {
            return res.status(400).json({ success: false, message: 'Érvénytelen felügyeleti esemény.' });
        }
        const attemptRows = await db.select().from(attempts)
            .where(eq(attempts.id, attemptId)).limit(1);
        if (attemptRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Kitöltés nem található.' });
        }
        const attempt = attemptRows[0];
        if (attempt.studentId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Ez a kitöltés nem a te kitöltésed.' });
        }
        if (attempt.status !== 'IN_PROGRESS') {
            return res.status(400).json({ success: false, message: 'A kitöltés már nem aktív.' });
        }
        const test = await db.select({
            testType: tests.testType,
            allowTabSwitch: tests.allowTabSwitch,
        }).from(tests).where(eq(tests.id, attempt.testId)).limit(1);
        if (test.length === 0 || test[0].testType !== 'EXAM' || test[0].allowTabSwitch) {
            return res.status(400).json({ success: false, message: 'Ehhez a teszthez nem tartozik laphagyás-naplózás.' });
        }

        await db.insert(proctorEvents).values({ attemptId, eventType });
        return res.status(201).json({ success: true });
    } catch (error) {
        console.error('Felügyeleti esemény mentési hiba:', error);
        return res.status(500).json({ success: false, message: 'Az esemény naplózása nem sikerült.' });
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
        if (userRole === 'TEACHER') {
            if (attempt.isPrivate) {
                return res.status(403).json({ success: false, message: 'Ez a diák privát gyakorlása.' });
            }
            const sharedAttempt = await db.select({ testId: testAssignments.testId })
                .from(testAssignments)
                .innerJoin(groups, eq(testAssignments.groupId, groups.id))
                .innerJoin(groupMembers, eq(groups.id, groupMembers.groupId))
                .where(and(
                    eq(testAssignments.testId, attempt.testId),
                    eq(groups.teacherId, userId),
                    eq(groupMembers.studentId, attempt.studentId),
                    gte(attempts.startedAt, testAssignments.createdAt),
                    gte(attempts.startedAt, groupMembers.joinedAt),
                )).limit(1);
            if (sharedAttempt.length === 0) {
                return res.status(403).json({ success: false, message: 'Csak saját csoportban megosztott teszt kitöltéseit nézheted meg.' });
            }
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