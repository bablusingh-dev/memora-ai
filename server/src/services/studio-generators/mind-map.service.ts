import { generateText, Output } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { StudioContext } from '../studio-context.service.js';

const MindMapSchema = z
  .object({
    nodes: z
      .array(
        z.object({
          id: z.string().min(1).describe('Short unique identifier for this node, e.g. "n1".'),
          label: z.string().min(1).describe('Short label text for this node — a few words, not a sentence.'),
        })
      )
      .min(4)
      .max(30)
      .describe('4 to 30 concept nodes, including exactly one root/central node.'),
    edges: z
      .array(
        z.object({
          source: z.string().min(1).describe('id of the source (parent/broader) node.'),
          target: z.string().min(1).describe('id of the target (child/narrower) node.'),
          label: z
            .string()
            .nullable()
            .describe('Short label describing the relationship, or null if there is none.'),
        })
      )
      .min(3)
      .max(60)
      .describe('Edges connecting nodes into a tree/graph radiating from the root.'),
    rootId: z.string().min(1).describe('id of the central node that anchors the mind map.'),
  })
  .refine((data) => data.nodes.some((n) => n.id === data.rootId), {
    message: 'rootId must reference an existing node id',
    path: ['rootId'],
  })
  .refine(
    (data) => {
      const ids = new Set(data.nodes.map((n) => n.id));
      return data.edges.every((e) => ids.has(e.source) && ids.has(e.target));
    },
    { message: 'Every edge must reference existing node ids', path: ['edges'] }
  );

export type MindMapPayload = z.infer<typeof MindMapSchema>;

const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });

/**
 * Structured-output generation, same pattern as the other studio-generators.
 * Produces a tree/graph shape (one root, branching concepts) rather than a
 * flat list — the frontend viewer (MindMapViewer.tsx, React Flow) lays it
 * out radially from `rootId`.
 */
export async function generateMindMap(context: StudioContext): Promise<{ title: string; payload: MindMapPayload }> {
  const { output } = await generateText({
    model: openai(env.OPENAI_MODEL),
    output: Output.object({ schema: MindMapSchema }),
    prompt: `
You are an expert at visually organizing knowledge. Read the source material below and produce a mind map of its key concepts.

RULES:
1. Choose ONE central topic as the root node — it should be the umbrella concept everything else relates to.
2. Branch out into major themes, then sub-concepts under each theme (2-3 levels deep is typical).
3. Keep every node label short (a few words, not a sentence).
4. Every non-root node must connect back to the map via at least one edge (directly or through intermediate nodes) — no orphan nodes.
5. Do not invent facts, concepts, or relationships that aren't supported by the source material.
6. Produce between 4 and 30 nodes depending on how much material is available.

[SOURCE MATERIAL]
${context.formattedText}
    `.trim(),
  });

  const rootLabel = output.nodes.find((n) => n.id === output.rootId)?.label || 'Mind Map';
  return { title: rootLabel, payload: output };
}
