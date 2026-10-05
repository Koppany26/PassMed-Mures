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
import { users } from './users';
import { questions } from './questions';

// ==========================
// 5. FLASHCARDS
//    Spaced-repetition learning cards built on top of questions.
//    Each card is private to a single student.
// ==========================

export const flashcards = pgTable('flashcards', {
  id: serial('id').primaryKey(),
  questionId: integer('question_id').notNull(),
  studentId: integer('student_id').notNull(),
  difficulty: integer('difficulty').default(1).notNull(),
  lastReviewedAt: timestamp('last_reviewed_at'),
  nextReviewAt: timestamp('next_review_at'),
  reviewCount: integer('review_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  questionFk: foreignKey({
    columns: [table.questionId],
    foreignColumns: [questions.id],
  }).onDelete('cascade'),
  studentFk: foreignKey({
    columns: [table.studentId],
    foreignColumns: [users.id],
  }).onDelete('cascade'),
  unq: unique('flashcards_question_student_unq').on(table.questionId, table.studentId),
  // NEW: enforce at the DB level, not just by convention
  difficultyRange: check('flashcards_difficulty_range', sql`${table.difficulty} BETWEEN 1 AND 5`),
}));