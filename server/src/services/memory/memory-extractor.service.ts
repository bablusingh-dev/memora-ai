import { MemoryFactory } from '../../providers/memory/memory.factory.js';
import { GraphFactory } from '../../providers/graph/graph.factory.js';
import { logger } from '../../utils/logger.js';
import crypto from 'crypto';

export class MemoryExtractorService {
  private memoryProvider = MemoryFactory.getProvider();
  private graphProvider = GraphFactory.getProvider();

  /**
   * Asynchronously extracts facts, graph relations, episodic events, and procedural rules
   */
  async extractAndPersistMemories(
    userId: string,
    notebookId: string,
    userMessage: string,
    assistantReply: string
  ): Promise<void> {
    try {
      logger.info({ userId, notebookId }, 'Starting background cognitive memory extraction');

      // 1. Semantic Memory & User Profile Extraction
      await this.extractSemanticFacts(userId, notebookId, userMessage, assistantReply);

      // 2. Entity & Knowledge Graph Extraction (Neo4j)
      await this.extractGraphTriples(userId, userMessage, assistantReply);

      // 3. Procedural Memory Extraction
      await this.extractProceduralRules(userId, userMessage);

      // 4. Episodic Event Memory
      await this.extractEpisodicSession(userId, notebookId, userMessage, assistantReply);

      logger.info({ userId, notebookId }, 'Completed cognitive memory extraction and persistence');
    } catch (err) {
      logger.error({ err, userId, notebookId }, 'Error during cognitive memory extraction');
    }
  }

  private async extractSemanticFacts(
    userId: string,
    notebookId: string,
    userMessage: string,
    assistantReply: string
  ): Promise<void> {
    // Detect key user declarations ("I am...", "My goal is...", "Remember that...", etc.)
    const userDeclarations = this.extractDeclarations(userMessage);
    if (userDeclarations.length > 0) {
      await this.memoryProvider.add(userDeclarations, {
        userId,
        category: 'user_profile',
        metadata: { notebookId, source: 'user_declaration' },
      });
    }

    // Extract atomic facts from assistant reply if grounded
    const sentences = assistantReply
      .split(/(?<=[.?!])\s+/)
      .filter((s) => s.length > 25 && !s.startsWith('Here') && !s.startsWith('Sure'));

    const atomicFacts = sentences.slice(0, 3);
    if (atomicFacts.length > 0) {
      await this.memoryProvider.add(atomicFacts, {
        userId,
        category: 'semantic',
        metadata: { notebookId, source: 'assistant_grounded_fact' },
      });
    }
  }

  private async extractGraphTriples(userId: string, userMessage: string, assistantReply: string): Promise<void> {
    const combinedText = `${userMessage} ${assistantReply}`;
    
    // Extract capitalized named entities (nouns, projects, technologies, people)
    const entityMatches = combinedText.match(/\b[A-Z][a-zA-Z0-9_-]{2,}(?:\s+[A-Z][a-zA-Z0-9_-]{2,})*\b/g);
    if (!entityMatches) return;

    const uniqueEntities = Array.from(new Set(entityMatches))
      .filter((e) => !['The', 'Here', 'What', 'How', 'This', 'That', 'When', 'Where', 'Why', 'Please', 'Memora', 'AI'].includes(e))
      .slice(0, 5);

    for (const name of uniqueEntities) {
      await this.graphProvider.upsertEntity(
        {
          id: crypto.randomUUID(),
          name,
          type: 'Concept',
          description: `Extracted from session context for user ${userId}`,
        },
        userId
      );
    }

    // If multiple entities found, link the primary pair
    if (uniqueEntities.length >= 2) {
      await this.graphProvider.upsertRelation(
        {
          sourceEntity: uniqueEntities[0],
          targetEntity: uniqueEntities[1],
          relationType: 'ASSOCIATED_WITH',
          description: 'Contextually linked during conversation',
          validFrom: new Date(),
        },
        userId
      );
    }
  }

  private async extractProceduralRules(userId: string, userMessage: string): Promise<void> {
    const lower = userMessage.toLowerCase();
    if (
      lower.includes('always ') ||
      lower.includes('format like') ||
      lower.includes('structure as') ||
      lower.includes('my preference is')
    ) {
      await this.memoryProvider.add(userMessage, {
        userId,
        category: 'procedural',
        metadata: { extractedAt: new Date().toISOString() },
      });
    }
  }

  private async extractEpisodicSession(
    userId: string,
    notebookId: string,
    userMessage: string,
    assistantReply: string
  ): Promise<void> {
    const summary = `User discussed: "${userMessage.slice(0, 80)}..." - Assistant summarized key insights.`;
    await this.memoryProvider.add(summary, {
      userId,
      category: 'episodic',
      metadata: {
        notebookId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  private extractDeclarations(text: string): string[] {
    const lines = text.split(/[.\n]/).map((l) => l.trim());
    const patterns = [
      /^(i am|i'm|i work as|my name is|i prefer|i like|i dislike|i need|my role is)/i,
      /(remember that|please note that|keep in mind that)/i,
    ];
    return lines.filter((l) => patterns.some((p) => p.test(l)));
  }
}
