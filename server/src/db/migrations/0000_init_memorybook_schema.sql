CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"memorybook_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"parts" jsonb,
	"is_graph_indexed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"memorybook_id" uuid NOT NULL,
	"content" text NOT NULL,
	"retrieval_content" text,
	"heading" text,
	"parent_section" text,
	"section_path" text,
	"source_type" text,
	"token_count" integer,
	"start_position" integer,
	"end_position" integer,
	"chunk_index" integer NOT NULL,
	"metadata" jsonb,
	"is_graph_indexed" boolean DEFAULT false NOT NULL,
	"graph_index_status" text DEFAULT 'pending' NOT NULL,
	"graph_index_error" text,
	"graph_index_attempts" integer DEFAULT 0 NOT NULL,
	"embedding" vector(1536),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memorybooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"memorybook_id" uuid NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"type" text DEFAULT 'user_note' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"memorybook_id" uuid NOT NULL,
	"title" text NOT NULL,
	"file_type" text NOT NULL,
	"file_url" text,
	"status" text DEFAULT 'processing' NOT NULL,
	"content_hash" text,
	"error_message" text,
	"stage" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"image_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_memorybook_id_memorybooks_id_fk" FOREIGN KEY ("memorybook_id") REFERENCES "public"."memorybooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_source_id_source_documents_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_memorybook_id_memorybooks_id_fk" FOREIGN KEY ("memorybook_id") REFERENCES "public"."memorybooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memorybooks" ADD CONSTRAINT "memorybooks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_memorybook_id_memorybooks_id_fk" FOREIGN KEY ("memorybook_id") REFERENCES "public"."memorybooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_memorybook_id_memorybooks_id_fk" FOREIGN KEY ("memorybook_id") REFERENCES "public"."memorybooks"("id") ON DELETE cascade ON UPDATE no action;