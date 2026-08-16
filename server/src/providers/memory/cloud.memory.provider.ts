import { IMemoryProvider, MemoryItem, MemoryAddOptions, MemorySearchOptions } from './memory.interface.js';
import { logger } from '../../utils/logger.js';
import { env } from '../../config/env.js';

/**
 * Cloud Memory Provider (Mem0 Cloud API)
 * Zero-code switchable when MEMORY_PROVIDER=mem0_cloud
 */
export class CloudMemoryProvider implements IMemoryProvider {
  private apiKey: string;
  private baseUrl = 'https://api.mem0.ai/v1';

  constructor(apiKey = env.MEM0_API_KEY || '') {
    this.apiKey = apiKey;
    if (!this.apiKey) {
      logger.warn('MEM0_API_KEY is not configured while using mem0_cloud provider');
    }
  }

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Token ${this.apiKey}`,
    };
  }

  async add(content: string | string[], options: MemoryAddOptions = {}): Promise<MemoryItem[]> {
    const messages = (Array.isArray(content) ? content : [content]).map((text) => ({
      role: 'user',
      content: text,
    }));

    try {
      const res = await fetch(`${this.baseUrl}/memories/`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          messages,
          user_id: options.userId,
          agent_id: options.agentId,
          run_id: options.runId,
          metadata: {
            ...options.metadata,
            category: options.category || 'semantic',
          },
        }),
      });

      if (!res.ok) {
        throw new Error(`Mem0 Cloud API error: ${res.statusText}`);
      }

      const data = await res.json();
      return Array.isArray(data)
        ? data.map((m: any) => ({
            id: m.id,
            memory: m.memory,
            userId: m.user_id,
            category: options.category || 'semantic',
            metadata: m.metadata,
            createdAt: m.created_at,
          }))
        : [];
    } catch (error) {
      logger.error({ error }, 'Failed to add memory to Mem0 Cloud');
      throw error;
    }
  }

  async search(query: string, options: MemorySearchOptions = {}): Promise<MemoryItem[]> {
    try {
      const res = await fetch(`${this.baseUrl}/memories/search/`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          query,
          user_id: options.userId,
          agent_id: options.agentId,
          run_id: options.runId,
          limit: options.limit || 5,
        }),
      });

      if (!res.ok) {
        throw new Error(`Mem0 Cloud search error: ${res.statusText}`);
      }

      const data = await res.json();
      return Array.isArray(data)
        ? data.map((m: any) => ({
            id: m.id,
            memory: m.memory,
            userId: m.user_id,
            score: m.score,
            category: m.metadata?.category || options.category || 'semantic',
            metadata: m.metadata,
            createdAt: m.created_at,
          }))
        : [];
    } catch (error) {
      logger.error({ error }, 'Failed to search Mem0 Cloud memories');
      return [];
    }
  }

  async getAll(options: { userId?: string; agentId?: string; limit?: number } = {}): Promise<MemoryItem[]> {
    try {
      const url = new URL(`${this.baseUrl}/memories/`);
      if (options.userId) url.searchParams.set('user_id', options.userId);
      if (options.agentId) url.searchParams.set('agent_id', options.agentId);

      const res = await fetch(url.toString(), {
        headers: this.getHeaders(),
      });

      if (!res.ok) {
        throw new Error(`Mem0 Cloud getAll error: ${res.statusText}`);
      }

      const data = await res.json();
      return Array.isArray(data)
        ? data.map((m: any) => ({
            id: m.id,
            memory: m.memory,
            userId: m.user_id,
            category: m.metadata?.category || 'semantic',
            metadata: m.metadata,
            createdAt: m.created_at,
          }))
        : [];
    } catch (error) {
      logger.error({ error }, 'Failed to retrieve all memories from Mem0 Cloud');
      return [];
    }
  }

  async get(memoryId: string): Promise<MemoryItem | null> {
    try {
      const res = await fetch(`${this.baseUrl}/memories/${memoryId}/`, {
        headers: this.getHeaders(),
      });
      if (!res.ok) return null;
      const m: any = await res.json();
      return {
        id: m.id,
        memory: m.memory,
        userId: m.user_id,
        category: m.metadata?.category || 'semantic',
        metadata: m.metadata,
        createdAt: m.created_at,
      };
    } catch (error) {
      return null;
    }
  }

  async delete(memoryId: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/memories/${memoryId}/`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
      return res.ok;
    } catch (error) {
      return false;
    }
  }

  async reset(userId: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/memories/`, {
        method: 'DELETE',
        headers: this.getHeaders(),
        body: JSON.stringify({ user_id: userId }),
      });
      return res.ok;
    } catch (error) {
      return false;
    }
  }

  async ping(): Promise<void> {
    if (!this.apiKey || this.apiKey.includes('placeholder')) {
      throw new Error('MEM0_API_KEY is not set in .env. Please add MEM0_API_KEY=m0-your-api-key-here to use Mem0 Cloud memory.');
    }
    const res = await fetch(`${this.baseUrl}/memories/?user_id=system_ping&limit=1`, {
      method: 'GET',
      headers: this.getHeaders(),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok && res.status !== 404) {
      throw new Error(`Mem0 Cloud API error: ${res.status} ${res.statusText}`);
    }
  }
}

