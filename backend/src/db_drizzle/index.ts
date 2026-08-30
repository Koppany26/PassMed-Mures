import 'dotenv/config';
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
});

export const db = drizzle({ client: pool }); 

// A .js kiterjesztések KÖTELEZŐEK az ESM modulrendszer miatt!
export * from './users.js';
export * from './questions.js';
export * from './tests.js';
export * from './schema.js';