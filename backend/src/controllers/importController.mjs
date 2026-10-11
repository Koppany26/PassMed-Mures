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
import { eq } from 'drizzle-orm';
import { db } from '../db_drizzle/index.js';
import { categories, questions, options } from '../db_drizzle/questions.js';
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

// --- JAVÍTÓKULCS SZÖVEG FELDOLGOZÁSA (szám -> betű) ---
//    Pl.: "1A 2C 3B" / "1. A\n2. C\n3. B" / táblázat
export function parseBaremMap(text) {
    const map = {};
    const re = /(\d{1,3})\s*[.)]?\s*[:\-–]?\s*([A-E])/gi;
    let m;
    while ((m = re.exec(text)) !== null) {
        const num = parseInt(m[1], 10);
        map[num] = m[2].toUpperCase();
    }
    return map;
}

// --- HELYES VÁLASZOK BEÁLLÍTÁSA A JAVÍTÓKULCS ALAPJÁN ---
function applyBarem(questions, map) {
    const letterIndex = { A: 0, B: 1, C: 2, D: 3, E: 4 };
    for (const q of questions) {
        const letter = map[q.num];
        if (!letter) continue;
        const idx = letterIndex[letter];
        if (idx == null) continue;
        q.options = q.options.map((o, oi) => ({ ...o, isCorrect: oi === idx }));
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
async function ensureCategory(tx, name) {
    const existing = await tx.select().from(categories).where(eq(categories.name, name)).limit(1);
    if (existing.length > 0) return existing[0].id;
    const ins = await tx.insert(categories).values({ name }).returning();
    return ins[0].id;
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

        const rawQuestions = Array.isArray(body.questions) ? body.questions : rec.questions;
        const valid = rawQuestions
            .filter(q => q && (q.text || '').trim() && Array.isArray(q.options) && q.options.filter(o => (o.text || '').trim()).length >= 2)
            .map(q => ({
                text: q.text.trim(),
                options: q.options.filter(o => (o.text || '').trim()).map(o => ({ text: o.text.trim(), isCorrect: !!o.isCorrect })),
            }));

        if (valid.length === 0) {
            return res.status(400).json({ success: false, message: 'Nincs legalább 1 érvényes kérdés (min. 2 opcióval) a mentéshez.' });
        }

        const testId = await db.transaction(async (tx) => {
            const categoryId = await ensureCategory(tx, 'Importált tesztek');

            const t = await tx.insert(tests).values({
                title,
                description,
                timeLimitMinutes,
                teacherId: rec.teacherId,
            }).returning();
            const tid = t[0].id;

            let order = 0;
            for (const q of valid) {
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
                const qid = qRow[0].id;

                for (let i = 0; i < q.options.length; i++) {
                    await tx.insert(options).values({
                        questionId: qid,
                        optionText: q.options[i].text,
                        isCorrect: q.options[i].isCorrect,
                        order: i,
                    });
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

        return res.status(201).json({ success: true, message: 'Teszt sikeresen elmentve!', testId });
    } catch (error) {
        console.error('Mentési hiba:', error);
        return res.status(500).json({ success: false, message: 'A teszt mentése közben hiba történt.' });
    }
};