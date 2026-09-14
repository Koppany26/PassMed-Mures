/* 
Teszt kitöltések és eredmények kezelése
*/
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db_drizzle/index.js';
import { tests, testQuestions, attempts, studentAnswers, studentAnswerOptions } from '../db_drizzle/tests.js';
import { questions, options } from '../db_drizzle/questions.js';

// --- TESZT KITÖLTÉSÉNEK INDÍTÁSA (DIAK) ---
export const startAttempt = async (req, res) => {
    try {
        const { id } = req.params; // teszt id
        const diakId = req.user.id;

        // Teszt létezik-e?
        const foundTests = await db.select().from(tests).where(eq(tests.id, Number(id))).limit(1);
        if (foundTests.length === 0) {
            return res.status(404).json({ success: false, message: 'Teszt nem található.' });
        }

        // Van-e már folyamatban lévő kitöltése a diáknak ehhez a teszthez?
        const existing = await db.select().from(attempts)
            .where(and(
                eq(attempts.diakId, diakId),
                eq(attempts.tesztId, Number(id)),
                eq(attempts.statusz, 'FOLYAMATBAN')
            ))
            .limit(1);

        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'Már van folyamatban lévő kitöltésed ehhez a teszthez.', attempt: existing[0] });
        }

        // Új kitöltés létrehozása
        const newAttempt = await db.insert(attempts).values({
            diakId,
            tesztId: Number(id),
        }).returning();

        return res.status(201).json({ success: true, message: 'Kitöltés elindítva!', attempt: newAttempt[0] });
    } catch (error) {
        console.error('Kitöltés indítási hiba:', error);
        return res.status(500).json({ success: false, message: 'Szerverhiba történt.' });
    }
};

// --- KITÖLTÉS BEADÁSA ÉS AUTOMATIKUS JAVÍTÁS (DIAK) ---
export const submitAttempt = async (req, res) => {
    try {
        const { id } = req.params; // attempt id
        const { valaszok } = req.body; // [{ kerdesId, opcioIdk: [1,2] }]
        const diakId = req.user.id;

        // Kitöltés létezik-e és a diákhoz tartozik-e?
        const foundAttempts = await db.select().from(attempts).where(eq(attempts.id, Number(id))).limit(1);
        if (foundAttempts.length === 0) {
            return res.status(404).json({ success: false, message: 'Kitöltés nem található.' });
        }
        const attempt = foundAttempts[0];

        if (attempt.diakId !== diakId) {
            return res.status(403).json({ success: false, message: 'Ez a kitöltés nem a te kitöltésed.' });
        }

        if (attempt.statusz === 'BEFEJEZVE') {
            return res.status(400).json({ success: false, message: 'Ez a kitöltés már be van fejezve.' });
        }

        if (!valaszok || !Array.isArray(valaszok)) {
            return res.status(400).json({ success: false, message: 'A valaszok mező kötelező és tömbnek kell lennie.' });
        }

        // Teszt kérdéseinek betöltése pontszámokkal
        const tqList = await db.select().from(testQuestions)
            .where(eq(testQuestions.tesztId, attempt.tesztId));

        // Kérdés -> pontszám térkép
        const pontszamMap = {};
        for (const tq of tqList) {
            pontszamMap[tq.kerdesId] = tq.pontszam || 1;
        }

        let osszpontszam = 0;
        let maxPontszam = 0;

        // Válaszok feldolgozása
        for (const valasz of valaszok) {
            const { kerdesId, opcioIdk } = valasz;
            if (!kerdesId || !opcioIdk || !Array.isArray(opcioIdk)) continue;

            // Kérdés betöltése
            const qList = await db.select().from(questions).where(eq(questions.id, Number(kerdesId))).limit(1);
            if (qList.length === 0) continue;
            const kerdes = qList[0];

            // Helyes opciók betöltése
            const correctOpts = await db.select().from(options)
                .where(and(eq(options.kerdesId, kerdes.id), eq(options.helyesE, true)));

            const correctIds = correctOpts.map(o => o.id).sort();
            const submittedIds = opcioIdk.map(Number).sort();

            const kerdesPontszam = pontszamMap[kerdes.id] || 1;
            maxPontszam += kerdesPontszam;

            // Pontozás: minden helyes opciót eltalált, és nincs rossz opció
            const isCorrect = correctIds.length === submittedIds.length &&
                correctIds.every((val, idx) => val === submittedIds[idx]);

            if (isCorrect) {
                osszpontszam += kerdesPontszam;
            }

            // Válasz mentése
            const newAnswer = await db.insert(studentAnswers).values({
                kitoltesId: attempt.id,
                kerdesId: kerdes.id,
            }).returning();

            // Kiválasztott opciók mentése
            for (const opcioId of opcioIdk) {
                await db.insert(studentAnswerOptions).values({
                    diakValaszId: newAnswer[0].id,
                    opcioId: Number(opcioId),
                });
            }
        }

        // Kitöltés befejezése
        const updated = await db.update(attempts)
            .set({
                statusz: 'BEFEJEZVE',
                befejezesIdeje: new Date(),
                osszpontszam,
            })
            .where(eq(attempts.id, attempt.id))
            .returning();

        return res.status(200).json({
            success: true,
            message: 'Kitöltés beadva és kijavítva!',
            attempt: updated[0],
            osszpontszam,
            maxPontszam,
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
        const userRole = req.user.szerepkor;

        const foundAttempts = await db.select().from(attempts).where(eq(attempts.id, Number(id))).limit(1);
        if (foundAttempts.length === 0) {
            return res.status(404).json({ success: false, message: 'Kitöltés nem található.' });
        }
        const attempt = foundAttempts[0];

        // Csak a saját kitöltését nézheti meg a diák, vagy tanár/admin bármelyiket
        if (userRole === 'DIAK' && attempt.diakId !== userId) {
            return res.status(403).json({ success: false, message: 'Ez a kitöltés nem a te kitöltésed.' });
        }

        // Teszt adatai
        const foundTests = await db.select().from(tests).where(eq(tests.id, attempt.tesztId)).limit(1);
        const test = foundTests[0];

        // Válaszok betöltése
        const answers = await db.select().from(studentAnswers).where(eq(studentAnswers.kitoltesId, attempt.id));

        // Részletes válaszok opciókkal
        const detailedAnswers = [];
        for (const ans of answers) {
            const qList = await db.select().from(questions).where(eq(questions.id, ans.kerdesId)).limit(1);
            if (qList.length === 0) continue;
            const kerdes = qList[0];

            const selectedOpts = await db.select().from(studentAnswerOptions)
                .where(eq(studentAnswerOptions.diakValaszId, ans.id));

            const selectedOptionIds = selectedOpts.map(so => so.opcioId);

            // Helyes opciók (tanár/admin láthatja)
            const correctOpts = await db.select().from(options)
                .where(and(eq(options.kerdesId, kerdes.id), eq(options.helyesE, true)));

            detailedAnswers.push({
                kerdesId: kerdes.id,
                kerdesSzovege: kerdes.kerdesSzovege,
                valasztottOpcioIdk: selectedOptionIds,
                helyesOpcioIdk: correctOpts.map(o => o.id),
                helyesE: selectedOptionIds.length === correctOpts.length &&
                    selectedOptionIds.sort().every((val, idx) => val === correctOpts.map(o => o.id).sort()[idx]),
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
        const diakId = req.user.id;

        const result = await db.select().from(attempts)
            .where(eq(attempts.diakId, diakId))
            .orderBy(desc(attempts.kezdesIdeje));

        // Teszt címek hozzáadása
        const detailed = [];
        for (const att of result) {
            const foundTests = await db.select().from(tests).where(eq(tests.id, att.tesztId)).limit(1);
            detailed.push({
                ...att,
                tesztCim: foundTests.length > 0 ? foundTests[0].cim : 'Ismeretlen teszt',
            });
        }

        return res.status(200).json({ success: true, attempts: detailed });
    } catch (error) {
        console.error('Kitöltés lista hiba:', error);
        return res.status(500).json({ success: false, message: 'Szerverhiba történt.' });
    }
};