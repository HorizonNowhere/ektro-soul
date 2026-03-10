import type { StorageAdapter } from "./adapters/types";
import type { ModelProvider, PromptOverrides } from "./types";
import { VALID_RELATION_TYPES } from "./types";
import { relationSchema } from "./schemas";
import { RELATION_PROMPT } from "./prompts";

export async function discoverRelations(
  entityId: string,
  newMemoryIds: string[],
  storage: StorageAdapter,
  model: ModelProvider,
  promptOverrides?: Partial<PromptOverrides>
): Promise<void> {
  // Get new memories
  const allMemories = await storage.queryMemories({ entityId });
  const newMemories = allMemories.filter((m) => newMemoryIds.includes(m.id));
  if (!newMemories.length) return;

  // Get existing memories (exclude new ones, most recent 30)
  const existingMemories = allMemories
    .filter((m) => !newMemoryIds.includes(m.id))
    .slice(0, 30);
  if (!existingMemories.length) return;

  const prompt = promptOverrides?.relation ?? RELATION_PROMPT;

  const newList = newMemories
    .map((m) => `[${m.id}] (${m.category}) ${m.content}`)
    .join("\n");
  const existList = existingMemories
    .map((m) => `[${m.id}] (${m.category}) ${m.content}`)
    .join("\n");

  const result = await model.extract(
    `${prompt}\n\nNew memories:\n${newList}\n\nExisting memories:\n${existList}`,
    relationSchema
  );

  if (!result.relations.length) return;

  // Validate IDs and relation types
  const validNewIds = new Set(newMemoryIds);
  const validExistIds = new Set(existingMemories.map((m) => m.id));

  const validRelations = result.relations.filter(
    (r) =>
      validNewIds.has(r.source_id) &&
      validExistIds.has(r.target_id) &&
      VALID_RELATION_TYPES.includes(r.relation_type as never) &&
      r.strength >= 0 &&
      r.strength <= 1
  );

  if (!validRelations.length) return;

  await storage.insertRelations(
    validRelations.map((r) => ({
      sourceMemoryId: r.source_id,
      targetMemoryId: r.target_id,
      relationType: r.relation_type as never,
      strength: r.strength,
    }))
  );
}
