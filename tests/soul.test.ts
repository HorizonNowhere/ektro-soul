import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createSoul, Soul } from "../src/index";
import { InMemoryAdapter } from "../src/adapters/memory";
import type { ModelProvider } from "../src/types";

describe("Soul (integration)", () => {
  let soul: Soul;
  let adapter: InMemoryAdapter;

  const mockModel: ModelProvider = {
    extract: async () => ({
      memories: [
        { type: "long_term", content: "I am Ek, the AI CEO", importance: 5, category: "identity", tags: ["core"] },
        { type: "long_term", content: "User likes minimalism", importance: 3, category: "aesthetic", tags: ["pref"] },
        { type: "short_term", content: "Discussed pricing", importance: 2, category: "event", tags: ["meeting"] },
      ],
    }),
    consolidate: async () => ({ summary: "Various things happened", insight: "I learned something" }),
  };

  beforeEach(async () => {
    adapter = new InMemoryAdapter();
    soul = createSoul({
      entityId: "ek-001",
      storage: adapter,
      model: mockModel,
    });
  });

  afterEach(async () => {
    await soul.close();
  });

  // ─── extract ──────────────────────────────────────────────

  it("extracts memories from conversation", async () => {
    const ids = await soul.extract({
      messages: [
        { role: "user", content: "I am the founder" },
        { role: "assistant", content: "Nice to meet you" },
      ],
    });

    expect(ids.length).toBeGreaterThan(0);
  });

  // ─── remember + recall ────────────────────────────────────

  it("manually remembers and recalls", async () => {
    const mem = await soul.remember({
      type: "long_term",
      category: "identity",
      content: "I am Ek",
      importance: 5,
    });

    expect(mem.isConstitutional).toBe(true);

    const results = await soul.recall({ category: "identity" });
    expect(results).toHaveLength(1);
  });

  it("recalls with includeRelations", async () => {
    await soul.remember({ type: "long_term", category: "skill", content: "TypeScript" });
    const result = await soul.recall({ includeRelations: true });

    expect(result).toHaveProperty("memories");
    expect(result).toHaveProperty("relations");
  });

  // ─── getConstitutional ────────────────────────────────────

  it("gets constitutional memories", async () => {
    await soul.remember({ type: "long_term", category: "identity", content: "I am Ek", importance: 5 });
    await soul.remember({ type: "long_term", category: "skill", content: "TypeScript", importance: 3 });

    const constitutional = await soul.getConstitutional();
    expect(constitutional).toHaveLength(1);
    expect(constitutional[0].content).toBe("I am Ek");
  });

  // ─── forget ───────────────────────────────────────────────

  it("forgets a normal memory", async () => {
    const mem = await soul.remember({
      type: "long_term",
      category: "event",
      content: "Something happened",
    });

    await soul.forget(mem.id);

    const results = await soul.recall({});
    expect(results).toHaveLength(0);
  });

  it("refuses to forget constitutional memory", async () => {
    const mem = await soul.remember({
      type: "long_term",
      category: "identity",
      content: "I am Ek",
      importance: 5,
      isConstitutional: true,
    });

    await expect(soul.forget(mem.id)).rejects.toThrow("Cannot forget constitutional memory");
  });

  it("throws when forgetting non-existent memory", async () => {
    await expect(soul.forget("nonexistent")).rejects.toThrow("Memory not found");
  });

  // ─── toPrompt ─────────────────────────────────────────────

  it("builds a formatted prompt", async () => {
    await soul.remember({ type: "long_term", category: "identity", content: "I am Ek", importance: 5, isConstitutional: true });
    await soul.remember({ type: "long_term", category: "cognition", content: "Users want simplicity" });
    await soul.remember({ type: "long_term", category: "event", content: "Launched v0.1" });

    const prompt = await soul.toPrompt();

    expect(prompt).toContain("## Core Identity (Soul Layer)");
    expect(prompt).toContain("I am Ek");
    expect(prompt).toContain("## Learned Wisdom (Growth Layer)");
    expect(prompt).toContain("## Recent Events (Experience Layer)");
  });

  it("respects token budget in toPrompt", async () => {
    // Insert many memories
    for (let i = 0; i < 50; i++) {
      await soul.remember({ type: "long_term", category: "event", content: `Event number ${i} with some extra detail text` });
    }

    const prompt = await soul.toPrompt({ maxTokens: 100 });
    // Should be truncated
    expect(prompt.length).toBeLessThan(2000);
  });

  // ─── consolidate ──────────────────────────────────────────

  it("consolidate returns zero when no candidates", async () => {
    const result = await soul.consolidate();
    expect(result).toEqual({ promoted: 0, compressed: 0, deleted: 0, skipped: 0 });
  });

  // ─── auto-initialization ─────────────────────────────────

  it("auto-initializes on first operation", async () => {
    // Create soul without calling any init
    const freshSoul = createSoul({
      entityId: "fresh",
      storage: new InMemoryAdapter(),
      model: mockModel,
    });

    // First call should auto-initialize
    const results = await freshSoul.recall({});
    expect(results).toHaveLength(0);

    await freshSoul.close();
  });
});
