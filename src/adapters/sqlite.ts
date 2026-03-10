import type Database from "better-sqlite3";
import type { Memory, MemoryRelation, MemoryQuery } from "../types";
import { LAYER_CATEGORIES } from "../types";
import type { StorageAdapter, MemoryInsert, RelationInsert } from "./types";

export class SQLiteAdapter implements StorageAdapter {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async initialize(): Promise<void> {
    const BetterSqlite3 = (await import("better-sqlite3")).default;
    this.db = new BetterSqlite3(this.dbPath);
    this.db.pragma("journal_mode = WAL");
    this.createTables();
  }

  async close(): Promise<void> {
    this.db?.close();
    this.db = null;
  }

  private getDb(): Database.Database {
    if (!this.db) throw new Error("SQLiteAdapter not initialized. Call initialize() first.");
    return this.db;
  }

  private createTables(): void {
    const db = this.getDb();
    db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL,
        type TEXT NOT NULL,
        category TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT NOT NULL DEFAULT '{}',
        is_constitutional INTEGER NOT NULL DEFAULT 0,
        expires_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_memories_entity ON memories(entity_id);
      CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category);
      CREATE INDEX IF NOT EXISTS idx_memories_constitutional ON memories(entity_id, is_constitutional)
        WHERE is_constitutional = 1;

      CREATE TABLE IF NOT EXISTS memory_relations (
        id TEXT PRIMARY KEY,
        source_memory_id TEXT NOT NULL,
        target_memory_id TEXT NOT NULL,
        relation_type TEXT NOT NULL,
        strength REAL NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(source_memory_id, target_memory_id)
      );

      CREATE INDEX IF NOT EXISTS idx_relations_source ON memory_relations(source_memory_id);
      CREATE INDEX IF NOT EXISTS idx_relations_target ON memory_relations(target_memory_id);
    `);
  }

  // ─── Memory CRUD ──────────────────────────────────────────

  async insertMemories(inputs: MemoryInsert[]): Promise<Memory[]> {
    const db = this.getDb();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO memories (id, entity_id, type, category, content, metadata, is_constitutional, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const results: Memory[] = [];
    const insert = db.transaction(() => {
      for (const input of inputs) {
        const id = crypto.randomUUID();
        stmt.run(
          id,
          input.entityId,
          input.type,
          input.category,
          input.content,
          JSON.stringify(input.metadata),
          input.isConstitutional ? 1 : 0,
          input.expiresAt,
          now,
          now
        );
        results.push({
          ...input,
          id,
          createdAt: now,
          updatedAt: now,
        });
      }
    });
    insert();
    return results;
  }

  async queryMemories(query: MemoryQuery): Promise<Memory[]> {
    const db = this.getDb();
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.entityId) {
      conditions.push("entity_id = ?");
      params.push(query.entityId);
    }
    if (query.type) {
      conditions.push("type = ?");
      params.push(query.type);
    }
    if (query.category) {
      conditions.push("category = ?");
      params.push(query.category);
    }
    if (query.layer) {
      const categories = LAYER_CATEGORIES[query.layer];
      const placeholders = categories.map(() => "?").join(", ");
      conditions.push(`category IN (${placeholders})`);
      params.push(...categories);
      if (query.layer === "soul") {
        conditions.push("is_constitutional = 1");
      }
    }
    if (query.isConstitutional !== undefined) {
      conditions.push("is_constitutional = ?");
      params.push(query.isConstitutional ? 1 : 0);
    }
    if (query.olderThan) {
      conditions.push("created_at < ?");
      params.push(query.olderThan);
    }
    if (query.excludeExpired) {
      const now = new Date().toISOString();
      conditions.push("(expires_at IS NULL OR expires_at > ?)");
      params.push(now);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const order = query.order === "asc" ? "ASC" : "DESC";
    const limit = query.limit ? `LIMIT ${query.limit}` : "";

    const sql = `SELECT * FROM memories ${where} ORDER BY created_at ${order} ${limit}`;
    const rows = db.prepare(sql).all(...params) as SqliteMemoryRow[];

    return rows.map(rowToMemory);
  }

  async updateMemory(id: string, updates: Partial<Memory>): Promise<Memory> {
    const db = this.getDb();
    const existing = db.prepare("SELECT * FROM memories WHERE id = ?").get(id) as SqliteMemoryRow | undefined;
    if (!existing) throw new Error(`Memory not found: ${id}`);

    const sets: string[] = [];
    const params: unknown[] = [];

    if (updates.content !== undefined) { sets.push("content = ?"); params.push(updates.content); }
    if (updates.category !== undefined) { sets.push("category = ?"); params.push(updates.category); }
    if (updates.type !== undefined) { sets.push("type = ?"); params.push(updates.type); }
    if (updates.metadata !== undefined) { sets.push("metadata = ?"); params.push(JSON.stringify(updates.metadata)); }
    if (updates.isConstitutional !== undefined) { sets.push("is_constitutional = ?"); params.push(updates.isConstitutional ? 1 : 0); }
    if (updates.expiresAt !== undefined) { sets.push("expires_at = ?"); params.push(updates.expiresAt); }

    sets.push("updated_at = ?");
    params.push(new Date().toISOString());
    params.push(id);

    db.prepare(`UPDATE memories SET ${sets.join(", ")} WHERE id = ?`).run(...params);

    const updated = db.prepare("SELECT * FROM memories WHERE id = ?").get(id) as SqliteMemoryRow;
    return rowToMemory(updated);
  }

  async deleteMemories(ids: string[]): Promise<void> {
    if (!ids.length) return;
    const db = this.getDb();
    const placeholders = ids.map(() => "?").join(", ");
    db.prepare(`DELETE FROM memory_relations WHERE source_memory_id IN (${placeholders}) OR target_memory_id IN (${placeholders})`).run(...ids, ...ids);
    db.prepare(`DELETE FROM memories WHERE id IN (${placeholders})`).run(...ids);
  }

  // ─── Relation CRUD ────────────────────────────────────────

  async insertRelations(inputs: RelationInsert[]): Promise<MemoryRelation[]> {
    const db = this.getDb();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO memory_relations (id, source_memory_id, target_memory_id, relation_type, strength, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(source_memory_id, target_memory_id)
      DO UPDATE SET relation_type = excluded.relation_type, strength = excluded.strength
    `);

    const results: MemoryRelation[] = [];
    const insert = db.transaction(() => {
      for (const input of inputs) {
        const id = crypto.randomUUID();
        stmt.run(id, input.sourceMemoryId, input.targetMemoryId, input.relationType, input.strength, now);
        results.push({
          id,
          sourceMemoryId: input.sourceMemoryId,
          targetMemoryId: input.targetMemoryId,
          relationType: input.relationType,
          strength: input.strength,
          createdAt: now,
        });
      }
    });
    insert();
    return results;
  }

  async queryRelations(memoryIds: string[]): Promise<MemoryRelation[]> {
    if (!memoryIds.length) return [];
    const db = this.getDb();
    const placeholders = memoryIds.map(() => "?").join(", ");
    const sql = `SELECT * FROM memory_relations WHERE source_memory_id IN (${placeholders}) OR target_memory_id IN (${placeholders})`;
    const rows = db.prepare(sql).all(...memoryIds, ...memoryIds) as SqliteRelationRow[];
    return rows.map(rowToRelation);
  }
}

// ─── Row Mapping ──────────────────────────────────────────────

interface SqliteMemoryRow {
  id: string;
  entity_id: string;
  type: string;
  category: string;
  content: string;
  metadata: string;
  is_constitutional: number;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

interface SqliteRelationRow {
  id: string;
  source_memory_id: string;
  target_memory_id: string;
  relation_type: string;
  strength: number;
  created_at: string;
}

function rowToMemory(row: SqliteMemoryRow): Memory {
  return {
    id: row.id,
    entityId: row.entity_id,
    type: row.type as Memory["type"],
    category: row.category as Memory["category"],
    content: row.content,
    metadata: JSON.parse(row.metadata),
    isConstitutional: row.is_constitutional === 1,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToRelation(row: SqliteRelationRow): MemoryRelation {
  return {
    id: row.id,
    sourceMemoryId: row.source_memory_id,
    targetMemoryId: row.target_memory_id,
    relationType: row.relation_type as MemoryRelation["relationType"],
    strength: row.strength,
    createdAt: row.created_at,
  };
}
