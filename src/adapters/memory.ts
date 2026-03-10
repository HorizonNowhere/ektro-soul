import type { Memory, MemoryRelation, MemoryQuery } from "../types";
import { LAYER_CATEGORIES } from "../types";
import type { StorageAdapter, MemoryInsert, RelationInsert } from "./types";

export class InMemoryAdapter implements StorageAdapter {
  private memories = new Map<string, Memory>();
  private relations = new Map<string, MemoryRelation>();

  async initialize(): Promise<void> {
    // No-op for in-memory
  }

  async close(): Promise<void> {
    this.memories.clear();
    this.relations.clear();
  }

  async insertMemories(inputs: MemoryInsert[]): Promise<Memory[]> {
    const now = new Date().toISOString();
    const results: Memory[] = [];

    for (const input of inputs) {
      const memory: Memory = {
        ...input,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
      };
      this.memories.set(memory.id, memory);
      results.push(memory);
    }

    return results;
  }

  async queryMemories(query: MemoryQuery): Promise<Memory[]> {
    let results = Array.from(this.memories.values());
    const now = new Date().toISOString();

    if (query.entityId) {
      results = results.filter((m) => m.entityId === query.entityId);
    }
    if (query.type) {
      results = results.filter((m) => m.type === query.type);
    }
    if (query.category) {
      results = results.filter((m) => m.category === query.category);
    }
    if (query.layer) {
      const categories = LAYER_CATEGORIES[query.layer];
      results = results.filter((m) => {
        if (query.layer === "soul") {
          return m.isConstitutional && categories.includes(m.category);
        }
        return categories.includes(m.category);
      });
    }
    if (query.isConstitutional !== undefined) {
      results = results.filter((m) => m.isConstitutional === query.isConstitutional);
    }
    if (query.olderThan) {
      results = results.filter((m) => m.createdAt < query.olderThan!);
    }
    if (query.excludeExpired) {
      results = results.filter(
        (m) => m.expiresAt === null || m.expiresAt > now
      );
    }

    // Sort
    const order = query.order ?? "desc";
    results.sort((a, b) => {
      const cmp = a.createdAt.localeCompare(b.createdAt);
      return order === "asc" ? cmp : -cmp;
    });

    // Limit
    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  async updateMemory(id: string, updates: Partial<Memory>): Promise<Memory> {
    const existing = this.memories.get(id);
    if (!existing) {
      throw new Error(`Memory not found: ${id}`);
    }
    const updated: Memory = {
      ...existing,
      ...updates,
      id: existing.id, // Prevent ID override
      updatedAt: new Date().toISOString(),
    };
    this.memories.set(id, updated);
    return updated;
  }

  async deleteMemories(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.memories.delete(id);
    }
    // Also delete related relations
    for (const [relId, rel] of this.relations) {
      if (ids.includes(rel.sourceMemoryId) || ids.includes(rel.targetMemoryId)) {
        this.relations.delete(relId);
      }
    }
  }

  async insertRelations(inputs: RelationInsert[]): Promise<MemoryRelation[]> {
    const now = new Date().toISOString();
    const results: MemoryRelation[] = [];

    for (const input of inputs) {
      // Dedup: find existing relation with same source + target
      const existingKey = Array.from(this.relations.entries()).find(
        ([, r]) =>
          r.sourceMemoryId === input.sourceMemoryId &&
          r.targetMemoryId === input.targetMemoryId
      );

      if (existingKey) {
        // Update existing
        const updated: MemoryRelation = {
          ...existingKey[1],
          relationType: input.relationType,
          strength: input.strength,
        };
        this.relations.set(existingKey[0], updated);
        results.push(updated);
      } else {
        // Insert new
        const relation: MemoryRelation = {
          ...input,
          id: crypto.randomUUID(),
          createdAt: now,
        };
        this.relations.set(relation.id, relation);
        results.push(relation);
      }
    }

    return results;
  }

  async queryRelations(memoryIds: string[]): Promise<MemoryRelation[]> {
    const idSet = new Set(memoryIds);
    return Array.from(this.relations.values()).filter(
      (r) => idSet.has(r.sourceMemoryId) || idSet.has(r.targetMemoryId)
    );
  }
}
