import 'dotenv/config';
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as usersSchema from './users.js';
import * as questionsSchema from './questions.js';
import * as testsSchema from './tests.js';
import * as flashcardsSchema from './flashcards.js';
import * as relationsSchema from './schema.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
});

// NEW: schema passed in so the relational query API (db.query.users.findMany({ with: {...} }))
// actually works — without this, only the plain db.select() builder is usable.
const schema = {
  ...usersSchema,
  ...questionsSchema,
  ...testsSchema,
  ...flashcardsSchema,
  ...relationsSchema,
};

export const db = drizzle({ client: pool, schema });

// A .js kiterjesztések KÖTELEZŐEK az ESM modulrendszer miatt!
export * from './users.js';
export * from './questions.js';
export * from './tests.js';
export * from './flashcards.js';
export * from './schema.js';