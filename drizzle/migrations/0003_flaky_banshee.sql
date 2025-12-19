CREATE TABLE IF NOT EXISTS "oauth_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state" varchar(255) NOT NULL,
	"user_email" varchar(255) NOT NULL,
	"provider" varchar(100) NOT NULL,
	"return_url" varchar(2048),
	"code_verifier" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "oauth_states_state_unique" UNIQUE("state")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_states_state_idx" ON "oauth_states" USING btree ("state");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_states_expires_at_idx" ON "oauth_states" USING btree ("expires_at");