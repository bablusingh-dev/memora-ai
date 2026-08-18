import { MemoryFactory } from '../../providers/memory/memory.factory.js';
import { logger } from '../../utils/logger.js';

export class MemoryExtractorService {
  private memoryProvider = MemoryFactory.getProvider();

  /**
   * Extracts and persists user-scoped memories from a conversation turn.
   *
   * Memory is strictly limited to:
   *   1. User self-declarations (I am…, my goal is…) → user_profile
   *   2. User formatting preferences → procedural
   *   3. Episodic session summary → episodic (only when substantive)
   *
   * Document knowledge (entities, facts from sources) is handled exclusively
   * by the graph-extract-chunk Inngest function (see
   * inngest/functions/graph-extract.ts) and is intentionally NOT extracted here.
   */
  async extractAndPersistMemories(
    userId: string,
    notebookId: string,
    userMessage: string,
    assistantReply: string
  ): Promise<void> {
    try {
      logger.info({ userId, notebookId }, 'Starting background user memory extraction');

      await this.extractUserDeclarations(userId, notebookId, userMessage);
      await this.extractProceduralRules(userId, userMessage);
      await this.extractEpisodicSession(userId, notebookId, userMessage, assistantReply);

      logger.info({ userId, notebookId }, 'Completed user memory extraction');
    } catch (err) {
      logger.error({ err, userId, notebookId }, 'Error during user memory extraction');
    }
  }

  /**
   * Persist explicit user self-declarations to user_profile memory.
   * Matches patterns like "I am…", "My name is…", "I prefer…", "Remember that…"
   */
  private async extractUserDeclarations(userId: string, notebookId: string, userMessage: string): Promise<void> {
    const declarations = this.parseDeclarations(userMessage);
    if (declarations.length === 0) return;

    await this.memoryProvider.add(declarations, {
      userId,
      category: 'user_profile',
      metadata: { notebookId, source: 'user_declaration' },
    });
    logger.debug({ userId, count: declarations.length }, 'Persisted user declarations to user_profile memory');
  }

  /**
   * Persist explicit formatting/style preferences to procedural memory.
   */
  private async extractProceduralRules(userId: string, userMessage: string): Promise<void> {
    const lower = userMessage.toLowerCase();
    const isPreference =
      lower.includes('always ') ||
      lower.includes('format like') ||
      lower.includes('structure as') ||
      lower.includes('my preference is') ||
      lower.includes('please always') ||
      lower.includes('respond in');

    if (!isPreference) return;

    await this.memoryProvider.add(userMessage.trim(), {
      userId,
      category: 'procedural',
      metadata: { extractedAt: new Date().toISOString() },
    });
  }

  /**
   * Persist a session-level episodic summary.
   * Only saves when both sides of the conversation are substantive (> 60 chars)
   * to avoid polluting episodic memory with greetings and short exchanges.
   */
  private async extractEpisodicSession(
    userId: string,
    notebookId: string,
    userMessage: string,
    assistantReply: string
  ): Promise<void> {
    if (userMessage.trim().length < 60 || assistantReply.trim().length < 60) return;

    const summary = `Discussed: "${userMessage.slice(0, 120).trim()}"`;
    await this.memoryProvider.add(summary, {
      userId,
      category: 'episodic',
      metadata: { notebookId, timestamp: new Date().toISOString() },
    });
  }

  private parseDeclarations(text: string): string[] {
    const lines = text.split(/[.\n]/).map((l) => l.trim()).filter((l) => l.length > 10);
    const patterns = [
      /^(i am|i'm|i work as|my name is|i prefer|i like|i dislike|i need|my role is)/i,
      /(remember that|please note that|keep in mind that)/i,
    ];
    return lines.filter((l) => patterns.some((p) => p.test(l)));
  }
}
