import { Soul } from "./soul";
import type { SoulConfig } from "./types";

export function createSoul(config: SoulConfig): Soul {
  return new Soul(config);
}

// Re-export types
export { Soul } from "./soul";
export type {
  Memory,
  MemoryRelation,
  MemoryQuery,
  MemoryType,
  MemoryCategory,
  MemoryLayer,
  RelationType,
  ConsolidationResult,
  ModelProvider,
  SoulConfig,
  ExtractOptions,
  ToPromptOptions,
  PromptOverrides,
} from "./types";
export type { StorageAdapter, MemoryInsert, RelationInsert } from "./adapters/types";
export { LAYER_CATEGORIES, VALID_CATEGORIES, VALID_RELATION_TYPES } from "./types";
