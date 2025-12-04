ALTER TABLE "connections" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "connections" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "connection_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN "slug" varchar(255) NOT NULL;--> statement-breakpoint
CREATE INDEX "connections_slug_idx" ON "connections" USING btree ("slug");