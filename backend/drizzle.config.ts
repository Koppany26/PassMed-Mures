import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db_drizzle/index.ts', // Itt van a mi "karmester" fájlunk
  out: './drizzle', // Ide fogja generálni az SQL fájlokat
  dialect: 'postgresql', // Megmondjuk neki, hogy PostgreSQL-t használunk
  dbCredentials: {
    url: process.env.DATABASE_URL!, // A .env fájlból veszi a belépést
  },
  verbose: true,
});