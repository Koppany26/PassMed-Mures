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
  type AnyPgColumn
} from 'drizzle-orm/pg-core';

// ==========================
// 1. USERS AND GROUPS
//    (English field names)
// ==========================

export const roleEnum = pgEnum('role', ['STUDENT', 'TEACHER', 'ADMIN']);

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: roleEnum('role').default('STUDENT').notNull(),
  // FIXED: lazy column-level reference instead of table-level foreignKey() —
  // groups is declared further down in this file, so a table-level foreignKey()
  // callback would throw a temporal-dead-zone error at runtime.
  // The explicit ": AnyPgColumn" return-type annotation is required here too —
  // without it, TypeScript tries to INFER the callback's return type, which
  // means inferring groups' full type, which needs users' type (via groups.teacherFk),
  // which needs groups' type again — a circular type-inference loop that makes
  // TS fall over on both `groups` and the `(table) =>` callback below.
  // Annotating the return type breaks that cycle.
  groupId: integer('group_id').references((): AnyPgColumn => groups.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const groups = pgTable('groups', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  teacherId: integer('teacher_id').notNull(),
  joinCode: text('join_code').notNull().unique(), // NEW: code students use to self-join
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  teacherFk: foreignKey({
    columns: [table.teacherId],
    foreignColumns: [users.id],
  }),
}));

// ==========================
// GROUP MEMBERS
//    Many-to-many join: a student can belong to more than one group.
//    NOTE: users.groupId above still exists as a single "primary group"
//    pointer. Decide whether to keep both (primary group + full membership
//    list) or drop users.groupId in favor of this table as the single
//    source of truth — see chat notes.
// ==========================

export const groupMembers = pgTable('group_members', {
  id: serial('id').primaryKey(),
  groupId: integer('group_id').notNull(),
  studentId: integer('student_id').notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
}, (table) => ({
  groupFk: foreignKey({
    columns: [table.groupId],
    foreignColumns: [groups.id],
  }).onDelete('cascade'),
  studentFk: foreignKey({
    columns: [table.studentId],
    foreignColumns: [users.id],
  }).onDelete('cascade'),
  unq: unique('group_members_group_student_unq').on(table.groupId, table.studentId),
}));

// ==========================
// INVITATIONS (teacher -> student invitation to a group, by email)
// ==========================
export const invitationStatusEnum = pgEnum('invitation_status', ['PENDING', 'ACCEPTED', 'DECLINED']);

export const invitations = pgTable('invitations', {
  id: serial('id').primaryKey(),
  groupId: integer('group_id').notNull(),
  email: text('email').notNull(),
  status: invitationStatusEnum('status').default('PENDING').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  acceptedAt: timestamp('accepted_at'),
}, (table) => ({
  groupFk: foreignKey({
    columns: [table.groupId],
    foreignColumns: [groups.id],
  }).onDelete('cascade'),
  unq: unique('invitations_group_email_unq').on(table.groupId, table.email),
}));

// ==========================
// TEACHER INVITATIONS
//    Admin invites a teacher by email with a one-time code, valid for
//    21 days; the teacher uses it to activate their account and set
//    their own password.
// ==========================
export const teacherInvitationStatusEnum = pgEnum('teacher_invitation_status', [
  'PENDING',
  'ACCEPTED',
  'EXPIRED',
  'REVOKED',
]);

export const teacherInvitations = pgTable('teacher_invitations', {
  id: serial('id').primaryKey(),
  email: text('email').notNull(),
  code: text('code').notNull().unique(),
  invitedByAdminId: integer('invited_by_admin_id').notNull(),
  status: teacherInvitationStatusEnum('status').default('PENDING').notNull(),
  expiresAt: timestamp('expires_at').notNull(), // set to createdAt + 21 days when the row is inserted
  acceptedAt: timestamp('accepted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  adminFk: foreignKey({
    columns: [table.invitedByAdminId],
    foreignColumns: [users.id],
  }).onDelete('cascade'),
  unq: unique('teacher_invitations_email_unq').on(table.email),
}));