import { integer, pgTable, varchar } from "drizzle-orm/pg-core";

enum Szerepkor{
    DIAK,
    TANAR,
    ADMIN
}

export const usersTable = pgTable("users", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  nev: varchar({ length: 255 }).notNull(),
  email: varchar({ length: 255 }).notNull().unique(),
  szerepkor: Szerepkor({}).notNull(),


});
