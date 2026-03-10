import type { Memory, MemoryRelation, MemoryQuery } from "../types";

export type MemoryInsert = Omit<Memory, "id" | "createdAt" | "updatedAt">;
export type RelationInsert = Omit<MemoryRelation, "id" | "createdAt">;

export interface StorageAdapter {
  // Memory CRUD
  insertMemories(memories: MemoryInsert[]): Promise<Memory[]>;
  queryMemories(query: MemoryQuery): Promise<Memory[]>;
  updateMemory(id: string, updates: Partial<Memory>): Promise<Memory>;
  deleteMemories(ids: string[]): Promise<void>;

  // Relation CRUD
  insertRelations(relations: RelationInsert[]): Promise<MemoryRelation[]>;
  queryRelations(memoryIds: string[]): Promise<MemoryRelation[]>;

  // Lifecycle
  initialize(): Promise<void>;
  close(): Promise<void>;
}
