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
  foreignKey,
  check
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ==========================
// 2. QUESTION BANK
//    (English field names)
// ==========================

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
});

export const answerTypeEnum = pgEnum('answer_type', ['SINGLE', 'MULTIPLE']);

export const questions = pgTable('questions', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id').notNull(),
  questionText: text('question_text').notNull(),
  imageUrl: text('image_url'),
  explanation: text('explanation'),
  answerType: answerTypeEnum('answer_type').default('SINGLE').notNull(),
  difficulty: integer('difficulty').default(1).notNull(),
  answerCount: integer('answer_count').default(1).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  categoryFk: foreignKey({
    columns: [table.categoryId],
    foreignColumns: [categories.id],
  }),
  // NEW: enforce at the DB level, not just by convention
  answerCountPositive: check('questions_answer_count_positive', sql`${table.answerCount} > 0`),
  difficultyRange: check('questions_difficulty_range', sql`${table.difficulty} BETWEEN 1 AND 5`),
}));

export const options = pgTable('options', {
  id: serial('id').primaryKey(),
  questionId: integer('question_id').notNull(),
  optionText: text('option_text').notNull(),
  isCorrect: boolean('is_correct').default(false).notNull(),
  order: integer('order').default(0).notNull(),
}, (table) => ({
  questionFk: foreignKey({
    columns: [table.questionId],
    foreignColumns: [questions.id],
  }).onDelete('cascade'),
}));

// ==========================
// TOPICS (separate concept from categories) + question<->topic (many-to-many)
// ==========================

export const topics = pgTable('topics', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  categoryId: integer('category_id'),
}, (table) => ({
  categoryFk: foreignKey({
    columns: [table.categoryId],
    foreignColumns: [categories.id],
  }).onDelete('set null'),
}));

export const questionTopics = pgTable('question_topics', {
  questionId: integer('question_id').notNull(),
  topicId: integer('topic_id').notNull(),
}, (table) => ({
  questionFk: foreignKey({
    columns: [table.questionId],
    foreignColumns: [questions.id],
  }).onDelete('cascade'),
  topicFk: foreignKey({
    columns: [table.topicId],
    foreignColumns: [topics.id],
  }).onDelete('cascade'),
  pk: primaryKey({ name: 'question_topics_pk', columns: [table.questionId, table.topicId] }),
}));