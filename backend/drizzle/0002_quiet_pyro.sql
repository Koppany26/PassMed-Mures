CREATE TYPE "public"."attempt_mode" AS ENUM('ONLINE', 'PAPER');--> statement-breakpoint
CREATE TYPE "public"."paper_sheet_status" AS ENUM('GENERATED', 'SCANNED', 'REVIEW_REQUIRED', 'REVIEWED', 'GRADED');--> statement-breakpoint
CREATE TABLE "paper_answer_options" (
	"paper_answer_id" integer NOT NULL,
	"option_id" integer NOT NULL,
	CONSTRAINT "paper_answer_options_pk" PRIMARY KEY("paper_answer_id","option_id")
);
--> statement-breakpoint
CREATE TABLE "paper_answer_sheets" (
	"id" serial PRIMARY KEY NOT NULL,
	"attempt_id" integer NOT NULL,
	"sheet_code" text NOT NULL,
	"template_version" integer DEFAULT 1 NOT NULL,
	"scan_file_url" text,
	"status" "paper_sheet_status" DEFAULT 'GENERATED' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"scanned_at" timestamp,
	"reviewed_at" timestamp,
	CONSTRAINT "paper_answer_sheets_attempt_id_unique" UNIQUE("attempt_id"),
	CONSTRAINT "paper_answer_sheets_sheet_code_unique" UNIQUE("sheet_code")
);
--> statement-breakpoint
CREATE TABLE "paper_answers" (
	"id" serial PRIMARY KEY NOT NULL,
	"sheet_id" integer NOT NULL,
	"question_id" integer NOT NULL,
	"confidence" real,
	"needs_review" boolean DEFAULT true NOT NULL,
	"reviewed_at" timestamp,
	CONSTRAINT "paper_answers_sheet_question_unq" UNIQUE("sheet_id","question_id"),
	CONSTRAINT "paper_answers_confidence_range" CHECK ("paper_answers"."confidence" IS NULL OR ("paper_answers"."confidence" >= 0 AND "paper_answers"."confidence" <= 1))
);
--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "mode" "attempt_mode" DEFAULT 'ONLINE' NOT NULL;--> statement-breakpoint
ALTER TABLE "paper_answer_options" ADD CONSTRAINT "paper_answer_options_paper_answer_id_paper_answers_id_fk" FOREIGN KEY ("paper_answer_id") REFERENCES "public"."paper_answers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paper_answer_options" ADD CONSTRAINT "paper_answer_options_option_id_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paper_answer_sheets" ADD CONSTRAINT "paper_answer_sheets_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paper_answers" ADD CONSTRAINT "paper_answers_sheet_id_paper_answer_sheets_id_fk" FOREIGN KEY ("sheet_id") REFERENCES "public"."paper_answer_sheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paper_answers" ADD CONSTRAINT "paper_answers_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;