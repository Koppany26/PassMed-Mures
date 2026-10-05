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
import { users, groups } from './users';
import { questions, options } from './questions';

export const attemptStatusEnum = pgEnum('attempt_status', ['IN_PROGRESS', 'COMPLETED', 'ABANDONED']);
export const testTypeEnum = pgEnum('test_type', ['PRACTICE', 'EXAM']);

// ==========================
// 3. TESTS
// ==========================

export const tests = pgTable('tests', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  timeLimitMinutes: integer('time_limit_minutes'),
  testType: testTypeEnum('test_type').default('PRACTICE').notNull(),
  // NEW: explicit flag instead of hardcoding "EXAM = no tab switching" —
  // lets a teacher lock navigation on a PRACTICE test too, or the reverse.
  allowTabSwitch: boolean('allow_tab_switch').default(true).notNull(),
  teacherId: integer('teacher_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  teacherFk: foreignKey({
    columns: [table.teacherId],
    foreignColumns: [users.id],
  }).onDelete('set null'),
}));

export const testQuestions = pgTable('test_questions', {
  testId: integer('test_id').notNull(),
  questionId: integer('question_id').notNull(),
  order: integer('order').default(0).notNull(),
  points: integer('points').default(1).notNull(),
}, (table) => ({
  testFk: foreignKey({
    columns: [table.testId],
    foreignColumns: [tests.id],
  }).onDelete('cascade'),
  questionFk: foreignKey({
    columns: [table.questionId],
    foreignColumns: [questions.id],
  }).onDelete('cascade'),
  pk: primaryKey({ name: 'test_questions_pk', columns: [table.testId, table.questionId] }),
}));

// ==========================
// TEST ASSIGNMENTS (teacher shares a test with a whole group)
// ==========================

export const testAssignments = pgTable('test_assignments', {
  testId: integer('test_id').notNull(),
  groupId: integer('group_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  testFk: foreignKey({
    columns: [table.testId],
    foreignColumns: [tests.id],
  }).onDelete('cascade'),
  groupFk: foreignKey({
    columns: [table.groupId],
    foreignColumns: [groups.id],
  }).onDelete('cascade'),
  pk: primaryKey({ name: 'test_assignments_pk', columns: [table.testId, table.groupId] }),
}));

// ==========================
// COURSE MATERIALS (PPT lecture materials / attachments)
// ==========================

export const materialTypeEnum = pgEnum('material_type', ['PPT', 'PDF', 'IMAGE', 'VIDEO', 'OTHER']);

export const courseMaterials = pgTable('course_materials', {
  id: serial('id').primaryKey(),
  testId: integer('test_id'),
  questionId: integer('question_id'),
  fileType: materialTypeEnum('file_type').notNull(),
  fileUrl: text('file_url').notNull(),
  title: text('title').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  testFk: foreignKey({
    columns: [table.testId],
    foreignColumns: [tests.id],
  }).onDelete('cascade'),
  questionFk: foreignKey({
    columns: [table.questionId],
    foreignColumns: [questions.id],
  }).onDelete('cascade'),
  // NEW: exactly one of testId / questionId must be set, never both, never neither
  exactlyOneTargetCheck: check(
    'course_materials_exactly_one_target',
    sql`(${table.testId} IS NOT NULL AND ${table.questionId} IS NULL) OR (${table.testId} IS NULL AND ${table.questionId} IS NOT NULL)`
  ),
}));

// ==========================
// 4. ATTEMPTS AND RESULTS
// ==========================

export const attempts = pgTable('attempts', {
  id: serial('id').primaryKey(),
  studentId: integer('student_id').notNull(),
  testId: integer('test_id').notNull(),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  submittedAt: timestamp('submitted_at'),
  totalScore: integer('total_score'),
  status: attemptStatusEnum('status').default('IN_PROGRESS').notNull(),
  isPrivate: boolean('is_private').default(false).notNull(),
}, (table) => ({
  studentFk: foreignKey({
    columns: [table.studentId],
    foreignColumns: [users.id],
  }),
  testFk: foreignKey({
    columns: [table.testId],
    foreignColumns: [tests.id],
  }),
}));

export const studentAnswers = pgTable('student_answers', {
  id: serial('id').primaryKey(),
  attemptId: integer('attempt_id').notNull(),
  questionId: integer('question_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  attemptFk: foreignKey({
    columns: [table.attemptId],
    foreignColumns: [attempts.id],
  }).onDelete('cascade'),
  questionFk: foreignKey({
    columns: [table.questionId],
    foreignColumns: [questions.id],
  }),
  unq: unique('student_answers_attempt_question_unq').on(table.attemptId, table.questionId),
}));

export const studentAnswerOptions = pgTable('student_answer_options', {
  id: serial('id').primaryKey(),
  studentAnswerId: integer('student_answer_id').notNull(),
  optionId: integer('option_id').notNull(),
}, (table) => ({
  studentAnswerFk: foreignKey({
    columns: [table.studentAnswerId],
    foreignColumns: [studentAnswers.id],
  }).onDelete('cascade'),
  optionFk: foreignKey({
    columns: [table.optionId],
    foreignColumns: [options.id],
  }),
  unq: unique('student_answer_options_answer_option_unq').on(table.studentAnswerId, table.optionId),
}));

// ==========================
// PROCTOR EVENTS
//    Cheat-detection log for EXAM attempts: every tab switch, blur,
//    fullscreen-exit, etc. gets a row, timestamped, tied to the attempt.
// ==========================

export const proctorEventTypeEnum = pgEnum('proctor_event_type', [
  'TAB_SWITCH',
  'WINDOW_BLUR',
  'FULLSCREEN_EXIT',
  'COPY_PASTE',
  'OTHER',
]);

export const proctorEvents = pgTable('proctor_events', {
  id: serial('id').primaryKey(),
  attemptId: integer('attempt_id').notNull(),
  eventType: proctorEventTypeEnum('event_type').notNull(),
  occurredAt: timestamp('occurred_at').defaultNow().notNull(),
  metadata: text('metadata'), // optional JSON string, e.g. duration away, tab title
}, (table) => ({
  attemptFk: foreignKey({
    columns: [table.attemptId],
    foreignColumns: [attempts.id],
  }).onDelete('cascade'),
}));