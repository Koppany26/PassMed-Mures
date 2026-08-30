import { 
  pgTable, 
  serial, 
  text, 
  integer, 
  timestamp, 
  boolean, 
  pgEnum, 
  primaryKey, 
  unique,
  foreignKey // <-- EZT AZ ÚJ IMPORTOT HASZNÁLJUK!
} from 'drizzle-orm/pg-core';

import { relations } from 'drizzle-orm';

import { users,groups } from './users';
import { questions,categories, options } from './questions';
import { tests,testQuestions, attempts,studentAnswers,studentAnswerOptions, } from './tests';


// ==========================
// RELÁCIÓK
// ==========================

export const usersRelations = relations(users, ({ one, many }) => ({
  csoport: one(groups, {
    fields: [users.csoportId],
    references: [groups.id],
    relationName: 'CsoportTagok',
  }),
  sajatCsoportok: many(groups, { relationName: 'TanarCsoportjai' }),
  attempts: many(attempts),
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
  tanar: one(users, {
    fields: [groups.tanarId],
    references: [users.id],
    relationName: 'TanarCsoportjai',
  }),
  tagok: many(users, { relationName: 'CsoportTagok' }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  questions: many(questions),
}));

export const questionsRelations = relations(questions, ({ one, many }) => ({
  kategoria: one(categories, {
    fields: [questions.kategoriaId],
    references: [categories.id],
  }),
  options: many(options),
  testQuestions: many(testQuestions),
  studentAnswers: many(studentAnswers),
}));

export const optionsRelations = relations(options, ({ one, many }) => ({
  kerdes: one(questions, {
    fields: [options.kerdesId],
    references: [questions.id],
  }),
  studentAnswerOptions: many(studentAnswerOptions),
}));

export const testsRelations = relations(tests, ({ many }) => ({
  testQuestions: many(testQuestions),
  attempts: many(attempts),
}));

export const testQuestionsRelations = relations(testQuestions, ({ one }) => ({
  teszt: one(tests, {
    fields: [testQuestions.tesztId],
    references: [tests.id],
  }),
  kerdes: one(questions, {
    fields: [testQuestions.kerdesId],
    references: [questions.id],
  }),
}));

export const attemptsRelations = relations(attempts, ({ one, many }) => ({
  diak: one(users, {
    fields: [attempts.diakId],
    references: [users.id],
  }),
  teszt: one(tests, {
    fields: [attempts.tesztId],
    references: [tests.id],
  }),
  studentAnswers: many(studentAnswers),
}));

export const studentAnswersRelations = relations(studentAnswers, ({ one, many }) => ({
  kitoltes: one(attempts, {
    fields: [studentAnswers.kitoltesId],
    references: [attempts.id],
  }),
  kerdes: one(questions, {
    fields: [studentAnswers.kerdesId],
    references: [questions.id],
  }),
  valasztottOpciok: many(studentAnswerOptions),
}));

export const studentAnswerOptionsRelations = relations(studentAnswerOptions, ({ one }) => ({
  diakValasz: one(studentAnswers, {
    fields: [studentAnswerOptions.diakValaszId],
    references: [studentAnswers.id],
  }),
  opcio: one(options, {
    fields: [studentAnswerOptions.opcioId],
    references: [options.id],
  }),
}));