ALTER TABLE "chat_messages" ADD COLUMN "is_graph_indexed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD COLUMN "retrieval_content" text;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD COLUMN "heading" text;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD COLUMN "parent_section" text;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD COLUMN "section_path" text;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD COLUMN "source_type" text;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD COLUMN "token_count" integer;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD COLUMN "start_position" integer;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD COLUMN "end_position" integer;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD COLUMN "is_graph_indexed" boolean DEFAULT false NOT NULL;