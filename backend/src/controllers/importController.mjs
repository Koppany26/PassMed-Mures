/* 
Tesztfájlok (docx/pdf) feltöltése, beolvasása, kérdések kinyerése és mentése,
valamint a javítókulcs ("barem") külön feldolgozása.

Flow:
  1) POST /tests/import                 -> feltöltés + elemzés -> előnézet (token)
  2) POST /tests/import/:token/answer-key -> javítókulcs feltöltése -> helyes válaszok
  3) POST /tests/import/:token/approve  -> jóváhagyás -> mentés az adatbázisba
*/

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import multer from 'multer';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import { asc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db_drizzle/index.js';
import { categories, questions, options, topics, questionTopics } from '../db_drizzle/questions.js';
import { tests, testQuestions } from '../db_drizzle/tests.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_DIR = path.join(__dirname, '../../uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Ideiglenes tárolás a beolvasott, még jóváhagyásra váró importoknak (token alapján)
const imports = new Map();

// --- MULTER KONFIGURÁCIÓ ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.bin';
        cb(null, crypto.randomBytes(10).toString('hex') + ext);
    },
});

export const fileUpload = multer({
    storage,
    limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB
});

// --- SZÖVEG KINYERÉS (docx / pdf) ---
async function extractText(filePath, mimetype, filename) {
    const ext = path.extname(filename || '').toLowerCase();

    if (ext === '.docx' || (mimetype && mimetype.includes('wordprocessingml'))) {
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value;
    }

    if (ext === '.pdf' || mimetype === 'application/pdf') {
        const pdf = new PDFParse({ data: fs.readFileSync(filePath) });
        try {
            const result = await pdf.getText();
            return result.text || '';
        } finally {
            if (typeof pdf.destroy === 'function') await pdf.destroy();
        }
    }

    // Ismeretlen típusnál megpróbáljuk szövegként olvasni
    return fs.readFileSync(filePath, 'utf8');
}
// --- TESZT SZÖVEG SZÉTSZEDÉSE KÉRDÉSEKRE ÉS OPCIÓKRA ---
//    "1. <kérdés>"      -> kérdés
//    "A) <opció>"       -> opció (A-D)
const isQuestionRe = /^(\d{1,3})\s*[.)]\.?\s+(.+)$/;
const isOptionRe = /^([A-D])\s*[.)]\.?\s+(.+)$/;
const looksLikeHeader = (s) =>
    /^(variáns|variánt|változat|év|teszt|próba|vizsga|felvételi)$/i.test(s) ||
    /^\d{4}$/.test(s) ||
    s.length <= 2;

export function parseQuestions(lines) {
    const questions = [];
    let current = null;

    for (const line of lines) {
        const qm = line.match(isQuestionRe);
        if (qm) {
            const num = parseInt(qm[1], 10);
            const rest = qm[2].trim();
            // Fejlécek (pl. "3. variáns", "2022") nem kérdések
            if (looksLikeHeader(rest)) {
                current = null;
                continue;
            }
            current = { num, text: rest, options: [] };
            questions.push(current);
            continue;
        }

        const om = line.match(isOptionRe);
        if (om) {
            if (current) {
                current.options.push({ text: om[2].trim(), isCorrect: false });
            }
            continue;
        }

        // Többsoros kérdésszöveg folytatása; a túl rövid/üres sorok kihagyva
        if (current && line.trim().length > 1) {
            const t = line.trim();
            if (current.options.length > 0) {
                const last = current.options[current.options.length - 1];
                last.text += ' ' + t;
            } else {
                current.text += ' ' + t;
            }
        }
    }

    return questions;
}

// --- JAVÍTÓKULCS SZÖVEG FELDOLGOZÁSA (szám -> betűk) ---
//    Pl.: "1A 2C 3B" / "1. AB\n2. C\n3. BD" / "1. A, B" / táblázat
//    TÖBB helyes válasz is lehet, pl. "BC" = B és C is helyes!
export function parseBaremMap(text) {
    const map = {};
    const re = /(\d{1,3})\s*[.)]?\s*[:\-–]?\s*([A-Ea-e](?:[A-Ea-e]|[\s,;/.\-–]+[A-E])*)/g;
    let m;
    while ((m = re.exec(text)) !== null) {
        const num = parseInt(m[1], 10);
        // Betűk kigyűjtése, nagybetűsítve (pl. "A, B" -> "AB")
        const letters = m[2].toUpperCase().replace(/[^A-E]/g, '');
        if (letters) map[num] = letters;
    }
    return map;
}

// --- HELYES VÁLASZOK BEÁLLÍTÁSA A JAVÍTÓKULCS ALAPJÁN ---
//    A map értéke több betűt is tartalmazhat (pl. "AB"),
//    ilyenkor MINDEN megadott betűhöz tartozó opció helyes lesz.
export function applyBarem(questions, map) {
    const letterIndex = { A: 0, B: 1, C: 2, D: 3, E: 4 };
    for (const q of questions) {
        const letters = map[q.num];
        if (!letters) continue;

        const correctIdx = new Set();
        for (const ch of letters) {
            const idx = letterIndex[ch];
            // Csak a ténylegesen létező opciókra jelölünk (pl. E betű 4 opció esetén)
            if (idx != null && idx < q.options.length) correctIdx.add(idx);
        }
        if (correctIdx.size === 0) continue;

        q.options = q.options.map((o, oi) => ({ ...o, isCorrect: correctIdx.has(oi) }));
    }
}

// --- ELŐNÉZET OBJEKTUM (a frontendnek) ---
function toPreview(rec) {
    return {
        token: rec.token,
        fileName: rec.fileName,
        fileUrl: rec.fileUrl,
        title: rec.title,
        description: rec.description,
        timeLimitMinutes: rec.timeLimitMinutes,
        questionCount: rec.questions.length,
        questions: rec.questions.map(q => ({
            num: q.num,
            text: q.text,
            options: q.options.map(o => ({ text: o.text, isCorrect: o.isCorrect })),
        })),
    };
}

function niceTitle(fileName) {
    const base = path.parse(fileName).name || 'Importált teszt';
    return base.replace(/[_[\]()]+/g, ' ').replace(/\s{2,}/g, ' ').trim() || 'Importált teszt';
}
// ==========================
// 1. TESZT FELTÖLTÉSE + ELEMZÉS
// ==========================
export const uploadTest = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Kérlek válassz egy fájlt (docx vagy pdf).' });
        }

        const text = await extractText(req.file.path, req.file.mimetype, req.file.originalname);
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        const parsed = parseQuestions(lines);

        if (parsed.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Nem találtam kérdéseket a fájlban. Ellenőrizd a formátumot (számozott kérdések A)–D) opciókkal).',
            });
        }

        const token = crypto.randomBytes(14).toString('hex');
        const rec = {
            token,
            teacherId: req.user ? req.user.id : null,
            fileName: req.file.originalname,
            filePath: req.file.path,
            fileUrl: `/uploads/${path.basename(req.file.path)}`,
            title: niceTitle(req.file.originalname),
            description: '',
            timeLimitMinutes: null,
            questions: parsed,
        };
        imports.set(token, rec);

        return res.status(200).json({
            success: true,
            message: `${parsed.length} kérdést találtam a fájlban.`,
            preview: toPreview(rec),
        });
    } catch (error) {
        console.error('Import hiba:', error);
        return res.status(500).json({ success: false, message: 'A fájl feldolgozása közben hiba történt.' });
    }
};

// ==========================
// 2. JAVÍTÓKULCS (BAREM) FELTÖLTÉSE (külön tartható, ellenőrizhető)
// ==========================
export const uploadAnswerKey = async (req, res) => {
    try {
        const { token } = req.params;
        const rec = imports.get(token);
        if (!rec) {
            return res.status(404).json({ success: false, message: 'A feltöltési munkamenet nem található.' });
        }
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Javítókulcs fájl szükséges (docx/pdf/txt).' });
        }

        const text = await extractText(req.file.path, req.file.mimetype, req.file.originalname);
        const map = parseBaremMap(text);
        const matched = Object.keys(map).filter(n => rec.questions.some(q => q.num === Number(n))).length;

        applyBarem(rec.questions, map);

        return res.status(200).json({
            success: true,
            message: `Javítókulcs feldolgozva (${matched} kérdésre vonatkozik).`,
            preview: toPreview(rec),
        });
    } catch (error) {
        console.error('Javítókulcs hiba:', error);
        return res.status(500).json({ success: false, message: 'A javítókulcs feldolgozása közben hiba történt.' });
    }
};

// ==========================
// ELŐNÉZET LEKÉRÉSE TOKEN ALAPJÁN
// ==========================
export const getImportPreview = async (req, res) => {
    const rec = imports.get(req.params.token);
    if (!rec) {
        return res.status(404).json({ success: false, message: 'Nem található feltöltési munkamenet.' });
    }
    return res.status(200).json({ success: true, preview: toPreview(rec) });
};
// ==========================
// 3. JÓVÁHAGYÁS ÉS MENTÉS AZ ADATBÁZISBA
// ==========================
function normalizeQuestionText(value) {
    return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

function getQuestionSignature(question) {
    const optionsSignature = question.options
        .map(option => [normalizeQuestionText(option.text), option.isCorrect])
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    return JSON.stringify([normalizeQuestionText(question.text), optionsSignature]);
}

async function findExistingQuestion(tx, question, categoryId) {
    const normalizedText = normalizeQuestionText(question.text);
    const candidates = await tx.select({
        id: questions.id,
        questionText: questions.questionText,
    }).from(questions).where(sql`
        ${questions.categoryId} = ${categoryId}
        AND lower(regexp_replace(btrim(${questions.questionText}), '\\s+', ' ', 'g')) = ${normalizedText}
    `);
    if (candidates.length === 0) return null;

    const candidateOptions = await tx.select().from(options)
        .where(inArray(options.questionId, candidates.map(candidate => candidate.id)))
        .orderBy(asc(options.order));
    const optionsByQuestion = new Map();
    for (const option of candidateOptions) {
        const questionOptions = optionsByQuestion.get(option.questionId) || [];
        questionOptions.push({ text: option.optionText, isCorrect: option.isCorrect });
        optionsByQuestion.set(option.questionId, questionOptions);
    }

    const signature = getQuestionSignature(question);
    return candidates.find(candidate => getQuestionSignature({
        text: candidate.questionText,
        options: optionsByQuestion.get(candidate.id) || [],
    }) === signature) || null;
}

export const approveImport = async (req, res) => {
    try {
        const { token } = req.params;
        const rec = imports.get(token);
        if (!rec) {
            return res.status(404).json({ success: false, message: 'A feltöltési munkamenet lejárt vagy nem található.' });
        }

        const body = req.body || {};
        const title = (body.title && body.title.trim()) || rec.title || 'Importált teszt';
        const description = body.description ? body.description.trim() : (rec.description || null);
        const timeLimitMinutes = body.timeLimitMinutes ? Number(body.timeLimitMinutes) : null;
        const categoryId = Number(body.categoryId);
        const testType = body.testType === undefined ? 'PRACTICE' : body.testType;
        const allowBreak = body.allowBreak === undefined ? false : body.allowBreak;

        if (timeLimitMinutes !== null && (!Number.isInteger(timeLimitMinutes) || timeLimitMinutes < 1)) {
            return res.status(400).json({ success: false, message: 'Az időkorlát legalább 1 perc legyen.' });
        }
        if (!Number.isInteger(categoryId) || categoryId < 1) {
            return res.status(400).json({ success: false, message: 'Válassz vizsgatárgyat.' });
        }
        const category = await db.select({ id: categories.id }).from(categories)
            .where(eq(categories.id, categoryId)).limit(1);
        if (category.length === 0) {
            return res.status(400).json({ success: false, message: 'A kiválasztott vizsgatárgy nem létezik.' });
        }
        if (!['PRACTICE', 'EXAM'].includes(testType)) {
            return res.status(400).json({ success: false, message: 'Érvénytelen teszttípus.' });
        }
        if (typeof allowBreak !== 'boolean') {
            return res.status(400).json({ success: false, message: 'Érvénytelen szünetbeállítás.' });
        }

        const rawQuestions = Array.isArray(body.questions) ? body.questions : rec.questions;
        const valid = rawQuestions
            .filter(q => q && typeof q.text === 'string' && q.text.trim()
                && Array.isArray(q.options) && q.options.filter(o => o && typeof o.text === 'string' && o.text.trim()).length >= 2)
            .map(q => ({
                text: q.text.trim(),
                options: q.options.filter(o => o && typeof o.text === 'string' && o.text.trim())
                    .map(o => ({ text: o.text.trim(), isCorrect: o.isCorrect === true })),
                topicIds: Array.isArray(q.topicIds) ? [...new Set(q.topicIds.map(Number))] : [],
            }));

        if (valid.length === 0) {
            return res.status(400).json({ success: false, message: 'Nincs legalább 1 érvényes kérdés (min. 2 opcióval) a mentéshez.' });
        }
        for (const question of valid) {
            if (question.topicIds.some(topicId => !Number.isInteger(topicId) || topicId < 1)) {
                return res.status(400).json({ success: false, message: 'Érvénytelen témakör az egyik kérdésnél.' });
            }
            if (question.topicIds.length > 0) {
                const foundTopics = await db.select({ id: topics.id }).from(topics).where(and(
                    inArray(topics.id, question.topicIds),
                    eq(topics.categoryId, categoryId),
                ));
                if (foundTopics.length !== question.topicIds.length) {
                    return res.status(400).json({ success: false, message: 'Minden témakörnek a kiválasztott vizsgatárgyhoz kell tartoznia.' });
                }
            }
        }
        const uniqueQuestions = [...new Map(valid.map(question => [getQuestionSignature(question), question])).values()];
        let reusedQuestionCount = 0;

        const testId = await db.transaction(async (tx) => {
            const t = await tx.insert(tests).values({
                title,
                description,
                timeLimitMinutes,
                testType,
                allowTabSwitch: testType !== 'EXAM',
                allowBreak,
                teacherId: rec.teacherId,
            }).returning();
            const tid = t[0].id;

            let order = 0;
            for (const q of uniqueQuestions) {
                let existingQuestion = await findExistingQuestion(tx, q, categoryId);
                let qid;
                if (existingQuestion) {
                    qid = existingQuestion.id;
                    reusedQuestionCount++;
                } else {
                    const correctCount = q.options.filter(o => o.isCorrect).length;
                    const qRow = await tx.insert(questions).values({
                        categoryId,
                        questionText: q.text,
                        imageUrl: null,
                        explanation: null,
                        answerType: correctCount > 1 ? 'MULTIPLE' : 'SINGLE',
                        difficulty: 1,
                        answerCount: correctCount > 0 ? correctCount : 1,
                    }).returning();
                    qid = qRow[0].id;
                    await tx.insert(options).values(q.options.map((option, index) => ({
                        questionId: qid,
                        optionText: option.text,
                        isCorrect: option.isCorrect,
                        order: index,
                    })));
                }
                if (q.topicIds.length > 0) {
                    const linkedTopics = await tx.select({ topicId: questionTopics.topicId })
                        .from(questionTopics).where(eq(questionTopics.questionId, qid));
                    const linkedTopicIds = new Set(linkedTopics.map(link => link.topicId));
                    const topicsToLink = q.topicIds.filter(topicId => !linkedTopicIds.has(topicId));
                    if (topicsToLink.length > 0) {
                        await tx.insert(questionTopics).values(topicsToLink.map(topicId => ({
                            questionId: qid,
                            topicId,
                        })));
                    }
                }

                await tx.insert(testQuestions).values({
                    testId: tid,
                    questionId: qid,
                    order,
                    points: 1,
                });
                order++;
            }

            return tid;
        });

        imports.delete(token);

        return res.status(201).json({
            success: true,
            message: `Teszt sikeresen elmentve! ${reusedQuestionCount} meglévő kérdést újrahasználtunk.`,
            testId,
            reusedQuestionCount,
            duplicateQuestionCount: valid.length - uniqueQuestions.length,
        });
    } catch (error) {
        console.error('Mentési hiba:', error);
        return res.status(500).json({ success: false, message: 'A teszt mentése közben hiba történt.' });
    }
};