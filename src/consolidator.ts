import type { StorageAdapter } from "./adapters/types";
import type { ModelProvider, ConsolidationResult, PromptOverrides } from "./types";
import { promotionSchema, compressionSchema } from "./schemas";
import { PROMOTION_PROMPT, COMPRESSION_PROMPT } from "./prompts";
import { getWeekKey, formatPeriod } from "./utils/time";

interface ConsolidationConfig {
  consolidationAgeDays: number;
  salienceThreshold: number;
  maxCandidatesPerRun: number;
}

interface CandidateMemory {
  id: string;
  entityId: string;
  content: string;
  createdAt: string;
}

export async function consolidateMemories(
  entityId: string,
  storage: StorageAdapter,
  model: ModelProvider,
  config: ConsolidationConfig,
  promptOverrides?: Partial<PromptOverrides>
): Promise<ConsolidationResult> {
  const result: ConsolidationResult = { promoted: 0, compressed: 0, deleted: 0, skipped: 0 };

  const cutoffDate = new Date(
    Date.now() - config.consolidationAgeDays * 24 * 60 * 60 * 1000
  ).toISOString();

  // Query consolidation candidates: experience layer, older than threshold, non-constitutional
  const candidates = await storage.queryMemories({
    entityId,
    category: "event",
    isConstitutional: false,
    olderThan: cutoffDate,
    excludeExpired: true,
    order: "asc",
    limit: config.maxCandidatesPerRun,
  });

  if (!candidates.length) return result;

  // Group by week
  const groups = groupByWeek(candidates as CandidateMemory[]);

  for (const memories of Object.values(groups)) {
    const memoryIds = memories.map((m) => m.id);

    // Query emotional weight (average strength from relations)
    const relations = await storage.queryRelations(memoryIds);
    const sourceRelations = relations.filter((r) => memoryIds.includes(r.sourceMemoryId));
    const avgStrength = sourceRelations.length
      ? sourceRelations.reduce((sum, r) => sum + r.strength, 0) / sourceRelations.length
      : 0;

    try {
      if (avgStrength > config.salienceThreshold) {
        await promoteToGrowthLayer(entityId, memories, storage, model, result, promptOverrides);
      } else {
        await compressToEpisodic(entityId, memories, storage, model, result, promptOverrides);
      }
    } catch {
      result.skipped += memories.length;
    }
  }

  return result;
}

async function promoteToGrowthLayer(
  entityId: string,
  memories: CandidateMemory[],
  storage: StorageAdapter,
  model: ModelProvider,
  result: ConsolidationResult,
  promptOverrides?: Partial<PromptOverrides>
): Promise<void> {
  const period = formatPeriod(memories[0].createdAt, memories[memories.length - 1].createdAt);
  const contentList = memories.map((m) => `- ${m.content}`).join("\n");

  const prompt = promptOverrides?.promotion ?? PROMOTION_PROMPT;
  const { insight } = await model.consolidate(
    `${prompt}\n\nPeriod: ${period}\nExperiences:\n${contentList}\n\nFormat: "[${period}] I understood/learned/felt that..."`,
    promotionSchema
  );

  await storage.insertMemories([{
    entityId,
    type: "long_term",
    category: "cognition",
    content: insight,
    metadata: { importance: 4, tags: ["consolidated", "insight"], source_ids: memories.map((m) => m.id) },
    isConstitutional: false,
    expiresAt: null,
  }]);

  await storage.deleteMemories(memories.map((m) => m.id));
  result.promoted += 1;
  result.deleted += memories.length;
}

async function compressToEpisodic(
  entityId: string,
  memories: CandidateMemory[],
  storage: StorageAdapter,
  model: ModelProvider,
  result: ConsolidationResult,
  promptOverrides?: Partial<PromptOverrides>
): Promise<void> {
  const period = formatPeriod(memories[0].createdAt, memories[memories.length - 1].createdAt);
  const contentList = memories.map((m) => `- ${m.content}`).join("\n");

  const prompt = promptOverrides?.compression ?? COMPRESSION_PROMPT;
  const { summary } = await model.consolidate(
    `${prompt}\n\nPeriod: ${period}\n${memories.length} events:\n${contentList}`,
    compressionSchema
  );

  await storage.insertMemories([{
    entityId,
    type: "episodic",
    category: "event",
    content: `[${period}] ${summary}`,
    metadata: { importance: 2, tags: ["consolidated", "summary"], source_count: memories.length },
    isConstitutional: false,
    expiresAt: null,
  }]);

  await storage.deleteMemories(memories.map((m) => m.id));
  result.compressed += 1;
  result.deleted += memories.length;
}

function groupByWeek(
  memories: CandidateMemory[]
): Record<string, CandidateMemory[]> {
  const groups: Record<string, CandidateMemory[]> = {};
  for (const mem of memories) {
    const week = getWeekKey(mem.createdAt);
    if (!groups[week]) groups[week] = [];
    groups[week].push(mem);
  }
  return groups;
}
