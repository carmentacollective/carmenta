CREATE TYPE "public"."feature_tip_state" AS ENUM('shown', 'dismissed', 'engaged');--> statement-breakpoint
CREATE TABLE "feature_tip_views" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "feature_tip_views_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"tip_id" varchar(100) NOT NULL,
	"first_shown_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_shown_at" timestamp with time zone DEFAULT now() NOT NULL,
	"shown_count" integer DEFAULT 1 NOT NULL,
	"state" "feature_tip_state" DEFAULT 'shown' NOT NULL,
	"state_changed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "session_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_session_date" varchar(10);--> statement-breakpoint
ALTER TABLE "feature_tip_views" ADD CONSTRAINT "feature_tip_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feature_tip_views_user_idx" ON "feature_tip_views" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "feature_tip_views_user_tip_idx" ON "feature_tip_views" USING btree ("user_id","tip_id");--> statement-breakpoint
CREATE INDEX "feature_tip_views_state_changed_idx" ON "feature_tip_views" USING btree ("state","state_changed_at");