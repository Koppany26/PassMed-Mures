CREATE TABLE "body_regions" (
	"id" serial PRIMARY KEY NOT NULL,
	"region_key" text NOT NULL,
	"name" text NOT NULL,
	"svg_region_id" text NOT NULL,
	CONSTRAINT "body_regions_region_key_unique" UNIQUE("region_key"),
	CONSTRAINT "body_regions_svg_region_id_unique" UNIQUE("svg_region_id"),
	CONSTRAINT "body_regions_region_key_not_empty" CHECK ("body_regions"."region_key" <> ''),
	CONSTRAINT "body_regions_svg_region_id_not_empty" CHECK ("body_regions"."svg_region_id" <> '')
);
--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN "body_region_id" integer;--> statement-breakpoint
ALTER TABLE "student_answers" ADD COLUMN "is_correct" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "student_answers" AS answer
SET "is_correct" = (
	EXISTS (
		SELECT 1 FROM "options" AS correct_option
		WHERE correct_option."question_id" = answer."question_id"
			AND correct_option."is_correct" = true
	)
	AND NOT EXISTS (
		SELECT 1 FROM "options" AS correct_option
		WHERE correct_option."question_id" = answer."question_id"
			AND correct_option."is_correct" = true
			AND NOT EXISTS (
				SELECT 1 FROM "student_answer_options" AS selected
				WHERE selected."student_answer_id" = answer."id"
					AND selected."option_id" = correct_option."id"
			)
	)
	AND NOT EXISTS (
		SELECT 1
		FROM "student_answer_options" AS selected
		INNER JOIN "options" AS selected_option ON selected_option."id" = selected."option_id"
		WHERE selected."student_answer_id" = answer."id"
			AND (
				selected_option."question_id" <> answer."question_id"
				OR selected_option."is_correct" = false
			)
	)
);--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_body_region_id_body_regions_id_fk" FOREIGN KEY ("body_region_id") REFERENCES "public"."body_regions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
