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
import { users } from './users';
import { questions, options } from './questions';

export const attemptStatuszEnum = pgEnum('attempt_statusz', ['FOLYAMATBAN', 'BEFEJEZVE', 'MEGSZAKITVA']);

// ==========================
// 3. TESZTEK
// ==========================

export const tests = pgTable('tests', {
  id: serial('id').primaryKey(),
  cim: text('cim').notNull(),
  leiras: text('leiras'),
  idoKorlatPercben: integer('ido_korlat_percben'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const testQuestions = pgTable('test_questions', {
  tesztId: integer('teszt_id').notNull(),
  kerdesId: integer('kerdes_id').notNull(),
  sorrend: integer('sorrend').default(0).notNull(),
  pontszam: integer('pontszam').default(1).notNull(),
}, (table) => ({
  tesztFk: foreignKey({
    columns: [table.tesztId],
    foreignColumns: [tests.id],
  }).onDelete('cascade'),
  kerdesFk: foreignKey({
    columns: [table.kerdesId],
    foreignColumns: [questions.id],
  }).onDelete('cascade'),
  pk: primaryKey({ name: 'test_questions_pk', columns: [table.tesztId, table.kerdesId] }),
}));

// ==========================
// 4. KITÖLTÉSEK ÉS EREDMÉNYEK
// ==========================

export const attempts = pgTable('attempts', {
  id: serial('id').primaryKey(),
  diakId: integer('diak_id').notNull(),
  tesztId: integer('teszt_id').notNull(),
  kezdesIdeje: timestamp('kezdes_ideje').defaultNow().notNull(),
  befejezesIdeje: timestamp('befejezes_ideje'),
  osszpontszam: integer('osszpontszam'),
  statusz: attemptStatuszEnum('statusz').default('FOLYAMATBAN').notNull(),
}, (table) => ({
  diakFk: foreignKey({
    columns: [table.diakId],
    foreignColumns: [users.id],
  }),
  tesztFk: foreignKey({
    columns: [table.tesztId],
    foreignColumns: [tests.id],
  }),
}));

export const studentAnswers = pgTable('student_answers', {
  id: serial('id').primaryKey(),
  kitoltesId: integer('kitoltes_id').notNull(),
  kerdesId: integer('kerdes_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  kitoltesFk: foreignKey({
    columns: [table.kitoltesId],
    foreignColumns: [attempts.id],
  }).onDelete('cascade'),
  kerdesFk: foreignKey({
    columns: [table.kerdesId],
    foreignColumns: [questions.id],
  }),
  unq: unique('student_answers_kitoltes_kerdes_unq').on(table.kitoltesId, table.kerdesId)
}));

export const studentAnswerOptions = pgTable('student_answer_options', {
  id: serial('id').primaryKey(),
  diakValaszId: integer('diak_valasz_id').notNull(),
  opcioId: integer('opcio_id').notNull(),
}, (table) => ({
  diakValaszFk: foreignKey({
    columns: [table.diakValaszId],
    foreignColumns: [studentAnswers.id],
  }).onDelete('cascade'),
  opcioFk: foreignKey({
    columns: [table.opcioId],
    foreignColumns: [options.id],
  }),
  unq: unique('student_answer_options_valasz_opcio_unq').on(table.diakValaszId, table.opcioId)
}));