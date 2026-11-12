import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db_drizzle/index.js';
import { questions } from '../db_drizzle/questions.js';
import { tests, testQuestions, testReports, testAssignments } from '../db_drizzle/tests.js';
import { users, groupMembers } from '../db_drizzle/users.js';

export const createTestReport = async (req, res) => {
    try {
        if (req.user.role !== 'STUDENT') {
            return res.status(403).json({ success: false, message: 'Hibajelzést csak diák küldhet.' });
        }

        const testId = Number(req.params.id);
        const { message, questionId: rawQuestionId } = req.body || {};
        const normalizedMessage = typeof message === 'string' ? message.trim() : '';
        if (!Number.isInteger(testId) || testId < 1) {
            return res.status(400).json({ success: false, message: 'Érvénytelen tesztazonosító.' });
        }
        if (normalizedMessage.length < 5 || normalizedMessage.length > 2000) {
            return res.status(400).json({ success: false, message: 'A hibaleírás 5 és 2000 karakter közötti legyen.' });
        }

        const foundTest = await db.select({
            id: tests.id,
            teacherId: tests.teacherId,
            studentOwnerId: tests.studentOwnerId,
        }).from(tests)
            .where(eq(tests.id, testId)).limit(1);
        if (foundTest.length === 0) {
            return res.status(404).json({ success: false, message: 'Teszt nem található.' });
        }
        if (foundTest[0].studentOwnerId !== null
            && foundTest[0].studentOwnerId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Ehhez a teszthez nincs hozzáférésed.' });
        }
        if (foundTest[0].studentOwnerId === req.user.id) {
            return res.status(400).json({ success: false, message: 'Saját gyakorló teszthez nem lehet hibajelzést küldeni.' });
        }
        if (foundTest[0].teacherId !== null) {
            const assignment = await db.select({ testId: testAssignments.testId })
                .from(testAssignments)
                .innerJoin(groupMembers, eq(testAssignments.groupId, groupMembers.groupId))
                .where(and(
                    eq(testAssignments.testId, testId),
                    eq(groupMembers.studentId, req.user.id),
                )).limit(1);
            if (assignment.length === 0) {
                return res.status(403).json({ success: false, message: 'Ehhez a teszthez nincs hozzáférésed.' });
            }
        }

        let questionId = null;
        if (rawQuestionId !== undefined && rawQuestionId !== null && rawQuestionId !== '') {
            questionId = Number(rawQuestionId);
            if (!Number.isInteger(questionId) || questionId < 1) {
                return res.status(400).json({ success: false, message: 'Érvénytelen kérdésazonosító.' });
            }
            const linkedQuestion = await db.select({ id: testQuestions.questionId })
                .from(testQuestions)
                .where(and(
                    eq(testQuestions.testId, testId),
                    eq(testQuestions.questionId, questionId),
                )).limit(1);
            if (linkedQuestion.length === 0) {
                return res.status(400).json({ success: false, message: 'A kérdés nem tartozik ehhez a teszthez.' });
            }
        }

        const report = await db.insert(testReports).values({
            testId,
            questionId,
            reporterId: req.user.id,
            message: normalizedMessage,
        }).returning();

        return res.status(201).json({
            success: true,
            message: 'Hibajelzés elküldve a teszt tanárának.',
            report: report[0],
        });
    } catch (error) {
        console.error('Hibajelzés küldési hiba:', error);
        return res.status(500).json({ success: false, message: 'A hibajelzés küldése nem sikerült.' });
    }
};

export const getOpenTestReports = async (req, res) => {
    try {
        const conditions = [eq(testReports.status, 'OPEN')];
        if (req.user.role !== 'ADMIN') {
            conditions.push(eq(tests.teacherId, req.user.id));
        }

        const reports = await db.select({
            id: testReports.id,
            testId: testReports.testId,
            questionId: testReports.questionId,
            message: testReports.message,
            createdAt: testReports.createdAt,
            testTitle: tests.title,
            questionText: questions.questionText,
            reporterName: users.name,
        }).from(testReports)
            .innerJoin(tests, eq(testReports.testId, tests.id))
            .leftJoin(questions, eq(testReports.questionId, questions.id))
            .leftJoin(users, eq(testReports.reporterId, users.id))
            .where(and(...conditions))
            .orderBy(desc(testReports.createdAt));

        return res.status(200).json({ success: true, reports });
    } catch (error) {
        console.error('Hibajelzés lista hiba:', error);
        return res.status(500).json({ success: false, message: 'A hibajelzések betöltése nem sikerült.' });
    }
};

export const resolveTestReport = async (req, res) => {
    try {
        const reportId = Number(req.params.reportId);
        if (!Number.isInteger(reportId) || reportId < 1) {
            return res.status(400).json({ success: false, message: 'Érvénytelen hibajelzés-azonosító.' });
        }

        const report = await db.select({
            id: testReports.id,
            testId: testReports.testId,
            status: testReports.status,
            teacherId: tests.teacherId,
        }).from(testReports)
            .innerJoin(tests, eq(testReports.testId, tests.id))
            .where(eq(testReports.id, reportId))
            .limit(1);
        if (report.length === 0) {
            return res.status(404).json({ success: false, message: 'Hibajelzés nem található.' });
        }
        if (req.user.role !== 'ADMIN' && report[0].teacherId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Ezt a hibajelzést nem kezelheted.' });
        }
        if (report[0].status !== 'OPEN') {
            return res.status(400).json({ success: false, message: 'A hibajelzés már le van zárva.' });
        }

        const updated = await db.update(testReports).set({
            status: 'RESOLVED',
            resolvedAt: new Date(),
        }).where(eq(testReports.id, reportId)).returning();
        return res.status(200).json({ success: true, report: updated[0] });
    } catch (error) {
        console.error('Hibajelzés lezárási hiba:', error);
        return res.status(500).json({ success: false, message: 'A hibajelzés lezárása nem sikerült.' });
    }
};
