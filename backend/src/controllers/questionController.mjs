/* 
Kategóriák és kérdések kezelése
*/
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../db_drizzle/index.ts';
import { categories, questions, options, topics, questionTopics, bodyRegions } from '../db_drizzle/questions.js';

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

export const getTopics = async (req, res) => {
    try {
        const categoryId = req.query.categoryId ? Number(req.query.categoryId) : null;
        if (categoryId !== null && (!Number.isInteger(categoryId) || categoryId < 1)) {
            return res.status(400).json({ success: false, message: 'Érvénytelen vizsgatárgy.' });
        }
        let query = db.select().from(topics);
        if (categoryId !== null) query = query.where(eq(topics.categoryId, categoryId));
        const result = await query.orderBy(asc(topics.name));
        return res.status(200).json({ success: true, topics: result });
    } catch (error) {
        console.error('Témakörlista hiba:', error);
        return res.status(500).json({ success: false, message: 'A témakörök betöltése nem sikerült.' });
    }
};

export const getBodyRegions = async (req, res) => {
    try {
        const result = await db.select().from(bodyRegions).orderBy(asc(bodyRegions.name));
        return res.status(200).json({ success: true, regions: result });
    } catch (error) {
        console.error('Testrészlista hiba:', error);
        return res.status(500).json({ success: false, message: 'A testrészek betöltése nem sikerült.' });
    }
};

export const updateTopicBodyRegion = async (req, res) => {
    try {
        const topicId = Number(req.params.id);
        const rawRegionId = req.body?.bodyRegionId;
        const bodyRegionId = rawRegionId === null || rawRegionId === ''
            ? null
            : Number(rawRegionId);
        if (!Number.isInteger(topicId) || topicId < 1
            || (bodyRegionId !== null && (!Number.isInteger(bodyRegionId) || bodyRegionId < 1))) {
            return res.status(400).json({ success: false, message: 'Érvénytelen témakör- vagy testrészazonosító.' });
        }

        const topic = await db.select({ id: topics.id }).from(topics)
            .where(eq(topics.id, topicId)).limit(1);
        if (topic.length === 0) {
            return res.status(404).json({ success: false, message: 'A témakör nem található.' });
        }
        if (bodyRegionId !== null) {
            const region = await db.select({ id: bodyRegions.id }).from(bodyRegions)
                .where(eq(bodyRegions.id, bodyRegionId)).limit(1);
            if (region.length === 0) {
                return res.status(400).json({ success: false, message: 'A kiválasztott testrész nem található.' });
            }
        }

        const updated = await db.update(topics).set({ bodyRegionId })
            .where(eq(topics.id, topicId)).returning();
        return res.status(200).json({ success: true, topic: updated[0] });
    } catch (error) {
        console.error('Témakör testrészének módosítási hiba:', error);
        return res.status(500).json({ success: false, message: 'A testrész hozzárendelése nem sikerült.' });
    }
};

async function validateTopicIds(topicIds, categoryId) {
    if (!Array.isArray(topicIds) || topicIds.some(id => !Number.isInteger(Number(id)) || Number(id) < 1)) {
        return { error: 'Érvénytelen témakörlista.' };
    }
    const normalizedTopicIds = [...new Set(topicIds.map(Number))];
    if (normalizedTopicIds.length === 0) return { topicIds: normalizedTopicIds };
    const foundTopics = await db.select({ id: topics.id }).from(topics).where(and(
        inArray(topics.id, normalizedTopicIds),
        eq(topics.categoryId, categoryId),
    ));
    if (foundTopics.length !== normalizedTopicIds.length) {
        return { error: 'Minden témakörnek a kiválasztott vizsgatárgyhoz kell tartoznia.' };
    }
    return { topicIds: normalizedTopicIds };
}

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
        const { categoryId, topicId } = req.query;

        const filters = [];
        if (categoryId) {
            const parsedCategoryId = Number(categoryId);
            if (!Number.isInteger(parsedCategoryId) || parsedCategoryId < 1) {
                return res.status(400).json({ success: false, message: 'Érvénytelen vizsgatárgy.' });
            }
            filters.push(eq(questions.categoryId, parsedCategoryId));
        }
        if (topicId) {
            const parsedTopicId = Number(topicId);
            if (!Number.isInteger(parsedTopicId) || parsedTopicId < 1) {
                return res.status(400).json({ success: false, message: 'Érvénytelen témakör.' });
            }
            const links = await db.select({ questionId: questionTopics.questionId })
                .from(questionTopics).where(eq(questionTopics.topicId, parsedTopicId));
            const questionIds = links.map(link => link.questionId);
            if (questionIds.length === 0) {
                return res.status(200).json({ success: true, questions: [] });
            }
            filters.push(inArray(questions.id, questionIds));
        }
        let query = db.select().from(questions);
        if (filters.length > 0) query = query.where(and(...filters));
        const questionList = await query.orderBy(desc(questions.createdAt));

        // Opciók betöltése kérdésenként
        const result = [];
        for (const q of questionList) {
            const opts = await db.select().from(options).where(eq(options.questionId, q.id)).orderBy(options.order);
            const questionTopicRows = await db.select({
                id: topics.id,
                name: topics.name,
                categoryId: topics.categoryId,
            }).from(questionTopics)
                .innerJoin(topics, eq(questionTopics.topicId, topics.id))
                .where(eq(questionTopics.questionId, q.id))
                .orderBy(asc(topics.name));
            result.push({
                ...(req.user?.role === 'STUDENT'
                    ? (({ explanation, ...safeQuestion }) => safeQuestion)(q)
                    : q),
                options: req.user?.role === 'STUDENT'
                    ? opts.map(({ isCorrect, ...option }) => option)
                    : opts,
                topics: questionTopicRows,
            });
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
        const { categoryId, questionText, imageUrl, explanation, answerType, options: optionList, topicIds = [] } = req.body || {};

        if (!categoryId || typeof questionText !== 'string' || !questionText.trim()
            || !Array.isArray(optionList) || optionList.length < 2) {
            return res.status(400).json({ success: false, message: 'Vizsgatárgy, kérdésszöveg és legalább 2 válaszlehetőség szükséges.' });
        }

        // Kategória létezik-e?
        const cat = await db.select().from(categories).where(eq(categories.id, Number(categoryId))).limit(1);
        if (cat.length === 0) {
            return res.status(400).json({ success: false, message: 'A megadott vizsgatárgy nem létezik.' });
        }
        const validatedTopics = await validateTopicIds(topicIds, Number(categoryId));
        if (validatedTopics.error) {
            return res.status(400).json({ success: false, message: validatedTopics.error });
        }

        // answerCount: ahány helyes opció van az optionList-ben (a séma megköveteli, hogy > 0 legyen)
        const correctCount = optionList.filter(opt => opt.isCorrect).length;

        const created = await db.transaction(async (tx) => {
            const inserted = await tx.insert(questions).values({
                categoryId: Number(categoryId),
                questionText: questionText.trim(),
                imageUrl: imageUrl || null,
                explanation: explanation || null,
                answerType: answerType || 'SINGLE',
                answerCount: correctCount > 0 ? correctCount : 1,
            }).returning();
            const question = inserted[0];
            const insertedOptions = await tx.insert(options).values(optionList.map((option, order) => ({
                questionId: question.id,
                optionText: option.optionText.trim(),
                isCorrect: option.isCorrect === true,
                order,
            }))).returning();
            if (validatedTopics.topicIds.length > 0) {
                await tx.insert(questionTopics).values(validatedTopics.topicIds.map(topicId => ({
                    questionId: question.id,
                    topicId,
                })));
            }
            return { question, options: insertedOptions };
        });

        return res.status(201).json({
            success: true,
            message: 'Kérdés létrehozva!',
            question: { ...created.question, options: created.options, topicIds: validatedTopics.topicIds }
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
        const { categoryId, questionText, imageUrl, explanation, answerType, topicIds } = req.body || {};

        const existing = await db.select().from(questions).where(eq(questions.id, Number(id))).limit(1);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Kérdés nem található.' });
        }
        const normalizedCategoryId = categoryId !== undefined ? Number(categoryId) : existing[0].categoryId;
        const category = await db.select({ id: categories.id }).from(categories)
            .where(eq(categories.id, normalizedCategoryId)).limit(1);
        if (category.length === 0) {
            return res.status(400).json({ success: false, message: 'A megadott vizsgatárgy nem létezik.' });
        }
        const validatedTopics = topicIds === undefined
            ? normalizedCategoryId === existing[0].categoryId ? null : { topicIds: [] }
            : await validateTopicIds(topicIds, normalizedCategoryId);
        if (validatedTopics && validatedTopics.error) {
            return res.status(400).json({ success: false, message: validatedTopics.error });
        }

        const updated = await db.transaction(async (tx) => {
            const rows = await tx.update(questions)
                .set({
                    categoryId: normalizedCategoryId,
                    questionText: questionText !== undefined ? questionText : existing[0].questionText,
                    imageUrl: imageUrl !== undefined ? imageUrl : existing[0].imageUrl,
                    explanation: explanation !== undefined ? explanation : existing[0].explanation,
                    answerType: answerType !== undefined ? answerType : existing[0].answerType,
                })
                .where(eq(questions.id, Number(id)))
                .returning();
            if (validatedTopics) {
                await tx.delete(questionTopics).where(eq(questionTopics.questionId, Number(id)));
                if (validatedTopics.topicIds.length > 0) {
                    await tx.insert(questionTopics).values(validatedTopics.topicIds.map(topicId => ({
                        questionId: Number(id),
                        topicId,
                    })));
                }
            }
            return rows;
        });

        return res.status(200).json({ success: true, message: 'Kérdés frissítve!', question: updated[0] });
    } catch (error) {
        console.error('Kérdés frissítési hiba:', error);
        return res.status(500).json({ success: false, message: 'Szerverhiba történt.' });
    }
};

export const answerTopicPractice = async (req, res) => {
    try {
        if (req.user.role !== 'STUDENT') {
            return res.status(403).json({ success: false, message: 'A témakörös gyakorlás diákoknak érhető el.' });
        }
        const questionId = Number(req.params.id);
        const { topicId: rawTopicId, optionIds } = req.body || {};
        const topicId = Number(rawTopicId);
        if (!Number.isInteger(questionId) || questionId < 1
            || !Number.isInteger(topicId) || topicId < 1
            || !Array.isArray(optionIds)) {
            return res.status(400).json({ success: false, message: 'Érvénytelen kérdés, témakör vagy válasz.' });
        }

        const link = await db.select({ questionId: questionTopics.questionId })
            .from(questionTopics).where(and(
                eq(questionTopics.questionId, questionId),
                eq(questionTopics.topicId, topicId),
            )).limit(1);
        if (link.length === 0) {
            return res.status(404).json({ success: false, message: 'A kérdés nem található ebben a témakörben.' });
        }

        const questionRows = await db.select({
            questionText: questions.questionText,
            explanation: questions.explanation,
        }).from(questions).where(eq(questions.id, questionId)).limit(1);
        const questionOptions = await db.select().from(options)
            .where(eq(options.questionId, questionId));
        const submittedIds = [...new Set(optionIds.map(Number))].sort((a, b) => a - b);
        if (submittedIds.some(id => !Number.isInteger(id)
            || !questionOptions.some(option => option.id === id))) {
            return res.status(400).json({ success: false, message: 'A válasz nem ehhez a kérdéshez tartozik.' });
        }

        const correctIds = questionOptions.filter(option => option.isCorrect)
            .map(option => option.id).sort((a, b) => a - b);
        const isCorrect = correctIds.length > 0
            && correctIds.length === submittedIds.length
            && correctIds.every((id, index) => id === submittedIds[index]);
        return res.status(200).json({
            success: true,
            isCorrect,
            explanation: questionRows[0]?.explanation || null,
            correctOptions: questionOptions.filter(option => option.isCorrect).map(option => option.optionText),
        });
    } catch (error) {
        console.error('Témakörös válasz ellenőrzési hiba:', error);
        return res.status(500).json({ success: false, message: 'A válasz ellenőrzése nem sikerült.' });
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