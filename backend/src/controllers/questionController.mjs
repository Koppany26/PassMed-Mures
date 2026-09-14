/* 
Kategóriák és kérdések kezelése
*/
import { eq, desc } from 'drizzle-orm';
import { db } from '../db_drizzle/index.js';
import { categories, questions, options } from '../db_drizzle/questions.js';

// --- KATEGÓRIÁK LISTÁZÁSA ---
export const getCategories = async (req, res) => {
    try {
        const result = await db.select().from(categories).orderBy(categories.nev);
        return res.status(200).json({ success: true, categories: result });
    } catch (error) {
        console.error('Kategória lista hiba:', error);
        return res.status(500).json({ success: false, message: 'Szerverhiba történt.' });
    }
};

// --- KATEGÓRIA LÉTREHOZÁSA (TANAR/ADMIN) ---
export const createCategory = async (req, res) => {
    try {
        const { nev } = req.body;
        if (!nev || !nev.trim()) {
            return res.status(400).json({ success: false, message: 'A kategória neve kötelező.' });
        }

        const newCategory = await db.insert(categories).values({ nev: nev.trim() }).returning();
        return res.status(201).json({ success: true, message: 'Kategória létrehozva!', category: newCategory[0] });
    } catch (error) {
        console.error('Kategória létrehozási hiba:', error);
        return res.status(500).json({ success: false, message: 'Szerverhiba történt.' });
    }
};

// --- KÉRDÉSEK LISTÁZÁSA (opciókkal együtt) ---
export const getQuestions = async (req, res) => {
    try {
        const { kategoriaId } = req.query;

        let query = db.select().from(questions);
        if (kategoriaId) {
            query = query.where(eq(questions.kategoriaId, Number(kategoriaId)));
        }
        const questionList = await query.orderBy(desc(questions.createdAt));

        // Opciók betöltése kérdésenként
        const result = [];
        for (const q of questionList) {
            const opts = await db.select().from(options).where(eq(options.kerdesId, q.id)).orderBy(options.sorrend);
            result.push({ ...q, options: opts });
        }

        return res.status(200).json({ success: true, questions: result });
    } catch (error) {
        console.error('Kérdés lista hiba:', error);
        return res.status(500).json({ success: false, message: 'Szerverhiba történt.' });
    }
};

// --- KÉRDÉS LÉTREHOZÁSA (TANAR/ADMIN) ---
export const createQuestion = async (req, res) => {
    try {
        const { kategoriaId, kerdesSzovege, kepUrl, magyarazat, valaszTipus, options: optionList } = req.body;

        if (!kategoriaId || !kerdesSzovege || !optionList || optionList.length < 2) {
            return res.status(400).json({ success: false, message: 'Kategória, kérdésszöveg és legalább 2 válaszlehetőség szükséges.' });
        }

        // Kategória létezik-e?
        const cat = await db.select().from(categories).where(eq(categories.id, Number(kategoriaId))).limit(1);
        if (cat.length === 0) {
            return res.status(400).json({ success: false, message: 'A megadott kategória nem létezik.' });
        }

        // Kérdés beszúrása
        const newQuestion = await db.insert(questions).values({
            kategoriaId: Number(kategoriaId),
            kerdesSzovege,
            kepUrl: kepUrl || null,
            magyarazat: magyarazat || null,
            valaszTipus: valaszTipus || 'EGYSZERES',
        }).returning();

        // Opciók beszúrása
        const questionId = newQuestion[0].id;
        const insertedOptions = [];
        for (let i = 0; i < optionList.length; i++) {
            const opt = optionList[i];
            const newOpt = await db.insert(options).values({
                kerdesId: questionId,
                valaszSzovege: opt.valaszSzovege,
                helyesE: opt.helyesE || false,
                sorrend: i,
            }).returning();
            insertedOptions.push(newOpt[0]);
        }

        return res.status(201).json({
            success: true,
            message: 'Kérdés létrehozva!',
            question: { ...newQuestion[0], options: insertedOptions }
        });
    } catch (error) {
        console.error('Kérdés létrehozási hiba:', error);
        return res.status(500).json({ success: false, message: 'Szerverhiba történt.' });
    }
};

// --- KÉRDÉS MÓDOSÍTÁSA (TANAR/ADMIN) ---
export const updateQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        const { kategoriaId, kerdesSzovege, kepUrl, magyarazat, valaszTipus } = req.body;

        const existing = await db.select().from(questions).where(eq(questions.id, Number(id))).limit(1);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Kérdés nem található.' });
        }

        const updated = await db.update(questions)
            .set({
                kategoriaId: kategoriaId !== undefined ? Number(kategoriaId) : existing[0].kategoriaId,
                kerdesSzovege: kerdesSzovege !== undefined ? kerdesSzovege : existing[0].kerdesSzovege,
                kepUrl: kepUrl !== undefined ? kepUrl : existing[0].kepUrl,
                magyarazat: magyarazat !== undefined ? magyarazat : existing[0].magyarazat,
                valaszTipus: valaszTipus !== undefined ? valaszTipus : existing[0].valaszTipus,
            })
            .where(eq(questions.id, Number(id)))
            .returning();

        return res.status(200).json({ success: true, message: 'Kérdés frissítve!', question: updated[0] });
    } catch (error) {
        console.error('Kérdés frissítési hiba:', error);
        return res.status(500).json({ success: false, message: 'Szerverhiba történt.' });
    }
};

// --- KÉRDÉS TÖRLÉSE (TANAR/ADMIN) ---
export const deleteQuestion = async (req, res) => {
    try {
        const { id } = req.params;

        const existing = await db.select().from(questions).where(eq(questions.id, Number(id))).limit(1);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Kérdés nem található.' });
        }

        await db.delete(questions).where(eq(questions.id, Number(id)));
        return res.status(200).json({ success: true, message: 'Kérdés törölve!' });
    } catch (error) {
        console.error('Kérdés törlési hiba:', error);
        return res.status(500).json({ success: false, message: 'Szerverhiba történt.' });
    }
};