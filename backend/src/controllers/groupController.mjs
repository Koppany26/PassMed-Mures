import crypto from 'crypto';
import { and, desc, eq, gte, inArray } from 'drizzle-orm';
import { db } from '../db_drizzle/index.js';
import { groups, groupMembers, invitations, users } from '../db_drizzle/users.js';
import {
    attempts,
    studentAnswers,
    studentAnswerOptions,
    testAssignments,
    tests,
} from '../db_drizzle/tests.js';
import { questions, options } from '../db_drizzle/questions.js';

async function findOwnedGroup(groupId, teacherId) {
    const result = await db.select().from(groups).where(and(
        eq(groups.id, groupId),
        eq(groups.teacherId, teacherId),
    )).limit(1);
    return result[0] || null;
}

async function getUserEmail(userId) {
    const result = await db.select({ email: users.email }).from(users)
        .where(eq(users.id, userId)).limit(1);
    return result[0]?.email.toLowerCase();
}

export const getMyGroups = async (req, res) => {
    try {
        let result;
        if (req.user.role === 'TEACHER' || req.user.role === 'ADMIN') {
            let query = db.select().from(groups);
            if (req.user.role !== 'ADMIN') query = query.where(eq(groups.teacherId, req.user.id));
            result = await query;
        } else {
            result = await db.select({
                id: groups.id,
                name: groups.name,
                teacherId: groups.teacherId,
                joinCode: groups.joinCode,
                createdAt: groups.createdAt,
            }).from(groupMembers)
                .innerJoin(groups, eq(groupMembers.groupId, groups.id))
                .where(eq(groupMembers.studentId, req.user.id));
        }
        return res.status(200).json({ success: true, groups: result });
    } catch (error) {
        console.error('Csoportlista hiba:', error);
        return res.status(500).json({ success: false, message: 'A csoportok betöltése nem sikerült.' });
    }
};

export const createGroup = async (req, res) => {
    try {
        const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
        if (name.length < 2 || name.length > 100) {
            return res.status(400).json({ success: false, message: 'A csoport neve 2 és 100 karakter közötti legyen.' });
        }
        const created = await db.insert(groups).values({
            name,
            teacherId: req.user.id,
            joinCode: crypto.randomBytes(6).toString('hex').toUpperCase(),
        }).returning();
        return res.status(201).json({ success: true, group: created[0] });
    } catch (error) {
        console.error('Csoport létrehozási hiba:', error);
        return res.status(500).json({ success: false, message: 'A csoport létrehozása nem sikerült.' });
    }
};

export const deleteGroup = async (req, res) => {
    try {
        const groupId = Number(req.params.groupId);
        if (!Number.isInteger(groupId) || groupId < 1) {
            return res.status(400).json({ success: false, message: 'Érvénytelen csoportazonosító.' });
        }

        const group = req.user.role === 'ADMIN'
            ? (await db.select({ id: groups.id }).from(groups)
                .where(eq(groups.id, groupId)).limit(1))[0]
            : await findOwnedGroup(groupId, req.user.id);
        if (!group) {
            return res.status(404).json({ success: false, message: 'A csoport nem található.' });
        }

        await db.delete(groups).where(eq(groups.id, groupId));
        return res.status(200).json({ success: true, message: 'A csoport törölve.' });
    } catch (error) {
        console.error('Csoporttörlési hiba:', error);
        return res.status(500).json({ success: false, message: 'A csoport törlése nem sikerült.' });
    }
};

export const inviteToGroup = async (req, res) => {
    try {
        const groupId = Number(req.params.groupId);
        const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
        if (!Number.isInteger(groupId) || groupId < 1 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ success: false, message: 'Adj meg érvényes diák e-mail-címet.' });
        }
        const group = await findOwnedGroup(groupId, req.user.id);
        if (!group && req.user.role !== 'ADMIN') {
            return res.status(404).json({ success: false, message: 'A csoport nem található.' });
        }

        const existing = await db.select().from(invitations).where(and(
            eq(invitations.groupId, groupId),
            eq(invitations.email, email),
        )).limit(1);
        if (existing.length > 0) {
            if (existing[0].status === 'PENDING') {
                return res.status(200).json({ success: true, message: 'Ehhez a csoporthoz már van függő meghívó erre az e-mail-címre.' });
            }
            return res.status(409).json({ success: false, message: 'Ezzel az e-mail-címmel már van meghívási előzmény.' });
        }

        await db.insert(invitations).values({ groupId, email });
        return res.status(201).json({ success: true, message: 'Csoportmeghívó létrehozva.' });
    } catch (error) {
        console.error('Csoportmeghívó létrehozási hiba:', error);
        return res.status(500).json({ success: false, message: 'A meghívó létrehozása nem sikerült.' });
    }
};

export const getMyInvitations = async (req, res) => {
    try {
        const email = await getUserEmail(req.user.id);
        if (!email) return res.status(404).json({ success: false, message: 'Felhasználó nem található.' });
        const result = await db.select({
            id: invitations.id,
            groupId: groups.id,
            groupName: groups.name,
            teacherId: groups.teacherId,
            createdAt: invitations.createdAt,
        }).from(invitations)
            .innerJoin(groups, eq(invitations.groupId, groups.id))
            .where(and(
                eq(invitations.email, email),
                eq(invitations.status, 'PENDING'),
            )).orderBy(desc(invitations.createdAt));
        return res.status(200).json({ success: true, invitations: result });
    } catch (error) {
        console.error('Meghívólista hiba:', error);
        return res.status(500).json({ success: false, message: 'A meghívók betöltése nem sikerült.' });
    }
};

export const acceptGroupInvitation = async (req, res) => {
    try {
        const invitationId = Number(req.params.invitationId);
        const email = await getUserEmail(req.user.id);
        if (!Number.isInteger(invitationId) || invitationId < 1) {
            return res.status(400).json({ success: false, message: 'Érvénytelen meghívóazonosító.' });
        }
        if (!email) return res.status(404).json({ success: false, message: 'Felhasználó nem található.' });
        const invite = await db.select().from(invitations).where(and(
            eq(invitations.id, invitationId),
            eq(invitations.email, email),
            eq(invitations.status, 'PENDING'),
        )).limit(1);
        if (invite.length === 0) {
            return res.status(404).json({ success: false, message: 'Függő meghívó nem található.' });
        }

        await db.transaction(async (tx) => {
            const existing = await tx.select().from(groupMembers).where(and(
                eq(groupMembers.groupId, invite[0].groupId),
                eq(groupMembers.studentId, req.user.id),
            )).limit(1);
            if (existing.length === 0) {
                await tx.insert(groupMembers).values({
                    groupId: invite[0].groupId,
                    studentId: req.user.id,
                });
            }
            await tx.update(invitations).set({
                status: 'ACCEPTED',
                acceptedAt: new Date(),
            }).where(eq(invitations.id, invitationId));
        });
        return res.status(200).json({ success: true, message: 'Csatlakoztál a csoporthoz.' });
    } catch (error) {
        console.error('Meghívó elfogadási hiba:', error);
        return res.status(500).json({ success: false, message: 'A meghívó elfogadása nem sikerült.' });
    }
};

export const joinGroupByCode = async (req, res) => {
    try {
        const joinCode = typeof req.body?.joinCode === 'string'
            ? req.body.joinCode.trim().toUpperCase()
            : '';
        if (!/^[A-F0-9]{12}$/.test(joinCode)) {
            return res.status(400).json({ success: false, message: 'Adj meg egy érvényes csoportkódot.' });
        }

        const email = await getUserEmail(req.user.id);
        if (!email) return res.status(404).json({ success: false, message: 'Felhasználó nem található.' });
        const groupResult = await db.select({ id: groups.id }).from(groups)
            .where(eq(groups.joinCode, joinCode)).limit(1);
        if (groupResult.length === 0) {
            return res.status(404).json({ success: false, message: 'Nem található csoport ezzel a kóddal.' });
        }

        await db.transaction(async (tx) => {
            await tx.insert(groupMembers).values({
                groupId: groupResult[0].id,
                studentId: req.user.id,
            }).onConflictDoNothing();
            await tx.update(invitations).set({
                status: 'ACCEPTED',
                acceptedAt: new Date(),
            }).where(and(
                eq(invitations.groupId, groupResult[0].id),
                eq(invitations.email, email),
                eq(invitations.status, 'PENDING'),
            ));
        });
        return res.status(200).json({ success: true, message: 'Sikeresen csatlakoztál a csoporthoz.' });
    } catch (error) {
        console.error('Csoportkódos csatlakozási hiba:', error);
        return res.status(500).json({ success: false, message: 'A csoporthoz csatlakozás nem sikerült.' });
    }
};

export const assignTestToGroup = async (req, res) => {
    try {
        const groupId = Number(req.params.groupId);
        const testId = Number(req.body?.testId);
        if (!Number.isInteger(groupId) || groupId < 1 || !Number.isInteger(testId) || testId < 1) {
            return res.status(400).json({ success: false, message: 'Érvénytelen csoport- vagy tesztazonosító.' });
        }
        const group = await findOwnedGroup(groupId, req.user.id);
        if (!group && req.user.role !== 'ADMIN') {
            return res.status(404).json({ success: false, message: 'A csoport nem található.' });
        }
        const test = await db.select().from(tests).where(eq(tests.id, testId)).limit(1);
        if (test.length === 0) return res.status(404).json({ success: false, message: 'Teszt nem található.' });
        if (req.user.role !== 'ADMIN' && test[0].teacherId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Csak saját tesztet oszthatsz meg.' });
        }
        const existing = await db.select().from(testAssignments).where(and(
            eq(testAssignments.groupId, groupId),
            eq(testAssignments.testId, testId),
        )).limit(1);
        if (existing.length === 0) {
            await db.insert(testAssignments).values({ groupId, testId });
        }
        return res.status(200).json({ success: true, message: 'A teszt elérhető a csoport számára.' });
    } catch (error) {
        console.error('Teszt csoporthoz rendelési hiba:', error);
        return res.status(500).json({ success: false, message: 'A teszt megosztása nem sikerült.' });
    }
};

export const getGroupAttempts = async (req, res) => {
    try {
        const groupId = Number(req.params.groupId);
        if (!Number.isInteger(groupId) || groupId < 1) {
            return res.status(400).json({ success: false, message: 'Érvénytelen csoportazonosító.' });
        }
        const group = req.user.role === 'ADMIN'
            ? (await db.select().from(groups).where(eq(groups.id, groupId)).limit(1))[0]
            : await findOwnedGroup(groupId, req.user.id);
        if (!group) return res.status(404).json({ success: false, message: 'A csoport nem található.' });

        const members = await db.select({ studentId: groupMembers.studentId }).from(groupMembers)
            .where(eq(groupMembers.groupId, groupId));
        const assignments = await db.select({ testId: testAssignments.testId }).from(testAssignments)
            .where(eq(testAssignments.groupId, groupId));
        const studentIds = members.map(member => member.studentId);
        const testIds = assignments.map(assignment => assignment.testId);
        if (studentIds.length === 0 || testIds.length === 0) {
            return res.status(200).json({ success: true, attempts: [] });
        }

        const result = await db.select({
            id: attempts.id,
            studentId: attempts.studentId,
            testId: attempts.testId,
            startedAt: attempts.startedAt,
            completedAt: attempts.completedAt,
            totalScore: attempts.totalScore,
            status: attempts.status,
            studentName: users.name,
            testTitle: tests.title,
        }).from(attempts)
            .innerJoin(users, eq(attempts.studentId, users.id))
            .innerJoin(tests, eq(attempts.testId, tests.id))
            .innerJoin(testAssignments, and(
                eq(testAssignments.testId, attempts.testId),
                eq(testAssignments.groupId, groupId),
            ))
            .innerJoin(groupMembers, and(
                eq(groupMembers.groupId, groupId),
                eq(groupMembers.studentId, attempts.studentId),
            ))
            .where(and(
                inArray(attempts.studentId, studentIds),
                inArray(attempts.testId, testIds),
                eq(attempts.isPrivate, false),
                gte(attempts.startedAt, testAssignments.createdAt),
                gte(attempts.startedAt, groupMembers.joinedAt),
            )).orderBy(desc(attempts.startedAt));
        const detailed = [];
        for (const attempt of result) {
            const answers = await db.select().from(studentAnswers)
                .where(eq(studentAnswers.attemptId, attempt.id));
            const answerDetails = [];
            for (const answer of answers) {
                const question = await db.select({
                    id: questions.id,
                    questionText: questions.questionText,
                }).from(questions).where(eq(questions.id, answer.questionId)).limit(1);
                if (question.length === 0) continue;
                const selected = await db.select({
                    optionId: studentAnswerOptions.optionId,
                    optionText: options.optionText,
                }).from(studentAnswerOptions)
                    .innerJoin(options, eq(studentAnswerOptions.optionId, options.id))
                    .where(eq(studentAnswerOptions.studentAnswerId, answer.id));
                const correct = await db.select({
                    optionId: options.id,
                    optionText: options.optionText,
                }).from(options).where(and(
                    eq(options.questionId, answer.questionId),
                    eq(options.isCorrect, true),
                ));
                answerDetails.push({
                    questionId: question[0].id,
                    questionText: question[0].questionText,
                    selectedOptions: selected,
                    correctOptions: correct,
                });
            }
            detailed.push({ ...attempt, answers: answerDetails });
        }
        return res.status(200).json({ success: true, attempts: detailed });
    } catch (error) {
        console.error('Csoportkitöltések lista hiba:', error);
        return res.status(500).json({ success: false, message: 'A csoport eredményeinek betöltése nem sikerült.' });
    }
};
