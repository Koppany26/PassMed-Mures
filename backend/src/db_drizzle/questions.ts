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
// ==========================
// 2. KÉRDÉSBANK
// ==========================

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  nev: text('nev').notNull(),
});
export const valaszTipusEnum = pgEnum('valasz_tipus', ['EGYSZERES', 'TOBBSZOROS']);

export const questions = pgTable('questions', {
  id: serial('id').primaryKey(),
  kategoriaId: integer('kategoria_id').notNull(),
  kerdesSzovege: text('kerdes_szovege').notNull(),
  kepUrl: text('kep_url'),
  magyarazat: text('magyarazat'),
  valaszTipus: valaszTipusEnum('valasz_tipus').default('EGYSZERES').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  kategoriaFk: foreignKey({
    columns: [table.kategoriaId],
    foreignColumns: [categories.id],
  }),
}));

export const options = pgTable('options', {
  id: serial('id').primaryKey(),
  kerdesId: integer('kerdes_id').notNull(),
  valaszSzovege: text('valasz_szovege').notNull(),
  helyesE: boolean('helyes_e').default(false).notNull(),
  sorrend: integer('sorrend').default(0).notNull(),
}, (table) => ({
  kerdesFk: foreignKey({
    columns: [table.kerdesId],
    foreignColumns: [questions.id],
  }).onDelete('cascade'),
}));

