ALTER TABLE "document_chunks" ADD COLUMN "graph_index_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD COLUMN "graph_index_error" text;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD COLUMN "graph_index_attempts" integer DEFAULT 0 NOT NULL;