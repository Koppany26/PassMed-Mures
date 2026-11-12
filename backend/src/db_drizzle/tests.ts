import { 
  pgTable, 
  serial, 
  text, 
  integer, 
  timestamp, 
  boolean, 
  real,
  pgEnum, 
  primaryKey, 
  unique,
  foreignKey,
  check
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users, groups } from './users';
import { questions, options, topics, answerTypeEnum } from './questions';

export const attemptStatusEnum = pgEnum('attempt_status', ['IN_PROGRESS', 'COMPLETED', 'ABANDONED']);
export const testTypeEnum = pgEnum('test_type', ['PRACTICE', 'EXAM']);
export const attemptModeEnum = pgEnum('attempt_mode', ['ONLINE', 'PAPER']);
export const paperSheetStatusEnum = pgEnum('paper_sheet_status', [
  'GENERATED',
  'SCANNED',
  'REVIEW_REQUIRED',
  'REVIEWED',
  'GRADED',
]);
export const testScanStatusEnum = pgEnum('test_scan_status', [
  'UPLOADED',
  'PROCESSING',
  'REVIEW_REQUIRED',
  'IMPORTED',
  'FAILED',
]);

// ==========================
// 3. TESTS
// ==========================

export const tests = pgTable('tests', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  timeLimitMinutes: integer('time_limit_minutes'),
  testType: testTypeEnum('test_type').default('PRACTICE').notNull(),
  allowBreak: boolean('allow_break').default(false).notNull(),
  allowTabSwitch: boolean('allow_tab_switch').default(true).notNull(),
  teacherId: integer('teacher_id'),
  studentOwnerId: integer('student_owner_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  teacherFk: foreignKey({
    columns: [table.teacherId],
    foreignColumns: [users.id],
  }).onDelete('set null'),
  studentOwnerFk: foreignKey({
    columns: [table.studentOwnerId],
    foreignColumns: [users.id],
  }).onDelete('cascade'),
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
  topicId: integer('topic_id'),
  teacherId: integer('teacher_id'),
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
  topicFk: foreignKey({
    columns: [table.topicId],
    foreignColumns: [topics.id],
  }).onDelete('cascade'),
  teacherFk: foreignKey({
    columns: [table.teacherId],
    foreignColumns: [users.id],
  }).onDelete('set null'),
  exactlyOneTargetCheck: check(
    'course_materials_exactly_one_target',
    sql`(${table.testId} IS NOT NULL AND ${table.questionId} IS NULL AND ${table.topicId} IS NULL) OR (${table.testId} IS NULL AND ${table.questionId} IS NOT NULL AND ${table.topicId} IS NULL) OR (${table.testId} IS NULL AND ${table.questionId} IS NULL AND ${table.topicId} IS NOT NULL)`
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
  mode: attemptModeEnum('mode').default('ONLINE').notNull(),
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

export const paperAnswerSheets = pgTable('paper_answer_sheets', {
  id: serial('id').primaryKey(),
  attemptId: integer('attempt_id').notNull().unique(),
  sheetCode: text('sheet_code').notNull().unique(),
  templateVersion: integer('template_version').default(1).notNull(),
  scanFileUrl: text('scan_file_url'),
  status: paperSheetStatusEnum('status').default('GENERATED').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  scannedAt: timestamp('scanned_at'),
  reviewedAt: timestamp('reviewed_at'),
}, (table) => ({
  attemptFk: foreignKey({
    columns: [table.attemptId],
    foreignColumns: [attempts.id],
  }).onDelete('cascade'),
}));

export const paperAnswers = pgTable('paper_answers', {
  id: serial('id').primaryKey(),
  sheetId: integer('sheet_id').notNull(),
  questionId: integer('question_id').notNull(),
  confidence: real('confidence'),
  needsReview: boolean('needs_review').default(true).notNull(),
  reviewedAt: timestamp('reviewed_at'),
}, (table) => ({
  sheetFk: foreignKey({
    columns: [table.sheetId],
    foreignColumns: [paperAnswerSheets.id],
  }).onDelete('cascade'),
  questionFk: foreignKey({
    columns: [table.questionId],
    foreignColumns: [questions.id],
  }).onDelete('cascade'),
  uniqueQuestionPerSheet: unique('paper_answers_sheet_question_unq').on(table.sheetId, table.questionId),
  confidenceRange: check(
    'paper_answers_confidence_range',
    sql`${table.confidence} IS NULL OR (${table.confidence} >= 0 AND ${table.confidence} <= 1)`
  ),
}));

export const paperAnswerOptions = pgTable('paper_answer_options', {
  paperAnswerId: integer('paper_answer_id').notNull(),
  optionId: integer('option_id').notNull(),
}, (table) => ({
  paperAnswerFk: foreignKey({
    columns: [table.paperAnswerId],
    foreignColumns: [paperAnswers.id],
  }).onDelete('cascade'),
  optionFk: foreignKey({
    columns: [table.optionId],
    foreignColumns: [options.id],
  }).onDelete('cascade'),
  pk: primaryKey({
    name: 'paper_answer_options_pk',
    columns: [table.paperAnswerId, table.optionId],
  }),
}));

export const testScanImports = pgTable('test_scan_imports', {
  id: serial('id').primaryKey(),
  teacherId: integer('teacher_id'),
  testId: integer('test_id'),
  sourceFileUrl: text('source_file_url').notNull(),
  rawText: text('raw_text'),
  errorMessage: text('error_message'),
  status: testScanStatusEnum('status').default('UPLOADED').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  processedAt: timestamp('processed_at'),
  importedAt: timestamp('imported_at'),
}, (table) => ({
  teacherFk: foreignKey({
    columns: [table.teacherId],
    foreignColumns: [users.id],
  }).onDelete('set null'),
  testFk: foreignKey({
    columns: [table.testId],
    foreignColumns: [tests.id],
  }).onDelete('set null'),
}));

export const testScanQuestions = pgTable('test_scan_questions', {
  id: serial('id').primaryKey(),
  scanId: integer('scan_id').notNull(),
  questionNumber: integer('question_number'),
  questionText: text('question_text').notNull(),
  answerType: answerTypeEnum('answer_type').default('SINGLE').notNull(),
  order: integer('order').default(0).notNull(),
}, (table) => ({
  scanFk: foreignKey({
    columns: [table.scanId],
    foreignColumns: [testScanImports.id],
  }).onDelete('cascade'),
  uniqueOrderPerScan: unique('test_scan_questions_order_unq').on(table.scanId, table.order),
}));

export const testScanOptions = pgTable('test_scan_options', {
  id: serial('id').primaryKey(),
  scanQuestionId: integer('scan_question_id').notNull(),
  optionText: text('option_text').notNull(),
  isCorrect: boolean('is_correct').default(false).notNull(),
  order: integer('order').default(0).notNull(),
}, (table) => ({
  questionFk: foreignKey({
    columns: [table.scanQuestionId],
    foreignColumns: [testScanQuestions.id],
  }).onDelete('cascade'),
  uniqueOrderPerQuestion: unique('test_scan_options_order_unq').on(table.scanQuestionId, table.order),
}));

export const testReports = pgTable('test_reports', {
  id: serial('id').primaryKey(),
  testId: integer('test_id').notNull(),
  questionId: integer('question_id'),
  reporterId: integer('reporter_id'),
  message: text('message').notNull(),
  status: text('status').default('OPEN').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at'),
}, (table) => ({
  testFk: foreignKey({
    columns: [table.testId],
    foreignColumns: [tests.id],
  }).onDelete('cascade'),
  questionFk: foreignKey({
    columns: [table.questionId],
    foreignColumns: [questions.id],
  }).onDelete('set null'),
  reporterFk: foreignKey({
    columns: [table.reporterId],
    foreignColumns: [users.id],
  }).onDelete('set null'),
}));

export const studentAnswers = pgTable('student_answers', {
  id: serial('id').primaryKey(),
  attemptId: integer('attempt_id').notNull(),
  questionId: integer('question_id').notNull(),
  isCorrect: boolean('is_correct').default(false).notNull(),
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