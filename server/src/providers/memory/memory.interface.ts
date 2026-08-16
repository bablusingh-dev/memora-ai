export interface MemoryItem {
  id: string;
  memory: string;
  userId?: string;
  agentId?: string;
  runId?: string;
  metadata?: Record<string, any>;
  score?: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  category?: 'user_profile' | 'semantic' | 'episodic' | 'procedural';
}

export interface MemoryAddOptions {
  userId?: string;
  agentId?: string;
  runId?: string;
  metadata?: Record<string, any>;
  category?: 'user_profile' | 'semantic' | 'episodic' | 'procedural';
}

export interface MemorySearchOptions {
  userId?: string;
  agentId?: string;
  runId?: string;
  limit?: number;
  threshold?: number;
  category?: 'user_profile' | 'semantic' | 'episodic' | 'procedural';
}

export interface IMemoryProvider {
  /**
   * Add a new memory or extract facts from text messages
   */
  add(content: string | string[], options?: MemoryAddOptions): Promise<MemoryItem[]>;

  /**
   * Search semantic / episodic / user memories by query
   */
  search(query: string, options?: MemorySearchOptions): Promise<MemoryItem[]>;

  /**
   * Retrieve all memories for a user or agent
   */
  getAll(options?: { userId?: string; agentId?: string; limit?: number }): Promise<MemoryItem[]>;

  /**
   * Get a specific memory by ID
   */
  get(memoryId: string): Promise<MemoryItem | null>;

  /**
   * Delete a memory item by ID
   */
  delete(memoryId: string): Promise<boolean>;

  /**
   * Reset / clear all memories for a specific user
   */
  reset(userId: string): Promise<boolean>;

  /**
   * Verify that the memory backend is reachable.
   * Throws if the service is down.
   */
  ping(): Promise<void>;
}
