import fs from 'node:fs/promises';
import path from 'node:path';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db_drizzle/index.js';
import { courseMaterials } from '../db_drizzle/tests.js';
import { topics } from '../db_drizzle/questions.js';
import { users } from '../db_drizzle/users.js';

const materialTypesByExtension = new Map([
    ['.ppt', 'PPT'],
    ['.pptx', 'PPT'],
    ['.pdf', 'PDF'],
]);

async function removeUploadedFile(filePath) {
    if (!filePath) return;
    try {
        await fs.unlink(filePath);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error('Feltöltött tananyag törlési hiba:', error);
        }
    }
}

export const getTopicMaterials = async (req, res) => {
    try {
        const topicId = Number(req.params.topicId);
        if (!Number.isInteger(topicId) || topicId < 1) {
            return res.status(400).json({ success: false, message: 'Érvénytelen témakörazonosító.' });
        }
        const topic = await db.select({ id: topics.id }).from(topics)
            .where(eq(topics.id, topicId)).limit(1);
        if (topic.length === 0) {
            return res.status(404).json({ success: false, message: 'A témakör nem található.' });
        }
        const materials = await db.select({
            id: courseMaterials.id,
            fileType: courseMaterials.fileType,
            fileUrl: courseMaterials.fileUrl,
            title: courseMaterials.title,
            createdAt: courseMaterials.createdAt,
            teacherName: users.name,
        }).from(courseMaterials)
            .leftJoin(users, eq(courseMaterials.teacherId, users.id))
            .where(eq(courseMaterials.topicId, topicId))
            .orderBy(desc(courseMaterials.createdAt));
        return res.status(200).json({ success: true, materials });
    } catch (error) {
        console.error('Témaköri tananyaglista hiba:', error);
        return res.status(500).json({ success: false, message: 'A tananyagok betöltése nem sikerült.' });
    }
};

export const uploadTopicMaterial = async (req, res) => {
    const uploadedPath = req.file?.path;
    try {
        const topicId = Number(req.params.topicId);
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Válassz ki egy PPT- vagy PDF-fájlt.' });
        }
        if (!Number.isInteger(topicId) || topicId < 1) {
            await removeUploadedFile(uploadedPath);
            return res.status(400).json({ success: false, message: 'Érvénytelen témakörazonosító.' });
        }

        const extension = path.extname(req.file.originalname).toLowerCase();
        const fileType = materialTypesByExtension.get(extension);
        if (!fileType) {
            await removeUploadedFile(uploadedPath);
            return res.status(400).json({ success: false, message: 'Csak PPT, PPTX vagy PDF tölthető fel.' });
        }

        const rawTitle = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
        const title = rawTitle || path.basename(req.file.originalname, extension).trim();
        if (!title || title.length > 200) {
            await removeUploadedFile(uploadedPath);
            return res.status(400).json({ success: false, message: 'A tananyag címe legfeljebb 200 karakter lehet.' });
        }

        const topic = await db.select({ id: topics.id }).from(topics)
            .where(eq(topics.id, topicId)).limit(1);
        if (topic.length === 0) {
            await removeUploadedFile(uploadedPath);
            return res.status(404).json({ success: false, message: 'A témakör nem található.' });
        }

        const inserted = await db.insert(courseMaterials).values({
            topicId,
            teacherId: req.user.id,
            fileType,
            fileUrl: `/uploads/${path.basename(req.file.path)}`,
            title,
        }).returning();
        return res.status(201).json({
            success: true,
            message: 'A tananyag feltöltve.',
            material: inserted[0],
        });
    } catch (error) {
        await removeUploadedFile(uploadedPath);
        console.error('Tananyag feltöltési hiba:', error);
        return res.status(500).json({ success: false, message: 'A tananyag feltöltése nem sikerült.' });
    }
};
