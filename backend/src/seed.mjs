/* 
Adatbázis feltöltése mintaadatokkal
Futtatás: npx tsx src/seed.mjs
*/
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { db } from './db_drizzle/index.js';
import { users } from './db_drizzle/users.js';
import { categories, questions, options } from './db_drizzle/questions.js';
import { tests, testQuestions } from './db_drizzle/tests.js';

const log = (msg) => console.log(`[SEED] ${msg}`);

async function seed() {
    log('Adatbázis feltöltése elkezdődött...');

    // --- 1. DEMO FELHASZNÁLÓK ---
    log('Demo felhasználók létrehozása...');
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('jelszo123', salt);

    // Tanár
    const existingTanar = await db.select().from(users).where(eq(users.email, 'tanar@passmed.hu')).limit(1);
    let tanarId;
    if (existingTanar.length === 0) {
        const tanar = await db.insert(users).values({
            name: 'Dr. Kovács Anna',
            email: 'tanar@passmed.hu',
            passwordHash,
            role: 'TEACHER',
        }).returning();
        tanarId = tanar[0].id;
        log(`Tanár létrehozva (id: ${tanarId})`);
    } else {
        tanarId = existingTanar[0].id;
        log(`Tanár már létezik (id: ${tanarId})`);
    }

    // Diák
    const existingDiak = await db.select().from(users).where(eq(users.email, 'diak@passmed.hu')).limit(1);
    let diakId;
    if (existingDiak.length === 0) {
        const diak = await db.insert(users).values({
            name: 'Nagy Péter',
            email: 'diak@passmed.hu',
            passwordHash,
            role: 'STUDENT',
        }).returning();
        diakId = diak[0].id;
        log(`Diák létrehozva (id: ${diakId})`);
    } else {
        diakId = existingDiak[0].id;
        log(`Diák már létezik (id: ${diakId})`);
    }

    // --- 2. KATEGÓRIÁK ---
    log('Kategóriák létrehozása...');
    const kategoriaNevek = ['Anatómia', 'Fiziológia', 'Patológia', 'Farmakológia'];
    const kategoriaIds = {};
    for (const nev of kategoriaNevek) {
        const existing = await db.select().from(categories).where(eq(categories.name, nev)).limit(1);
        if (existing.length === 0) {
            const cat = await db.insert(categories).values({ name: nev }).returning();
            kategoriaIds[nev] = cat[0].id;
            log(`Kategória létrehozva: ${nev} (id: ${cat[0].id})`);
        } else {
            kategoriaIds[nev] = existing[0].id;
            log(`Kategória már létezik: ${nev} (id: ${existing[0].id})`);
        }
    }

    // --- 3. KÉRDÉSEK ÉS OPCIÓK ---
    log('Kérdések létrehozása...');
    const kerdesAdatok = [
        {
            kategoria: 'Anatómia',
            szoveg: 'Melyik csont található az alkarban?',
            valaszTipus: 'EGYSZERES',
            magyarazat: 'Az alkarban két csont található: a radius (orsócsont) és az ulna (singcsont).',
            opciok: [
                { szoveg: 'Femur', helyes: false },
                { szoveg: 'Radius', helyes: true },
                { szoveg: 'Tibia', helyes: false },
                { szoveg: 'Humerus', helyes: false },
            ],
        },
        {
            kategoria: 'Anatómia',
            szoveg: 'Melyik szerv termeli az inzulint?',
            valaszTipus: 'EGYSZERES',
            magyarazat: 'Az inzulint a hasnyálmirigy (pancreas) Langerhans-szigeteinek béta-sejtjei termelik.',
            opciok: [
                { szoveg: 'Máj', helyes: false },
                { szoveg: 'Vese', helyes: false },
                { szoveg: 'Hasnyálmirigy', helyes: true },
                { szoveg: 'Lép', helyes: false },
            ],
        },
        {
            kategoria: 'Fiziológia',
            szoveg: 'Melyek a vér fő alkotóelemei? (Több válasz is helyes)',
            valaszTipus: 'TOBBSZOROS',
            magyarazat: 'A vér fő alkotóelemei: vörösvértestek (erythrocyták), fehérvérsejtek (leukocyták), vérlemezkék (thrombocyták) és a vérplazma.',
            opciok: [
                { szoveg: 'Vörösvértestek', helyes: true },
                { szoveg: 'Fehérvérsejtek', helyes: true },
                { szoveg: 'Vérlemezkék', helyes: true },
                { szoveg: 'Csontvelő', helyes: false },
            ],
        },
        {
            kategoria: 'Patológia',
            szoveg: 'Mi a magas vérnyomás (hipertónia) leggyakoribb szövődménye?',
            valaszTipus: 'EGYSZERES',
            magyarazat: 'A kezeletlen magas vérnyomás szív- és érrendszeri betegségekhez, stroke-hoz és vesekárosodáshoz vezethet.',
            opciok: [
                { szoveg: 'Szívinfarktus', helyes: true },
                { szoveg: 'Tüdőgyulladás', helyes: false },
                { szoveg: 'Gyomorfekély', helyes: false },
                { szoveg: 'Migrén', helyes: false },
            ],
        },
        {
            kategoria: 'Farmakológia',
            szoveg: 'Melyik gyógyszercsoportba tartozik az acetilszalicilsav (aszpirin)?',
            valaszTipus: 'EGYSZERES',
            magyarazat: 'Az acetilszalicilsav nem-szteroid gyulladáscsökkentő (NSAID), amely fájdalomcsillapító, lázcsillapító és gyulladáscsökkentő hatással rendelkezik.',
            opciok: [
                { szoveg: 'Antibiotikum', helyes: false },
                { szoveg: 'NSAID', helyes: true },
                { szoveg: 'Opioid', helyes: false },
                { szoveg: 'Antihisztamin', helyes: false },
            ],
        },
    ];

    const kerdesIds = [];
    for (const kd of kerdesAdatok) {
        const categoryId = kategoriaIds[kd.kategoria];
        const existing = await db.select().from(questions)
            .where(eq(questions.questionText, kd.szoveg))
            .limit(1);

        let kerdesId;
        if (existing.length === 0) {
            // answerCount: hány helyes válasz van (a séma megköveteli, hogy > 0 legyen)
            const answerCount = kd.opciok.filter(opt => opt.helyes).length;
            const q = await db.insert(questions).values({
                categoryId,
                questionText: kd.szoveg,
                answerType: kd.valaszTipus === 'TOBBSZOROS' ? 'MULTIPLE' : 'SINGLE',
                explanation: kd.magyarazat,
                answerCount,
            }).returning();
            kerdesId = q[0].id;

            // Opciók
            for (let i = 0; i < kd.opciok.length; i++) {
                const opt = kd.opciok[i];
                await db.insert(options).values({
                    questionId: kerdesId,
                    optionText: opt.szoveg,
                    isCorrect: opt.helyes,
                    order: i,
                });
            }
            log(`Kérdés létrehozva: "${kd.szoveg}" (id: ${kerdesId})`);
        } else {
            kerdesId = existing[0].id;
            log(`Kérdés már létezik: "${kd.szoveg}" (id: ${kerdesId})`);
        }
        kerdesIds.push(kerdesId);
    }

    // --- 4. TESZT ---
    log('Teszt létrehozása...');
    const existingTest = await db.select().from(tests).where(eq(tests.title, 'Orvosi Alapismeretek Teszt')).limit(1);
    let tesztId;
    if (existingTest.length === 0) {
        const t = await db.insert(tests).values({
            title: 'Orvosi Alapismeretek Teszt',
            description: 'Ez egy minta teszt az orvosi alapismeretekhez. 5 kérdésből áll.',
            timeLimitMinutes: 15,
            teacherId: tanarId,
        }).returning();
        tesztId = t[0].id;
        log(`Teszt létrehozva: "Orvosi Alapismeretek Teszt" (id: ${tesztId})`);
    } else {
        tesztId = existingTest[0].id;
        log(`Teszt már létezik (id: ${tesztId})`);
    }

    // Kérdések hozzáadása a teszthez
    for (let i = 0; i < kerdesIds.length; i++) {
        const existingTQ = await db.select().from(testQuestions)
            .where(eq(testQuestions.testId, tesztId))
            .where(eq(testQuestions.questionId, kerdesIds[i]))
            .limit(1);

        if (existingTQ.length === 0) {
            await db.insert(testQuestions).values({
                testId: tesztId,
                questionId: kerdesIds[i],
                order: i,
                points: 1,
            });
            log(`Kérdés (id: ${kerdesIds[i]}) hozzáadva a teszthez`);
        }
    }

    log('========================================');
    log('FELTÖLTÉS KÉSZ!');
    log('Demo felhasználók:');
    log('  Tanár: tanar@passmed.hu / jelszo123');
    log('  Diák:  diak@passmed.hu / jelszo123');
    log('========================================');
}

seed().catch((err) => {
    console.error('[SEED] Hiba történt:', err);
    process.exit(1);
});