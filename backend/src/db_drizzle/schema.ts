import { relations } from 'drizzle-orm';

import { users, groups, invitations, groupMembers, teacherInvitations } from './users';
import { questions, categories, options, topics, questionTopics } from './questions';
import {
  tests,
  testQuestions,
  testAssignments,
  courseMaterials,
  attempts,
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
  ownedGroups: many(groups, { relationName: 'TeacherGroups' }),
  groupMemberships: many(groupMembers),
  ownedTests: many(tests),
  attempts: many(attempts),
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
  questionTopics: many(questionTopics),
}));

export const questionsRelations = relations(questions, ({ one, many }) => ({
  category: one(categories, {
    fields: [questions.categoryId],
    references: [categories.id],
  }),
  options: many(options),
  testQuestions: many(testQuestions),
  studentAnswers: many(studentAnswers),
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
}));

export const testsRelations = relations(tests, ({ one, many }) => ({
  teacher: one(users, {
    fields: [tests.teacherId],
    references: [users.id],
  }),
  testQuestions: many(testQuestions),
  testAssignments: many(testAssignments),
  attempts: many(attempts),
  courseMaterials: many(courseMaterials),
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