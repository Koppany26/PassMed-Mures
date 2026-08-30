import 'dotenv/config';
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
});

// Érdemes a db-t is exportálni, hogy a kód többi részén használhasd!
export const db = drizzle({ client: pool }); 

// ITT A VARÁZSLAT: import helyett export
export * from './users';
export * from './questions';
export * from './tests';
export * from './schema';