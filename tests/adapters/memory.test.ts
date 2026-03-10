import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryAdapter } from "../../src/adapters/memory";
import type { MemoryInsert, RelationInsert } from "../../src/adapters/types";

describe("InMemoryAdapter", () => {
  let adapter: InMemoryAdapter;

  beforeEach(async () => {
    adapter = new InMemoryAdapter();
    await adapter.initialize();
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

  // ─── Insert + Query ───────────────────────────────────────

  it("inserts and queries memories", async () => {
    const [mem] = await adapter.insertMemories([makeMemory()]);
    expect(mem.id).toBeDefined();
    expect(mem.content).toBe("Test memory");

    const results = await adapter.queryMemories({ entityId: "test-entity" });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(mem.id);
  });

  it("filters by category", async () => {
    await adapter.insertMemories([
      makeMemory({ category: "identity", content: "I am Ek" }),
      makeMemory({ category: "event", content: "Something happened" }),
    ]);

    const results = await adapter.queryMemories({ category: "identity" });
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe("I am Ek");
  });

  it("filters by type", async () => {
    await adapter.insertMemories([
      makeMemory({ type: "short_term" }),
      makeMemory({ type: "long_term" }),
    ]);

    const results = await adapter.queryMemories({ type: "short_term" });
    expect(results).toHaveLength(1);
  });

  it("filters by isConstitutional", async () => {
    await adapter.insertMemories([
      makeMemory({ isConstitutional: true, content: "constitutional" }),
      makeMemory({ isConstitutional: false, content: "normal" }),
    ]);

    const results = await adapter.queryMemories({ isConstitutional: true });
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe("constitutional");
  });

  it("filters by layer (soul)", async () => {
    await adapter.insertMemories([
      makeMemory({ category: "identity", isConstitutional: true, content: "soul" }),
      makeMemory({ category: "identity", isConstitutional: false, content: "not soul" }),
      makeMemory({ category: "event", content: "event" }),
    ]);

    const results = await adapter.queryMemories({ layer: "soul" });
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe("soul");
  });

  it("filters by layer (growth)", async () => {
    await adapter.insertMemories([
      makeMemory({ category: "cognition", content: "insight" }),
      makeMemory({ category: "skill", content: "typescript" }),
      makeMemory({ category: "event", content: "event" }),
    ]);

    const results = await adapter.queryMemories({ layer: "growth" });
    expect(results).toHaveLength(2);
  });

  it("filters by olderThan", async () => {
    const [old] = await adapter.insertMemories([makeMemory({ content: "old" })]);
    // Manually set old createdAt
    await adapter.updateMemory(old.id, { createdAt: "2025-01-01T00:00:00Z" } as never);
    await adapter.insertMemories([makeMemory({ content: "new" })]);

    const results = await adapter.queryMemories({ olderThan: "2026-01-01T00:00:00Z" });
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe("old");
  });

  it("excludes expired memories", async () => {
    await adapter.insertMemories([
      makeMemory({ expiresAt: "2020-01-01T00:00:00Z", content: "expired" }),
      makeMemory({ expiresAt: null, content: "no expiry" }),
      makeMemory({ expiresAt: "2099-01-01T00:00:00Z", content: "future expiry" }),
    ]);

    const results = await adapter.queryMemories({ excludeExpired: true });
    expect(results).toHaveLength(2);
    expect(results.map((m) => m.content).sort()).toEqual(["future expiry", "no expiry"]);
  });

  it("respects limit", async () => {
    await adapter.insertMemories([
      makeMemory({ content: "a" }),
      makeMemory({ content: "b" }),
      makeMemory({ content: "c" }),
    ]);

    const results = await adapter.queryMemories({ limit: 2 });
    expect(results).toHaveLength(2);
  });

  it("sorts by order", async () => {
    const [first] = await adapter.insertMemories([makeMemory({ content: "first" })]);
    await adapter.updateMemory(first.id, { createdAt: "2025-01-01T00:00:00Z" } as never);
    await adapter.insertMemories([makeMemory({ content: "second" })]);

    const asc = await adapter.queryMemories({ order: "asc" });
    expect(asc[0].content).toBe("first");

    const desc = await adapter.queryMemories({ order: "desc" });
    expect(desc[0].content).toBe("second");
  });

  // ─── Update ───────────────────────────────────────────────

  it("updates a memory", async () => {
    const [mem] = await adapter.insertMemories([makeMemory()]);
    const updated = await adapter.updateMemory(mem.id, { content: "updated" });
    expect(updated.content).toBe("updated");
    expect(updated.id).toBe(mem.id);
  });

  it("throws when updating non-existent memory", async () => {
    await expect(
      adapter.updateMemory("nonexistent", { content: "x" })
    ).rejects.toThrow("Memory not found");
  });

  // ─── Delete ───────────────────────────────────────────────

  it("deletes memories", async () => {
    const [mem] = await adapter.insertMemories([makeMemory()]);
    await adapter.deleteMemories([mem.id]);

    const results = await adapter.queryMemories({});
    expect(results).toHaveLength(0);
  });

  it("deletes related relations when memory is deleted", async () => {
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
    const relations = await adapter.queryRelations([m2.id]);
    expect(relations).toHaveLength(0);
  });

  // ─── Relations ────────────────────────────────────────────

  it("inserts and queries relations", async () => {
    const [m1, m2] = await adapter.insertMemories([
      makeMemory({ content: "a" }),
      makeMemory({ content: "b" }),
    ]);

    const [rel] = await adapter.insertRelations([{
      sourceMemoryId: m1.id,
      targetMemoryId: m2.id,
      relationType: "defines",
      strength: 0.8,
    }]);

    expect(rel.id).toBeDefined();
    expect(rel.strength).toBe(0.8);

    // Query by source
    const bySource = await adapter.queryRelations([m1.id]);
    expect(bySource).toHaveLength(1);

    // Query by target
    const byTarget = await adapter.queryRelations([m2.id]);
    expect(byTarget).toHaveLength(1);
  });

  it("deduplicates relations (same source + target updates)", async () => {
    const [m1, m2] = await adapter.insertMemories([
      makeMemory({ content: "a" }),
      makeMemory({ content: "b" }),
    ]);

    await adapter.insertRelations([{
      sourceMemoryId: m1.id,
      targetMemoryId: m2.id,
      relationType: "defines",
      strength: 0.5,
    }]);

    // Insert again with different strength
    await adapter.insertRelations([{
      sourceMemoryId: m1.id,
      targetMemoryId: m2.id,
      relationType: "shapes",
      strength: 0.9,
    }]);

    const relations = await adapter.queryRelations([m1.id]);
    expect(relations).toHaveLength(1);
    expect(relations[0].strength).toBe(0.9);
    expect(relations[0].relationType).toBe("shapes");
  });

  // ─── Close ────────────────────────────────────────────────

  it("clears all data on close", async () => {
    await adapter.insertMemories([makeMemory()]);
    await adapter.close();

    const results = await adapter.queryMemories({});
    expect(results).toHaveLength(0);
  });
});
