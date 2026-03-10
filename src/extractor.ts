import type { StorageAdapter } from "./adapters/types";
import type { ModelProvider, ExtractOptions, MemoryCategory, PromptOverrides } from "./types";
import { VALID_CATEGORIES } from "./types";
import { memorySchema } from "./schemas";
import { EXTRACTION_PROMPT } from "./prompts";

export async function extractMemories(
  entityId: string,
  options: ExtractOptions,
  storage: StorageAdapter,
  model: ModelProvider,
  promptOverrides?: Partial<PromptOverrides>
): Promise<string[]> {
  const prompt = promptOverrides?.extraction ?? EXTRACTION_PROMPT;
  const speakerName = options.context?.speakerName ?? "Assistant";

  const conversation = options.messages
    .map((m) => `${m.role === "user" ? "User" : speakerName}: ${m.content}`)
    .join("\n");

  const result = await model.extract(
    `${prompt}\n\nConversation:\n${conversation}`,
    memorySchema
  );

  // Filter importance < 2 and invalid categories
  const worthKeeping = result.memories.filter(
    (m) => m.importance >= 2 && VALID_CATEGORIES.includes(m.category as MemoryCategory)
  );

  if (!worthKeeping.length) return [];

  const now = new Date();
  const rows = worthKeeping.map((m) => ({
    entityId,
    type: m.type as "short_term" | "long_term",
    category: m.category as MemoryCategory,
    content: m.content,
    metadata: { importance: m.importance, tags: m.tags },
    isConstitutional: m.category === "identity" && m.importance >= 4,
    expiresAt:
      m.type === "short_term"
        ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
        : null,
  }));

  const inserted = await storage.insertMemories(rows);
  return inserted.map((m) => m.id);
}
