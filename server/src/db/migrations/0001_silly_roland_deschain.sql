CREATE TABLE "studio_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"memorybook_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'generating' NOT NULL,
	"error_message" text,
	"payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "studio_artifacts" ADD CONSTRAINT "studio_artifacts_memorybook_id_memorybooks_id_fk" FOREIGN KEY ("memorybook_id") REFERENCES "public"."memorybooks"("id") ON DELETE cascade ON UPDATE no action;