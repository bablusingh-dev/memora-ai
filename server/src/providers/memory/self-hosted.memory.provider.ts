import { IMemoryProvider, MemoryItem, MemoryAddOptions, MemorySearchOptions } from './memory.interface.js';
import { logger } from '../../utils/logger.js';
import { env } from '../../config/env.js';
import crypto from 'crypto';

// See MEM0_REQUEST_TIMEOUT_MS in cloud.memory.provider.ts for the rationale
// — every call here now runs inside an Inngest step or a per-chat-turn
// retrieval branch, both of which need a bounded failure mode.
const MEM0_REQUEST_TIMEOUT_MS = 10000;

/**
 * Self-Hosted Memory Provider
 * Manages local semantic, episodic, user profile, and procedural memory.
 * Communicates with a self-hosted Mem0 OSS container (required — no in-memory fallback).
 */
export class SelfHostedMemoryProvider implements IMemoryProvider {
  private hostUrl: string;

  constructor(hostUrl = env.MEM0_HOST) {
    this.hostUrl = hostUrl;
  }

  /**
   * Verify that the Mem0 container is reachable.
   * Called once at server startup — throws if the service is down.
   */
  async ping(): Promise<void> {
    try {
      const res = await fetch(`${this.hostUrl}/v1/memories`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok && res.status !== 405) {
        throw new Error(`Mem0 responded with status ${res.status}`);
      }
    } catch (err) {
      throw new Error(`Self-hosted Mem0 service is unreachable at ${this.hostUrl}: ${(err as Error).message}`);
    }
  }

  async add(content: string | string[], options: MemoryAddOptions = {}): Promise<MemoryItem[]> {
    const userId = options.userId || 'default_user';
    const items: string[] = Array.isArray(content) ? content : [content];

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
      signal: AbortSignal.timeout(MEM0_REQUEST_TIMEOUT_MS),
    });

    if (!res.ok) {
      throw new Error(`Mem0 add failed: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    logger.info({ userId, count: data.length, category: options.category }, 'Added self-hosted memories');

    return data.map((m: any) => ({
      id: m.id || m.memory_id || crypto.randomUUID(),
      memory: m.memory || m.text || m.content,
      userId,
      category: options.category || 'semantic',
      metadata: m.metadata || options.metadata,
      createdAt: m.created_at || new Date(),
    }));
  }

  async search(query: string, options: MemorySearchOptions = {}): Promise<MemoryItem[]> {
    const userId = options.userId || 'default_user';
    const limit = options.limit || 5;

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
      signal: AbortSignal.timeout(MEM0_REQUEST_TIMEOUT_MS),
    });

    if (!res.ok) {
      throw new Error(`Mem0 search failed: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    if (!Array.isArray(data)) return [];

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

  async getAll(options: { userId?: string; agentId?: string; limit?: number } = {}): Promise<MemoryItem[]> {
    const userId = options.userId || 'default_user';

    const res = await fetch(`${this.hostUrl}/v1/memories?user_id=${userId}&limit=${options.limit ?? 100}`, {
      method: 'GET',
      signal: AbortSignal.timeout(MEM0_REQUEST_TIMEOUT_MS),
    });

    if (!res.ok) {
      throw new Error(`Mem0 getAll failed: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  async get(memoryId: string): Promise<MemoryItem | null> {
    const res = await fetch(`${this.hostUrl}/v1/memories/${memoryId}`, {
      signal: AbortSignal.timeout(MEM0_REQUEST_TIMEOUT_MS),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Mem0 get failed: ${res.status} ${res.statusText}`);
    return res.json() as Promise<MemoryItem>;
  }

  async delete(memoryId: string): Promise<boolean> {
    const res = await fetch(`${this.hostUrl}/v1/memories/${memoryId}`, {
      method: 'DELETE',
      signal: AbortSignal.timeout(MEM0_REQUEST_TIMEOUT_MS),
    });
    if (res.status === 404) return false;
    if (!res.ok) throw new Error(`Mem0 delete failed: ${res.status} ${res.statusText}`);
    return true;
  }

  async reset(userId: string): Promise<boolean> {
    const res = await fetch(`${this.hostUrl}/v1/memories?user_id=${userId}`, {
      method: 'DELETE',
      signal: AbortSignal.timeout(MEM0_REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Mem0 reset failed: ${res.status} ${res.statusText}`);
    return true;
  }
}
