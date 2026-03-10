import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryAdapter } from "../src/adapters/memory";
import { consolidateMemories } from "../src/consolidator";
import type { ModelProvider } from "../src/types";

describe("consolidateMemories", () => {
  let adapter: InMemoryAdapter;

  const mockModel: ModelProvider = {
    extract: async () => ({ memories: [] }),
    consolidate: async (_prompt, schema) => {
      // Check which schema is being used by trying to parse both formats
      const schemaShape = (schema as { shape?: Record<string, unknown> }).shape;
      if (schemaShape && "insight" in schemaShape) {
        return { insight: "[Jan 2025] I learned something important" } as never;
      }
      return { summary: "Various events occurred" } as never;
    },
  };

  const defaultConfig = {
    consolidationAgeDays: 30,
    salienceThreshold: 0.7,
    maxCandidatesPerRun: 100,
  };

  // Helper: insert old event memories
  async function insertOldEvents(count: number, adapter: InMemoryAdapter) {
    const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(); // 60 days ago
    const memories = Array.from({ length: count }, (_, i) => ({
      entityId: "ek-001",
      type: "long_term" as const,
      category: "event" as const,
      content: `Event ${i + 1}`,
      metadata: {},
      isConstitutional: false,
      expiresAt: null,
    }));

    const inserted = await adapter.insertMemories(memories);
    // Manually backdate
    for (const m of inserted) {
      await adapter.updateMemory(m.id, { createdAt: oldDate } as never);
    }
    return inserted;
  }

  beforeEach(async () => {
    adapter = new InMemoryAdapter();
    await adapter.initialize();
  });

  it("returns zero result when no candidates", async () => {
    const result = await consolidateMemories("ek-001", adapter, mockModel, defaultConfig);
    expect(result).toEqual({ promoted: 0, compressed: 0, deleted: 0, skipped: 0 });
  });

  it("skips memories younger than threshold", async () => {
    // Insert recent event (not old enough)
    await adapter.insertMemories([{
      entityId: "ek-001",
      type: "long_term",
      category: "event",
      content: "Recent event",
      metadata: {},
      isConstitutional: false,
      expiresAt: null,
    }]);

    const result = await consolidateMemories("ek-001", adapter, mockModel, defaultConfig);
    expect(result.deleted).toBe(0);
  });

  it("never touches constitutional memories", async () => {
    // Insert old constitutional memory
    const [constitutional] = await adapter.insertMemories([{
      entityId: "ek-001",
      type: "long_term",
      category: "identity",
      content: "I am Ek",
      metadata: { importance: 5 },
      isConstitutional: true,
      expiresAt: null,
    }]);
    const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    await adapter.updateMemory(constitutional.id, { createdAt: oldDate } as never);

    const result = await consolidateMemories("ek-001", adapter, mockModel, defaultConfig);
    expect(result.deleted).toBe(0);

    // Constitutional memory still exists
    const remaining = await adapter.queryMemories({ isConstitutional: true });
    expect(remaining).toHaveLength(1);
  });

  it("compresses low-salience memories (no relations → strength 0)", async () => {
    const inserted = await insertOldEvents(3, adapter);

    const result = await consolidateMemories("ek-001", adapter, mockModel, defaultConfig);

    expect(result.compressed).toBe(1);
    expect(result.deleted).toBe(3);

    // Original events deleted
    const events = await adapter.queryMemories({ category: "event", entityId: "ek-001" });
    // Should have 1 compressed episodic summary
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("episodic");
    expect(events[0].content).toContain("Various events occurred");
  });

  it("promotes high-salience memories (relations with high strength)", async () => {
    const inserted = await insertOldEvents(3, adapter);

    // Add high-strength relations
    for (let i = 0; i < inserted.length - 1; i++) {
      await adapter.insertRelations([{
        sourceMemoryId: inserted[i].id,
        targetMemoryId: inserted[i + 1].id,
        relationType: "shapes",
        strength: 0.9, // > 0.7 threshold
      }]);
    }

    const result = await consolidateMemories("ek-001", adapter, mockModel, defaultConfig);

    expect(result.promoted).toBe(1);
    expect(result.deleted).toBe(3);

    // Should have a new cognition memory
    const cognition = await adapter.queryMemories({ category: "cognition", entityId: "ek-001" });
    expect(cognition).toHaveLength(1);
    expect(cognition[0].type).toBe("long_term");
  });

  it("handles model failure gracefully (skips group)", async () => {
    await insertOldEvents(3, adapter);

    const failModel: ModelProvider = {
      extract: async () => ({ memories: [] }),
      consolidate: async () => { throw new Error("Model failed"); },
    };

    const result = await consolidateMemories("ek-001", adapter, failModel, defaultConfig);

    expect(result.skipped).toBe(3);
    expect(result.deleted).toBe(0);

    // Original memories still exist
    const remaining = await adapter.queryMemories({ entityId: "ek-001" });
    expect(remaining).toHaveLength(3);
  });

  it("respects maxCandidatesPerRun", async () => {
    await insertOldEvents(5, adapter);

    const result = await consolidateMemories("ek-001", adapter, mockModel, {
      ...defaultConfig,
      maxCandidatesPerRun: 3,
    });

    // Only 3 processed, 2 remaining
    expect(result.deleted).toBe(3);

    const remaining = await adapter.queryMemories({ entityId: "ek-001", category: "event" });
    // 2 original + 1 compressed = 3
    expect(remaining.filter((m) => m.type !== "episodic")).toHaveLength(2);
  });
});
