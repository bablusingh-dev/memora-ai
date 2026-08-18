import { z } from 'zod';

// ---------------------------------------------------------------------------
// Stop-word guard — discard entity names that are document/conversation meta
// ---------------------------------------------------------------------------
export const DOCUMENT_META_STOPWORDS = new Set([
  'video', 'videos', 'youtube', 'channel',
  'user', 'users', 'speaker', 'author', 'developer',
  'paragraph', 'document', 'text', 'source', 'sources', 'link', 'links', 'page', 'pages',
  'thing', 'things', 'something', 'anything', 'item', 'items', 'stuff',
  'step', 'steps', 'point', 'points', 'part', 'parts', 'section', 'sections',
  'topic', 'topics', 'content', 'information', 'details', 'data', 'overview',
  'question', 'questions', 'answer', 'answers', 'summary', 'example', 'examples',
  'case', 'cases', 'issue', 'issues', 'problem', 'problems', 'solution', 'solutions',
  'minute', 'seconds', 'timestamp', 'chapter', 'slide', 'notes', 'system', 'process', 'method',
]);

// Minimum confidence threshold for accepting a relationship into Neo4j
export const MIN_CONFIDENCE = 0.6;

// Cap on triples accepted per chunk, to keep the graph precise rather than sprawling.
export const MAX_TRIPLES_PER_CHUNK = 5;

// ---------------------------------------------------------------------------
// LLM extraction schema with mandatory confidence + evidence
// ---------------------------------------------------------------------------
export const GraphExtractionSchema = z.object({
  triples: z.array(
    z.object({
      sourceName: z.string().describe('Specific named entity (person, org, product, technology, concept, event, location, law, etc.)'),
      sourceType: z.string().describe('Entity category: Person, Organization, Product, Technology, Concept, Location, Event, Document, Topic, Project, Date, Disease, Law, ScientificPrinciple'),
      relation: z.string().describe('Relationship predicate in UPPER_SNAKE_CASE (e.g. CREATED_BY, TREATS, FOUNDED, REGULATES, USES, DISCOVERED)'),
      targetName: z.string().describe('Specific named target entity'),
      targetType: z.string().describe('Entity category of the target'),
      evidence: z.string().describe('A direct verbatim quote or close paraphrase from the chunk that proves this relationship exists. Must be non-empty.'),
      confidence: z.number().min(0).max(1).describe('Confidence that the source chunk explicitly supports this relationship. 0.9-1.0 = explicit statement. 0.75-0.89 = strong implication. 0.60-0.74 = weak implication. Below 0.60 = do not include.'),
    })
  ),
});

export type GraphExtractionTriple = z.infer<typeof GraphExtractionSchema>['triples'][number];

/**
 * Looser input accepted by filterTriples/normalizeEntityName than the LLM
 * output contract above: sourceType/targetType are optional here (runtime
 * already falls back to 'Concept' when absent) so callers — including test
 * fixtures — aren't forced to fabricate a type just to exercise the filter.
 */
export type RawTripleInput = Omit<GraphExtractionTriple, 'sourceType' | 'targetType'> & {
  sourceType?: string;
  targetType?: string;
};

export const EXTRACTION_GUIDANCE = `
HIGH-QUALITY EXTRACTION EXAMPLES:

Example 1 (Medicine):
Chunk: "Clinical trials showed that Pembrolizumab binds to the PD-1 receptor on T-cells, preventing PD-L1 interaction and reversing immunosuppression in melanoma patients."
Triples:
- sourceName: "Pembrolizumab", relation: "BINDS_TO", targetName: "PD-1 Receptor", evidence: "Pembrolizumab binds to the PD-1 receptor on T-cells", confidence: 0.98
- sourceName: "Pembrolizumab", relation: "TREATS", targetName: "Melanoma", evidence: "reversing immunosuppression in melanoma patients", confidence: 0.92

Example 2 (Technology):
Chunk: "Uber uses Apache Kafka for real-time telemetry streaming, routing events to Apache Flink for stateful analytics."
Triples:
- sourceName: "Uber", relation: "USES", targetName: "Apache Kafka", evidence: "Uber uses Apache Kafka for real-time telemetry streaming", confidence: 0.97
- sourceName: "Apache Kafka", relation: "STREAMS_DATA_TO", targetName: "Apache Flink", evidence: "routing events to Apache Flink for stateful analytics", confidence: 0.95

REJECTION RULES — Do NOT create a triple if:
- The source chunk does not contain clear evidence (evidence must be a real quote/paraphrase from the chunk)
- confidence < 0.60
- Either entity is a generic meta-word (video, document, speaker, things, steps, system, process)
- The subject and object are the same entity
`;

export interface NormalizedTriple {
  sourceName: string;
  sourceType: string;
  relation: string;
  targetName: string;
  targetType: string;
  context: string;
  evidence: string;
  confidence: number;
  sourceChunkId: string;
}

/**
 * Normalize entity names for canonical identity.
 * Removes trailing punctuation, normalizes whitespace.
 */
export function normalizeEntityName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').replace(/[.,;:!?]$/, '');
}

function normalizeTriple(t: RawTripleInput, chunkId: string): NormalizedTriple {
  return {
    sourceName: normalizeEntityName(t.sourceName),
    sourceType: t.sourceType || 'Concept',
    relation: t.relation.toUpperCase().replace(/\s+/g, '_'),
    targetName: normalizeEntityName(t.targetName),
    targetType: t.targetType || 'Concept',
    context: t.evidence, // stored as context for backward compat
    evidence: t.evidence,
    confidence: t.confidence,
    sourceChunkId: chunkId,
  };
}

/**
 * Filter and normalize extracted triples before Neo4j insertion.
 * Applies: stopword check, self-loop reject, minimum confidence, evidence
 * required. Pure — no I/O, no LLM/Neo4j calls — so it's directly unit
 * testable (see __tests__/graph-worker.test.ts) without needing a live
 * database or model connection.
 */
export function filterTriples(triples: RawTripleInput[], chunkId: string): NormalizedTriple[] {
  const valid: NormalizedTriple[] = [];

  for (const t of triples) {
    const src = t.sourceName?.trim();
    const tgt = t.targetName?.trim();
    const rel = t.relation?.trim().toUpperCase().replace(/\s+/g, '_');

    if (!src || !tgt || !rel) continue;
    if (src.length < 2 || tgt.length < 2) continue;

    // Reject self-loops
    if (src.toLowerCase() === tgt.toLowerCase()) continue;

    // Reject meta-words
    if (DOCUMENT_META_STOPWORDS.has(src.toLowerCase()) || DOCUMENT_META_STOPWORDS.has(tgt.toLowerCase())) continue;

    // Evidence must be non-empty
    if (!t.evidence?.trim()) continue;

    // Confidence threshold
    if ((t.confidence ?? 0) < MIN_CONFIDENCE) continue;

    valid.push(normalizeTriple(t, chunkId));
  }

  // Cap at highest-confidence triples per chunk to keep the graph precise
  return valid.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0)).slice(0, MAX_TRIPLES_PER_CHUNK);
}
