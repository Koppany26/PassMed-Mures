import { relations } from 'drizzle-orm';

import { users, groups, invitations, groupMembers, teacherInvitations } from './users';
import { questions, categories, options, topics, questionTopics, bodyRegions } from './questions';
import {
  tests,
  testQuestions,
  testAssignments,
  courseMaterials,
  attempts,
  paperAnswerSheets,
  paperAnswers,
  paperAnswerOptions,
  testScanImports,
  testScanQuestions,
  testScanOptions,
  testReports,
  studentAnswers,
  studentAnswerOptions,
  proctorEvents,
} from './tests';
import { flashcards } from './flashcards';

// ==========================
// RELATIONS
// ==========================

export const usersRelations = relations(users, ({ one, many }) => ({
  group: one(groups, {
    fields: [users.groupId],
    references: [groups.id],
    relationName: 'GroupMembers',
  }),
  studentOwner: one(users, {
    fields: [tests.studentOwnerId],
    references: [users.id],
    relationName: 'StudentPracticeTests',
  }),
  ownedGroups: many(groups, { relationName: 'TeacherGroups' }),
  groupMemberships: many(groupMembers),
  ownedTests: many(tests),
  studentPracticeTests: many(tests, { relationName: 'StudentPracticeTests' }),
  uploadedMaterials: many(courseMaterials, { relationName: 'MaterialUploader' }),
  attempts: many(attempts),
  testScans: many(testScanImports),
  testReports: many(testReports),
  flashcards: many(flashcards),
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
  teacher: one(users, {
    fields: [groups.teacherId],
    references: [users.id],
    relationName: 'TeacherGroups',
  }),
  members: many(users, { relationName: 'GroupMembers' }),
  memberships: many(groupMembers),
  invitations: many(invitations),
  testAssignments: many(testAssignments),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, {
    fields: [groupMembers.groupId],
    references: [groups.id],
  }),
  student: one(users, {
    fields: [groupMembers.studentId],
    references: [users.id],
  }),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  group: one(groups, {
    fields: [invitations.groupId],
    references: [groups.id],
  }),
}));

export const teacherInvitationsRelations = relations(teacherInvitations, ({ one }) => ({
  invitedByAdmin: one(users, {
    fields: [teacherInvitations.invitedByAdminId],
    references: [users.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  questions: many(questions),
  topics: many(topics),
}));

export const topicsRelations = relations(topics, ({ one, many }) => ({
  category: one(categories, {
    fields: [topics.categoryId],
    references: [categories.id],
  }),
  bodyRegion: one(bodyRegions, {
    fields: [topics.bodyRegionId],
    references: [bodyRegions.id],
  }),
  questionTopics: many(questionTopics),
  courseMaterials: many(courseMaterials),
}));

export const bodyRegionsRelations = relations(bodyRegions, ({ many }) => ({
  topics: many(topics),
}));

export const questionsRelations = relations(questions, ({ one, many }) => ({
  category: one(categories, {
    fields: [questions.categoryId],
    references: [categories.id],
  }),
  options: many(options),
  testQuestions: many(testQuestions),
  studentAnswers: many(studentAnswers),
  testReports: many(testReports),
  paperAnswers: many(paperAnswers),
  questionTopics: many(questionTopics),
  flashcards: many(flashcards),
  courseMaterials: many(courseMaterials),
}));

export const questionTopicsRelations = relations(questionTopics, ({ one }) => ({
  question: one(questions, {
    fields: [questionTopics.questionId],
    references: [questions.id],
  }),
  topic: one(topics, {
    fields: [questionTopics.topicId],
    references: [topics.id],
  }),
}));

export const optionsRelations = relations(options, ({ one, many }) => ({
  question: one(questions, {
    fields: [options.questionId],
    references: [questions.id],
  }),
  studentAnswerOptions: many(studentAnswerOptions),
  paperAnswerOptions: many(paperAnswerOptions),
}));

export const testsRelations = relations(tests, ({ one, many }) => ({
  teacher: one(users, {
    fields: [tests.teacherId],
    references: [users.id],
  }),
  testQuestions: many(testQuestions),
  testAssignments: many(testAssignments),
  attempts: many(attempts),
  testReports: many(testReports),
  courseMaterials: many(courseMaterials),
  scanImports: many(testScanImports),
}));

export const testQuestionsRelations = relations(testQuestions, ({ one }) => ({
  test: one(tests, {
    fields: [testQuestions.testId],
    references: [tests.id],
  }),
  question: one(questions, {
    fields: [testQuestions.questionId],
    references: [questions.id],
  }),
}));

export const testAssignmentsRelations = relations(testAssignments, ({ one }) => ({
  test: one(tests, {
    fields: [testAssignments.testId],
    references: [tests.id],
  }),
  group: one(groups, {
    fields: [testAssignments.groupId],
    references: [groups.id],
  }),
}));

export const courseMaterialsRelations = relations(courseMaterials, ({ one }) => ({
  test: one(tests, {
    fields: [courseMaterials.testId],
    references: [tests.id],
  }),
  question: one(questions, {
    fields: [courseMaterials.questionId],
    references: [questions.id],
  }),
  topic: one(topics, {
    fields: [courseMaterials.topicId],
    references: [topics.id],
  }),
  teacher: one(users, {
    fields: [courseMaterials.teacherId],
    references: [users.id],
    relationName: 'MaterialUploader',
  }),
}));

export const attemptsRelations = relations(attempts, ({ one, many }) => ({
  student: one(users, {
    fields: [attempts.studentId],
    references: [users.id],
  }),
  test: one(tests, {
    fields: [attempts.testId],
    references: [tests.id],
  }),
  studentAnswers: many(studentAnswers),
  proctorEvents: many(proctorEvents),
  paperAnswerSheet: one(paperAnswerSheets),
}));

export const paperAnswerSheetsRelations = relations(paperAnswerSheets, ({ one, many }) => ({
  attempt: one(attempts, {
    fields: [paperAnswerSheets.attemptId],
    references: [attempts.id],
  }),
  answers: many(paperAnswers),
}));

export const paperAnswersRelations = relations(paperAnswers, ({ one, many }) => ({
  sheet: one(paperAnswerSheets, {
    fields: [paperAnswers.sheetId],
    references: [paperAnswerSheets.id],
  }),
  question: one(questions, {
    fields: [paperAnswers.questionId],
    references: [questions.id],
  }),
  selectedOptions: many(paperAnswerOptions),
}));

export const paperAnswerOptionsRelations = relations(paperAnswerOptions, ({ one }) => ({
  paperAnswer: one(paperAnswers, {
    fields: [paperAnswerOptions.paperAnswerId],
    references: [paperAnswers.id],
  }),
  option: one(options, {
    fields: [paperAnswerOptions.optionId],
    references: [options.id],
  }),
}));

export const testScanImportsRelations = relations(testScanImports, ({ one, many }) => ({
  teacher: one(users, {
    fields: [testScanImports.teacherId],
    references: [users.id],
  }),
  test: one(tests, {
    fields: [testScanImports.testId],
    references: [tests.id],
  }),
  questions: many(testScanQuestions),
}));

export const testScanQuestionsRelations = relations(testScanQuestions, ({ one, many }) => ({
  scan: one(testScanImports, {
    fields: [testScanQuestions.scanId],
    references: [testScanImports.id],
  }),
  options: many(testScanOptions),
}));

export const testScanOptionsRelations = relations(testScanOptions, ({ one }) => ({
  question: one(testScanQuestions, {
    fields: [testScanOptions.scanQuestionId],
    references: [testScanQuestions.id],
  }),
}));

export const testReportsRelations = relations(testReports, ({ one }) => ({
  test: one(tests, {
    fields: [testReports.testId],
    references: [tests.id],
  }),
  question: one(questions, {
    fields: [testReports.questionId],
    references: [questions.id],
  }),
  reporter: one(users, {
    fields: [testReports.reporterId],
    references: [users.id],
  }),
}));

export const studentAnswersRelations = relations(studentAnswers, ({ one, many }) => ({
  attempt: one(attempts, {
    fields: [studentAnswers.attemptId],
    references: [attempts.id],
  }),
  question: one(questions, {
    fields: [studentAnswers.questionId],
    references: [questions.id],
  }),
  selectedOptions: many(studentAnswerOptions),
}));

export const studentAnswerOptionsRelations = relations(studentAnswerOptions, ({ one }) => ({
  studentAnswer: one(studentAnswers, {
    fields: [studentAnswerOptions.studentAnswerId],
    references: [studentAnswers.id],
  }),
  option: one(options, {
    fields: [studentAnswerOptions.optionId],
    references: [options.id],
  }),
}));

export const proctorEventsRelations = relations(proctorEvents, ({ one }) => ({
  attempt: one(attempts, {
    fields: [proctorEvents.attemptId],
    references: [attempts.id],
  }),
}));

export const flashcardsRelations = relations(flashcards, ({ one }) => ({
  question: one(questions, {
    fields: [flashcards.questionId],
    references: [questions.id],
  }),
  student: one(users, {
    fields: [flashcards.studentId],
    references: [users.id],
  }),
}));