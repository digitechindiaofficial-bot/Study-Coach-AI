CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"full_name" text,
	"phone_number" text,
	"phone_verified" boolean DEFAULT false NOT NULL,
	"exam_type" text,
	"exam_date" date,
	"daily_study_hours" integer DEFAULT 4 NOT NULL,
	"plan_type" text DEFAULT 'free' NOT NULL,
	"streak_count" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"last_active_date" date,
	"quiz_count_today" integer DEFAULT 0 NOT NULL,
	"quiz_count_date" date,
	"plan_expiry" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
CREATE TABLE "otp_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"otp" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"excerpt" text,
	"content" text NOT NULL,
	"cover_image" text,
	"category" text DEFAULT 'general' NOT NULL,
	"tags" text[] DEFAULT '{}',
	"exam_code" text,
	"author" text DEFAULT 'GovtGuru Team',
	"is_published" boolean DEFAULT false NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"read_time" integer DEFAULT 5 NOT NULL,
	"meta_title" text,
	"meta_description" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "blog_posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "study_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"exam_type" text,
	"plan_data" jsonb,
	"weeks_remaining" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date DEFAULT now() NOT NULL,
	"subject" text,
	"topic" text,
	"duration_minutes" integer,
	"task_type" text,
	"is_completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "syllabus_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"exam_type" text,
	"subject" text,
	"topic" text,
	"subtopic" text,
	"status" text DEFAULT 'not_started' NOT NULL,
	"confidence" text,
	"last_revised_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "syllabus_exams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "syllabus_exams_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "syllabus_subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_id" uuid NOT NULL,
	"name" text NOT NULL,
	"subject_code" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "syllabus_topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_id" uuid NOT NULL,
	"name" text NOT NULL,
	"topic_code" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "syllabus_topics_topic_code_unique" UNIQUE("topic_code")
);
--> statement-breakpoint
CREATE TABLE "user_topic_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"last_revised_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_topic_unique" UNIQUE("user_id","topic_id")
);
--> statement-breakpoint
CREATE TABLE "current_affairs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"category" text,
	"exam_relevance" text[],
	"published_date" date DEFAULT now(),
	"source" text,
	"is_featured" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"selected_option" text,
	"is_correct" boolean,
	"time_taken_seconds" integer,
	"attempted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_code" text,
	"subject_code" text,
	"topic_code" text,
	"subject" text,
	"topic" text,
	"question_text" text NOT NULL,
	"options" jsonb,
	"correct_option" text,
	"explanation" text,
	"difficulty" text,
	"exam_type" text[],
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"exam_code" text,
	"subject_code" text,
	"topic_code" text,
	"selected_answer" text,
	"is_correct" boolean,
	"time_taken_seconds" integer,
	"attempted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_bank" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_code" text NOT NULL,
	"subject_code" text NOT NULL,
	"topic_code" text NOT NULL,
	"difficulty" text DEFAULT 'medium' NOT NULL,
	"question" text NOT NULL,
	"option_a" text NOT NULL,
	"option_b" text NOT NULL,
	"option_c" text NOT NULL,
	"option_d" text NOT NULL,
	"correct_answer" text NOT NULL,
	"explanation" text,
	"source" text DEFAULT 'original' NOT NULL,
	"exam_year" integer,
	"language" text DEFAULT 'english' NOT NULL,
	"tags" text[] DEFAULT '{}',
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mock_test_attempt_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	"question_bank_id" uuid NOT NULL,
	"order_num" integer NOT NULL,
	"marks" numeric(5, 2) DEFAULT '1' NOT NULL,
	"negative_marks" numeric(5, 2) DEFAULT '0' NOT NULL,
	"subject_code" text NOT NULL,
	"topic_code" text NOT NULL,
	"difficulty" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mock_test_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mock_test_id" uuid NOT NULL,
	"mock_test_version" integer DEFAULT 1 NOT NULL,
	"clerk_user_id" text NOT NULL,
	"exam_code" text NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"submitted_at" timestamp,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"score" numeric(8, 2),
	"total_marks" integer,
	"time_taken_seconds" integer,
	"correct_count" integer DEFAULT 0 NOT NULL,
	"incorrect_count" integer DEFAULT 0 NOT NULL,
	"unattempted_count" integer DEFAULT 0 NOT NULL,
	"accuracy" numeric(5, 2)
);
--> statement-breakpoint
CREATE TABLE "mock_test_fixed_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid NOT NULL,
	"question_bank_id" uuid NOT NULL,
	"order_num" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mock_test_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"attempt_question_id" uuid NOT NULL,
	"question_bank_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	"subject_code" text NOT NULL,
	"topic_code" text NOT NULL,
	"difficulty" text NOT NULL,
	"selected_option" text,
	"is_marked_for_review" boolean DEFAULT false NOT NULL,
	"is_correct" boolean,
	"marks_awarded" numeric(5, 2) DEFAULT '0' NOT NULL,
	"time_spent_seconds" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "mock_test_responses_attempt_question_id_unique" UNIQUE("attempt_question_id")
);
--> statement-breakpoint
CREATE TABLE "mock_test_section_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_id" uuid NOT NULL,
	"selection_type" text DEFAULT 'dynamic' NOT NULL,
	"exam_code" text,
	"subject_code" text,
	"topic_code" text,
	"difficulty" text,
	"easy_count" integer DEFAULT 0 NOT NULL,
	"medium_count" integer DEFAULT 0 NOT NULL,
	"hard_count" integer DEFAULT 0 NOT NULL,
	"randomize" boolean DEFAULT true NOT NULL,
	"language" text,
	"tags" text[],
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mock_test_section_rules_section_id_unique" UNIQUE("section_id")
);
--> statement-breakpoint
CREATE TABLE "mock_test_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mock_test_id" uuid NOT NULL,
	"name" text NOT NULL,
	"subject_code" text,
	"order_num" integer DEFAULT 1 NOT NULL,
	"question_count" integer DEFAULT 0 NOT NULL,
	"marks_per_question" numeric(5, 2) DEFAULT '1' NOT NULL,
	"negative_marks" numeric(5, 2) DEFAULT '0' NOT NULL,
	"time_limit_seconds" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mock_tests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"mock_type" text DEFAULT 'FULL_MOCK' NOT NULL,
	"time_limit_minutes" integer DEFAULT 60 NOT NULL,
	"difficulty" text DEFAULT 'mixed' NOT NULL,
	"instructions" text,
	"version" integer DEFAULT 1 NOT NULL,
	"total_marks" integer DEFAULT 0 NOT NULL,
	"mock_number" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"exam_pattern_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_patterns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_code" text NOT NULL,
	"exam_name" text NOT NULL,
	"mock_type" text DEFAULT 'FULL_MOCK' NOT NULL,
	"total_questions" integer NOT NULL,
	"total_marks" integer NOT NULL,
	"time_limit_minutes" integer NOT NULL,
	"mark_per_question" numeric(5, 2) DEFAULT '1' NOT NULL,
	"negative_marking" numeric(5, 2) DEFAULT '0' NOT NULL,
	"section_wise_config" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "exam_patterns_exam_code_unique" UNIQUE("exam_code")
);
--> statement-breakpoint
CREATE TABLE "mock_test_result_analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"mock_test_id" uuid NOT NULL,
	"clerk_user_id" text NOT NULL,
	"subject_wise" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"section_wise" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"question_time_map" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"topic_wise" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"total_time_seconds" integer DEFAULT 0 NOT NULL,
	"correct_count" integer DEFAULT 0 NOT NULL,
	"incorrect_count" integer DEFAULT 0 NOT NULL,
	"unattempted_count" integer DEFAULT 0 NOT NULL,
	"marked_for_review_count" integer DEFAULT 0 NOT NULL,
	"total_negative_marks" numeric(8, 2) DEFAULT '0' NOT NULL,
	"score" numeric(8, 2) DEFAULT '0' NOT NULL,
	"total_marks" integer DEFAULT 0 NOT NULL,
	"accuracy" numeric(5, 2) DEFAULT '0' NOT NULL,
	"rank" integer,
	"total_attempts" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mock_test_result_analytics_attempt_id_unique" UNIQUE("attempt_id")
);
--> statement-breakpoint
ALTER TABLE "syllabus_subjects" ADD CONSTRAINT "syllabus_subjects_exam_id_syllabus_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."syllabus_exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syllabus_topics" ADD CONSTRAINT "syllabus_topics_subject_id_syllabus_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."syllabus_subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_topic_progress" ADD CONSTRAINT "user_topic_progress_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_topic_progress" ADD CONSTRAINT "user_topic_progress_topic_id_syllabus_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."syllabus_topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_qat_user_question" ON "question_attempts" USING btree ("user_id","question_id");--> statement-breakpoint
CREATE INDEX "idx_qat_user_exam" ON "question_attempts" USING btree ("user_id","exam_code");--> statement-breakpoint
CREATE INDEX "idx_qat_user_date" ON "question_attempts" USING btree ("user_id","attempted_at");--> statement-breakpoint
CREATE INDEX "idx_qb_exam_sub_topic" ON "question_bank" USING btree ("exam_code","subject_code","topic_code");--> statement-breakpoint
CREATE INDEX "idx_qb_exam_diff" ON "question_bank" USING btree ("exam_code","difficulty");--> statement-breakpoint
CREATE INDEX "idx_qb_source" ON "question_bank" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_qb_language" ON "question_bank" USING btree ("language");--> statement-breakpoint
CREATE INDEX "idx_qb_active" ON "question_bank" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_mtaq_attempt_id" ON "mock_test_attempt_questions" USING btree ("attempt_id");--> statement-breakpoint
CREATE INDEX "idx_mtaq_attempt_section" ON "mock_test_attempt_questions" USING btree ("attempt_id","section_id");--> statement-breakpoint
CREATE INDEX "idx_mta_user_mock" ON "mock_test_attempts" USING btree ("clerk_user_id","mock_test_id");--> statement-breakpoint
CREATE INDEX "idx_mta_user_status" ON "mock_test_attempts" USING btree ("clerk_user_id","status");--> statement-breakpoint
CREATE INDEX "idx_mta_mock_test_id" ON "mock_test_attempts" USING btree ("mock_test_id");--> statement-breakpoint
CREATE INDEX "idx_mtfq_rule_id" ON "mock_test_fixed_questions" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "idx_mtfq_qb_id" ON "mock_test_fixed_questions" USING btree ("question_bank_id");--> statement-breakpoint
CREATE INDEX "idx_mtr_attempt_id" ON "mock_test_responses" USING btree ("attempt_id");--> statement-breakpoint
CREATE INDEX "idx_mtr_attempt_subject" ON "mock_test_responses" USING btree ("attempt_id","subject_code");--> statement-breakpoint
CREATE INDEX "idx_mtsr_section_id" ON "mock_test_section_rules" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "idx_mts_mock_test_id" ON "mock_test_sections" USING btree ("mock_test_id");--> statement-breakpoint
CREATE INDEX "idx_mt_exam_code" ON "mock_tests" USING btree ("exam_code");--> statement-breakpoint
CREATE INDEX "idx_mt_active" ON "mock_tests" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_mt_type" ON "mock_tests" USING btree ("mock_type");--> statement-breakpoint
CREATE INDEX "idx_mt_status" ON "mock_tests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_mt_exam_number" ON "mock_tests" USING btree ("exam_code","mock_number");--> statement-breakpoint
CREATE INDEX "idx_ep_exam_code" ON "exam_patterns" USING btree ("exam_code");--> statement-breakpoint
CREATE INDEX "idx_ep_active" ON "exam_patterns" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_mtra_attempt_id" ON "mock_test_result_analytics" USING btree ("attempt_id");--> statement-breakpoint
CREATE INDEX "idx_mtra_user_mock" ON "mock_test_result_analytics" USING btree ("clerk_user_id","mock_test_id");--> statement-breakpoint
CREATE INDEX "idx_mtra_clerk_user_id" ON "mock_test_result_analytics" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "idx_mtra_mock_test_id" ON "mock_test_result_analytics" USING btree ("mock_test_id");