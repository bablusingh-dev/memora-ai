import { IMemoryProvider, MemoryItem, MemoryAddOptions, MemorySearchOptions } from './memory.interface.js';
import { logger } from '../../utils/logger.js';
import { env } from '../../config/env.js';
import crypto from 'crypto';

/**
 * Self-Hosted Memory Provider
 * Manages local semantic, episodic, user profile, and procedural memory.
 * Communicates with self-hosted Mem0 OSS container or operates with local persistent store.
 */
export class SelfHostedMemoryProvider implements IMemoryProvider {
  private localStore: Map<string, MemoryItem[]> = new Map();
  private hostUrl: string;

  constructor(hostUrl = env.MEM0_HOST) {
    this.hostUrl = hostUrl;
  }

  async add(content: string | string[], options: MemoryAddOptions = {}): Promise<MemoryItem[]> {
    const userId = options.userId || 'default_user';
    const items: string[] = Array.isArray(content) ? content : [content];
    const created: MemoryItem[] = [];

    // Try communicating with self-hosted Mem0 container if running
    try {
      const res = await fetch(`${this.hostUrl}/v1/memories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: items.map((text) => ({ role: 'user', content: text })),
          user_id: userId,
          agent_id: options.agentId,
          run_id: options.runId,
          metadata: {
            ...options.metadata,
            category: options.category || 'semantic',
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          return data.map((m: any) => ({
            id: m.id || m.memory_id || crypto.randomUUID(),
            memory: m.memory || m.text || m.content,
            userId,
            category: options.category || 'semantic',
            metadata: m.metadata || options.metadata,
            createdAt: m.created_at || new Date(),
          }));
        }
      }
    } catch (err) {
      logger.debug({ err }, 'Self-hosted Mem0 service offline, falling back to embedded local memory store');
    }

    // Embedded fallback store for self-hosted execution
    const userMemories = this.localStore.get(userId) || [];
    for (const text of items) {
      if (!text || !text.trim()) continue;
      const memItem: MemoryItem = {
        id: crypto.randomUUID(),
        memory: text.trim(),
        userId,
        agentId: options.agentId,
        runId: options.runId,
        category: options.category || 'semantic',
        metadata: options.metadata || {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      userMemories.push(memItem);
      created.push(memItem);
    }
    this.localStore.set(userId, userMemories);

    logger.info({ userId, count: created.length, category: options.category }, 'Added self-hosted memories');
    return created;
  }

  async search(query: string, options: MemorySearchOptions = {}): Promise<MemoryItem[]> {
    const userId = options.userId || 'default_user';
    const limit = options.limit || 5;

    // Try self-hosted Mem0 container first
    try {
      const res = await fetch(`${this.hostUrl}/v1/memories/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          user_id: userId,
          agent_id: options.agentId,
          run_id: options.runId,
          limit,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          return data.map((m: any) => ({
            id: m.id || m.memory_id || crypto.randomUUID(),
            memory: m.memory || m.text || m.content,
            userId,
            score: m.score || 1.0,
            category: m.metadata?.category || options.category || 'semantic',
            metadata: m.metadata,
            createdAt: m.created_at,
          }));
        }
      }
    } catch (err) {
      logger.debug({ err }, 'Mem0 container search failed, querying local memory store');
    }

    // Local heuristic search (keyword overlap & semantic token matching)
    const userMemories = this.localStore.get(userId) || [];
    const queryTokens = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);

    const scored = userMemories
      .filter((m) => !options.category || m.category === options.category)
      .map((m) => {
        const memText = m.memory.toLowerCase();
        let matchCount = 0;
        for (const token of queryTokens) {
          if (memText.includes(token)) matchCount++;
        }
        const score = queryTokens.length > 0 ? matchCount / queryTokens.length : 0.5;
        return { ...m, score };
      })
      .filter((m) => (m.score || 0) > (options.threshold || 0.1))
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, limit);

    return scored;
  }

  async getAll(options: { userId?: string; agentId?: string; limit?: number } = {}): Promise<MemoryItem[]> {
    const userId = options.userId || 'default_user';
    const memories = this.localStore.get(userId) || [];
    return options.limit ? memories.slice(0, options.limit) : memories;
  }

  async get(memoryId: string): Promise<MemoryItem | null> {
    for (const [, memories] of this.localStore.entries()) {
      const found = memories.find((m) => m.id === memoryId);
      if (found) return found;
    }
    return null;
  }

  async delete(memoryId: string): Promise<boolean> {
    for (const [userId, memories] of this.localStore.entries()) {
      const idx = memories.findIndex((m) => m.id === memoryId);
      if (idx !== -1) {
        memories.splice(idx, 1);
        this.localStore.set(userId, memories);
        return true;
      }
    }
    return false;
  }

  async reset(userId: string): Promise<boolean> {
    this.localStore.delete(userId);
    return true;
  }
}
