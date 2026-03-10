import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryAdapter } from "../src/adapters/memory";
import { extractMemories } from "../src/extractor";
import type { ModelProvider } from "../src/types";

describe("extractMemories", () => {
  let adapter: InMemoryAdapter;

  const mockModel: ModelProvider = {
    extract: async () => ({
      memories: [
        { type: "long_term", content: "User prefers TypeScript", importance: 4, category: "skill", tags: ["tech"] },
        { type: "long_term", content: "User is the CEO", importance: 5, category: "identity", tags: ["role"] },
        { type: "short_term", content: "Currently working on auth", importance: 2, category: "event", tags: ["task"] },
        { type: "short_term", content: "Said hello", importance: 1, category: "event", tags: [] }, // Should be filtered
      ],
    }),
    consolidate: async () => ({ insight: "" }),
  };

  beforeEach(async () => {
    adapter = new InMemoryAdapter();
    await adapter.initialize();
  });

  it("extracts and stores memories, filtering low importance", async () => {
    const ids = await extractMemories(
      "ek-001",
      { messages: [{ role: "user", content: "I prefer TypeScript" }, { role: "assistant", content: "Noted!" }] },
      adapter,
      mockModel
    );

    expect(ids).toHaveLength(3); // importance >= 2 only

    const all = await adapter.queryMemories({ entityId: "ek-001" });
    expect(all).toHaveLength(3);
  });

  it("marks constitutional memories correctly", async () => {
    await extractMemories(
      "ek-001",
      { messages: [{ role: "user", content: "test" }, { role: "assistant", content: "test" }] },
      adapter,
      mockModel
    );

    const constitutional = await adapter.queryMemories({ isConstitutional: true });
    expect(constitutional).toHaveLength(1);
    expect(constitutional[0].content).toBe("User is the CEO");
  });

  it("sets expiry for short_term memories", async () => {
    await extractMemories(
      "ek-001",
      { messages: [{ role: "user", content: "test" }, { role: "assistant", content: "test" }] },
      adapter,
      mockModel
    );

    const shortTerm = await adapter.queryMemories({ type: "short_term" });
    expect(shortTerm).toHaveLength(1);
    expect(shortTerm[0].expiresAt).not.toBeNull();
  });

  it("returns empty array when nothing worth keeping", async () => {
    const emptyModel: ModelProvider = {
      extract: async () => ({ memories: [] }),
      consolidate: async () => ({ insight: "" }),
    };

    const ids = await extractMemories(
      "ek-001",
      { messages: [{ role: "user", content: "hi" }, { role: "assistant", content: "hello" }] },
      adapter,
      emptyModel
    );

    expect(ids).toHaveLength(0);
  });

  it("filters invalid categories", async () => {
    const badModel: ModelProvider = {
      extract: async () => ({
        memories: [
          { type: "long_term", content: "test", importance: 3, category: "invalid_cat" as never, tags: [] },
        ],
      }),
      consolidate: async () => ({ insight: "" }),
    };

    const ids = await extractMemories(
      "ek-001",
      { messages: [{ role: "user", content: "test" }, { role: "assistant", content: "test" }] },
      adapter,
      badModel
    );

    expect(ids).toHaveLength(0);
  });
});
