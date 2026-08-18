ALTER TABLE "source_documents" ADD COLUMN "content_hash" text;--> statement-breakpoint
ALTER TABLE "source_documents" ADD COLUMN "error_message" text;--> statement-breakpoint
ALTER TABLE "source_documents" ADD COLUMN "stage" text;