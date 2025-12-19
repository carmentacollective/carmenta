ALTER TABLE "documents" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "prompt_label" varchar(50);--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "prompt_hint" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "prompt_order" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "always_include" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "searchable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "editable" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX "documents_always_include_idx" ON "documents" USING btree ("user_id","always_include");