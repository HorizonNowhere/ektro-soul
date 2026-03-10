import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SQLiteAdapter } from "../../src/adapters/sqlite";
import type { MemoryInsert } from "../../src/adapters/types";
import { existsSync, unlinkSync } from "fs";

const TEST_DB = "/tmp/ektro-soul-test.db";

describe("SQLiteAdapter", () => {
  let adapter: SQLiteAdapter;

  beforeEach(async () => {
    // Clean up any existing test db
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
    adapter = new SQLiteAdapter(TEST_DB);
    await adapter.initialize();
  });

  afterEach(async () => {
    await adapter.close();
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
    // Also clean WAL/SHM files
    if (existsSync(TEST_DB + "-wal")) unlinkSync(TEST_DB + "-wal");
    if (existsSync(TEST_DB + "-shm")) unlinkSync(TEST_DB + "-shm");
  });

  const makeMemory = (overrides: Partial<MemoryInsert> = {}): MemoryInsert => ({
    entityId: "test-entity",
    type: "long_term",
    category: "event",
    content: "Test memory",
    metadata: {},
    isConstitutional: false,
    expiresAt: null,
    ...overrides,
  });

  // ─── Basic CRUD ───────────────────────────────────────────

  it("creates database file on initialize", () => {
    expect(existsSync(TEST_DB)).toBe(true);
  });

  it("inserts and queries memories", async () => {
    const [mem] = await adapter.insertMemories([makeMemory()]);
    expect(mem.id).toBeDefined();

    const results = await adapter.queryMemories({ entityId: "test-entity" });
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe("Test memory");
  });

  it("filters by category", async () => {
    await adapter.insertMemories([
      makeMemory({ category: "identity", content: "I am Ek" }),
      makeMemory({ category: "event", content: "Event" }),
    ]);

    const results = await adapter.queryMemories({ category: "identity" });
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe("I am Ek");
  });

  it("filters by layer", async () => {
    await adapter.insertMemories([
      makeMemory({ category: "cognition", content: "insight" }),
      makeMemory({ category: "skill", content: "typescript" }),
      makeMemory({ category: "event", content: "event" }),
    ]);

    const results = await adapter.queryMemories({ layer: "growth" });
    expect(results).toHaveLength(2);
  });

  it("filters by isConstitutional", async () => {
    await adapter.insertMemories([
      makeMemory({ isConstitutional: true, content: "core" }),
      makeMemory({ isConstitutional: false, content: "normal" }),
    ]);

    const results = await adapter.queryMemories({ isConstitutional: true });
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe("core");
  });

  it("respects limit and order", async () => {
    await adapter.insertMemories([
      makeMemory({ content: "a" }),
      makeMemory({ content: "b" }),
      makeMemory({ content: "c" }),
    ]);

    const results = await adapter.queryMemories({ limit: 2, order: "desc" });
    expect(results).toHaveLength(2);
  });

  it("excludes expired memories", async () => {
    await adapter.insertMemories([
      makeMemory({ expiresAt: "2020-01-01T00:00:00Z", content: "expired" }),
      makeMemory({ expiresAt: null, content: "no expiry" }),
    ]);

    const results = await adapter.queryMemories({ excludeExpired: true });
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe("no expiry");
  });

  // ─── Update ───────────────────────────────────────────────

  it("updates a memory", async () => {
    const [mem] = await adapter.insertMemories([makeMemory()]);
    const updated = await adapter.updateMemory(mem.id, { content: "updated" });
    expect(updated.content).toBe("updated");
  });

  it("throws when updating non-existent memory", async () => {
    await expect(
      adapter.updateMemory("nonexistent", { content: "x" })
    ).rejects.toThrow("Memory not found");
  });

  // ─── Delete ───────────────────────────────────────────────

  it("deletes memories and their relations", async () => {
    const [m1, m2] = await adapter.insertMemories([
      makeMemory({ content: "a" }),
      makeMemory({ content: "b" }),
    ]);
    await adapter.insertRelations([{
      sourceMemoryId: m1.id,
      targetMemoryId: m2.id,
      relationType: "shapes",
      strength: 0.5,
    }]);

    await adapter.deleteMemories([m1.id]);

    const memories = await adapter.queryMemories({});
    expect(memories).toHaveLength(1);

    const relations = await adapter.queryRelations([m2.id]);
    expect(relations).toHaveLength(0);
  });

  // ─── Relations ────────────────────────────────────────────

  it("inserts and queries relations", async () => {
    const [m1, m2] = await adapter.insertMemories([
      makeMemory({ content: "a" }),
      makeMemory({ content: "b" }),
    ]);

    await adapter.insertRelations([{
      sourceMemoryId: m1.id,
      targetMemoryId: m2.id,
      relationType: "defines",
      strength: 0.8,
    }]);

    const bySource = await adapter.queryRelations([m1.id]);
    expect(bySource).toHaveLength(1);
    expect(bySource[0].strength).toBe(0.8);

    const byTarget = await adapter.queryRelations([m2.id]);
    expect(byTarget).toHaveLength(1);
  });

  it("deduplicates relations on conflict", async () => {
    const [m1, m2] = await adapter.insertMemories([
      makeMemory({ content: "a" }),
      makeMemory({ content: "b" }),
    ]);

    await adapter.insertRelations([{
      sourceMemoryId: m1.id, targetMemoryId: m2.id,
      relationType: "defines", strength: 0.5,
    }]);
    await adapter.insertRelations([{
      sourceMemoryId: m1.id, targetMemoryId: m2.id,
      relationType: "shapes", strength: 0.9,
    }]);

    const relations = await adapter.queryRelations([m1.id]);
    expect(relations).toHaveLength(1);
    expect(relations[0].strength).toBe(0.9);
  });

  // ─── Persistence ──────────────────────────────────────────

  it("persists data across instances", async () => {
    await adapter.insertMemories([makeMemory({ content: "persistent" })]);
    await adapter.close();

    const adapter2 = new SQLiteAdapter(TEST_DB);
    await adapter2.initialize();
    const results = await adapter2.queryMemories({});
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe("persistent");
    await adapter2.close();
  });

  // ─── Metadata ─────────────────────────────────────────────

  it("serializes and deserializes metadata", async () => {
    const [mem] = await adapter.insertMemories([
      makeMemory({ metadata: { importance: 5, tags: ["core", "identity"] } }),
    ]);

    const results = await adapter.queryMemories({});
    expect(results[0].metadata).toEqual({ importance: 5, tags: ["core", "identity"] });
  });
});
