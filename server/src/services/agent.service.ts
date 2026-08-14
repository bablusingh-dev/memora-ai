import { createOpenAI } from '@ai-sdk/openai';
import { streamText, tool, isStepCount } from 'ai';
import { z } from 'zod';
import { env } from '../config/env.js';
import { NotebookRepository } from '../repositories/notebook.repository.js';
import { db } from '../db/index.js';
import { notes } from '../db/schema.js';
import { logger } from '../utils/logger.js';
import { BadRequestError } from '../utils/api-error.js';

export class AgentService {
  private notebookRepo: NotebookRepository;

  constructor() {
    this.notebookRepo = new NotebookRepository();
  }

  /**
   * Execute Agentic RAG chat with tool calling and response streaming
   */
  async streamAgentChat(notebookId: string, userId: string, messages: any[]) {
    // Verify user owns notebook
    const notebook = await this.notebookRepo.findById(notebookId, userId);
    if (!notebook) {
      throw new BadRequestError(`Notebook '${notebookId}' not found or access denied`);
    }

    if (!env.OPENAI_API_KEY || env.OPENAI_API_KEY === 'sk-placeholder') {
      throw new BadRequestError(
        'OpenAI API Key is missing or set to placeholder. Please add OPENAI_API_KEY to server/.env to enable AI streaming and tool calling.'
      );
    }

    const openai = createOpenAI({
      apiKey: env.OPENAI_API_KEY,
    });

    logger.info({ notebookId, userId, messageCount: messages.length }, 'Initiating Agentic RAG chat stream');

    const systemPrompt = `
You are Memora AI, an intelligent, grounded Notebook LLM assistant.
Your goal is to answer the user's questions accurately using facts from their notebook source documents.

CRITICAL INSTRUCTIONS:
1. Whenever the user asks a question about their sources, research topics, videos, or documents, ALWAYS call the 'searchParadeDB' tool first to retrieve relevant text chunks from ParadeDB search.
2. Formulate concise keywords or questions in the 'query' parameter when searching.
3. After retrieving facts from searchParadeDB, provide a thorough, helpful, and direct answer based on the retrieved context.
4. Ground your answers strictly in the retrieved source facts. If information is unavailable in the retrieved context, explicitly inform the user.
5. Include inline citation brackets like [Source: Document Title] or [Chunk #N] when referencing facts.
6. If the user asks to save an insight or note, call the 'createNotebookNote' tool.
`;

    const searchParadeDB = (tool as any)({
      description: 'Search document text chunks indexed in ParadeDB using BM25 vectorless search',
      parameters: z.object({
        query: z.string().optional().describe('Search query keywords or questions. If searching for all topics/video contents, provide key topic keywords or leave empty.'),
        topK: z.number().optional().default(5).describe('Number of top relevant chunks to retrieve'),
      }),
      execute: async ({ query, topK }: { query?: string; topK?: number }) => {
        logger.info({ notebookId, query, topK }, 'Agent executing searchParadeDB tool call');
        const cleanQuery = query?.trim() || '';
        const chunks = await this.notebookRepo.searchBM25(notebookId, cleanQuery, topK || 5);
        return {
          query: cleanQuery,
          retrievedCount: chunks.length,
          results: chunks.map((c) => ({
            id: c.id,
            sourceId: c.source_id,
            content: c.content,
            chunkIndex: c.chunk_index,
            bm25Score: c.bm25_score,
          })),
        };
      },
    });

    const createNotebookNote = (tool as any)({
      description: 'Save a study note, summary, or insight into the notebook',
      parameters: z.object({
        title: z.string().describe('Note title'),
        content: z.string().describe('Note markdown content'),
        type: z.enum(['user_note', 'ai_summary', 'study_guide']).optional().default('ai_summary'),
      }),
      execute: async ({ title, content, type }: { title: string; content: string; type: string }) => {
        logger.info({ notebookId, title }, 'Agent executing createNotebookNote tool call');
        const [newNote] = await db
          .insert(notes)
          .values({
            notebookId,
            title,
            content,
            type: (type as any) || 'ai_summary',
          })
          .returning();
        return { success: true, noteId: newNote.id, title: newNote.title };
      },
    });

    // Convert @ai-sdk/react v4 UIMessage format (parts[]) to ModelMessage format (content string)
    // that the server-side streamText() function expects.
    const modelMessages = this.convertToModelMessages(messages);

    const result = streamText({
      model: openai(env.OPENAI_MODEL),
      system: systemPrompt,
      messages: modelMessages,
      stopWhen: isStepCount(5),
      tools: {
        searchParadeDB,
        createNotebookNote,
      },
    } as any);

    return result;
  }

  /**
   * Convert UIMessage[] (sent by @ai-sdk/react v4 client) to ModelMessage[]
   * (expected by server-side streamText).
   *
   * UIMessage v4 shape: { role, id, parts: [{ type: 'text', text: string }] }
   * ModelMessage shape: { role: 'user'|'assistant', content: string }
   */
  private convertToModelMessages(uiMessages: any[]): any[] {
    return uiMessages
      .map((msg) => {
        const role = msg.role as string;

        // Extract text content from either v4 parts array or legacy content string
        let content: string;
        if (typeof msg.content === 'string') {
          content = msg.content;
        } else if (Array.isArray(msg.parts)) {
          content = msg.parts
            .filter((p: any) => p.type === 'text')
            .map((p: any) => p.text as string)
            .join('');
        } else {
          content = '';
        }

        if (!content.trim()) return null;

        return { role, content };
      })
      .filter(Boolean);
  }
}
