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
// 1. FELHASZNÁLÓK ÉS CSOPORTOK
// ==========================
export const szerepkorEnum = pgEnum('szerepkor', ['DIAK', 'TANAR', 'ADMIN']);


export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  nev: text('nev').notNull(),
  email: text('email').notNull().unique(),
  jelszoHash: text('jelszo_hash').notNull(),
  szerepkor: szerepkorEnum('szerepkor').default('DIAK').notNull(),
  csoportId: integer('csoport_id'), 
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(), 
});

export const groups = pgTable('groups', {
  id: serial('id').primaryKey(),
  csoportNeve: text('csoport_neve').notNull(),
  tanarId: integer('tanar_id').notNull(), // Kivettük az inline hivatkozást
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  // Így a TypeScript nem kerül végtelen ciklusba!
  tanarFk: foreignKey({
    columns: [table.tanarId],
    foreignColumns: [users.id],
  }),
}));