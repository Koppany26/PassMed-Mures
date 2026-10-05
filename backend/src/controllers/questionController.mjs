/* 
Kategóriák és kérdések kezelése
*/
import { eq, desc } from 'drizzle-orm';
import { db } from '../db_drizzle/index.js';
import { categories, questions, options } from '../db_drizzle/questions.js';

// --- KATEGÓRIÁK LISTÁZÁSA ---
export const getCategories = async (req, res) => {
    try {
        const result = await db.select().from(categories).orderBy(categories.name);
        return res.status(200).json({ success: true, categories: result });
    } catch (error) {
        console.error('Kategória lista hiba:', error);
        return res.status(500).json({ success: false, message: 'Szerverhiba történt.' });
    }
};

// --- KATEGÓRIA LÉTREHOZÁSA (TANAR/ADMIN) ---
export const createCategory = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'A kategória neve kötelező.' });
        }

        const newCategory = await db.insert(categories).values({ name: name.trim() }).returning();
        return res.status(201).json({ success: true, message: 'Kategória létrehozva!', category: newCategory[0] });
    } catch (error) {
        console.error('Kategória létrehozási hiba:', error);
        return res.status(500).json({ success: false, message: 'Szerverhiba történt.' });
    }
};

// --- KÉRDÉSEK LISTÁZÁSA (opciókkal együtt) ---
export const getQuestions = async (req, res) => {
    try {
        const { categoryId } = req.query;

        let query = db.select().from(questions);
        if (categoryId) {
            query = query.where(eq(questions.categoryId, Number(categoryId)));
        }
        const questionList = await query.orderBy(desc(questions.createdAt));

        // Opciók betöltése kérdésenként
        const result = [];
        for (const q of questionList) {
            const opts = await db.select().from(options).where(eq(options.questionId, q.id)).orderBy(options.order);
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
        const { categoryId, questionText, imageUrl, explanation, answerType, options: optionList } = req.body;

        if (!categoryId || !questionText || !optionList || optionList.length < 2) {
            return res.status(400).json({ success: false, message: 'Kategória, kérdésszöveg és legalább 2 válaszlehetőség szükséges.' });
        }

        // Kategória létezik-e?
        const cat = await db.select().from(categories).where(eq(categories.id, Number(categoryId))).limit(1);
        if (cat.length === 0) {
            return res.status(400).json({ success: false, message: 'A megadott kategória nem létezik.' });
        }

        // answerCount: ahány helyes opció van az optionList-ben (a séma megköveteli, hogy > 0 legyen)
        const correctCount = optionList.filter(opt => opt.isCorrect).length;

        // Kérdés beszúrása
        const newQuestion = await db.insert(questions).values({
            categoryId: Number(categoryId),
            questionText,
            imageUrl: imageUrl || null,
            explanation: explanation || null,
            answerType: answerType || 'SINGLE',
            answerCount: correctCount > 0 ? correctCount : 1,
        }).returning();

        // Opciók beszúrása
        const questionId = newQuestion[0].id;
        const insertedOptions = [];
        for (let i = 0; i < optionList.length; i++) {
            const opt = optionList[i];
            const newOpt = await db.insert(options).values({
                questionId: questionId,
                optionText: opt.optionText,
                isCorrect: opt.isCorrect || false,
                order: i,
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
        const { categoryId, questionText, imageUrl, explanation, answerType } = req.body;

        const existing = await db.select().from(questions).where(eq(questions.id, Number(id))).limit(1);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Kérdés nem található.' });
        }

        const updated = await db.update(questions)
            .set({
                categoryId: categoryId !== undefined ? Number(categoryId) : existing[0].categoryId,
                questionText: questionText !== undefined ? questionText : existing[0].questionText,
                imageUrl: imageUrl !== undefined ? imageUrl : existing[0].imageUrl,
                explanation: explanation !== undefined ? explanation : existing[0].explanation,
                answerType: answerType !== undefined ? answerType : existing[0].answerType,
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