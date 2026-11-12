CREATE TYPE "public"."test_scan_status" AS ENUM('UPLOADED', 'PROCESSING', 'REVIEW_REQUIRED', 'IMPORTED', 'FAILED');--> statement-breakpoint
CREATE TABLE "test_scan_imports" (
	"id" serial PRIMARY KEY NOT NULL,
	"teacher_id" integer,
	"test_id" integer,
	"source_file_url" text NOT NULL,
	"raw_text" text,
	"error_message" text,
	"status" "test_scan_status" DEFAULT 'UPLOADED' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	"imported_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "test_scan_options" (
	"id" serial PRIMARY KEY NOT NULL,
	"scan_question_id" integer NOT NULL,
	"option_text" text NOT NULL,
	"is_correct" boolean DEFAULT false NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "test_scan_options_order_unq" UNIQUE("scan_question_id","order")
);
--> statement-breakpoint
CREATE TABLE "test_scan_questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"scan_id" integer NOT NULL,
	"question_number" integer,
	"question_text" text NOT NULL,
	"answer_type" "answer_type" DEFAULT 'SINGLE' NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "test_scan_questions_order_unq" UNIQUE("scan_id","order")
);
--> statement-breakpoint
ALTER TABLE "test_scan_imports" ADD CONSTRAINT "test_scan_imports_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_scan_imports" ADD CONSTRAINT "test_scan_imports_test_id_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_scan_options" ADD CONSTRAINT "test_scan_options_scan_question_id_test_scan_questions_id_fk" FOREIGN KEY ("scan_question_id") REFERENCES "public"."test_scan_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_scan_questions" ADD CONSTRAINT "test_scan_questions_scan_id_test_scan_imports_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."test_scan_imports"("id") ON DELETE cascade ON UPDATE no action;