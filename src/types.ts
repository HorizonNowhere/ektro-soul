import { type ZodSchema } from "zod";

// ─── Memory Types ───────────────────────────────────────────

export interface Memory {
  id: string;
  entityId: string;
  type: MemoryType;
  category: MemoryCategory;
  content: string;
  metadata: Record<string, unknown>;
  isConstitutional: boolean;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type MemoryType = "short_term" | "long_term" | "episodic";

export type MemoryCategory =
  | "identity"
  | "relation"
  | "cognition"
  | "skill"
  | "aesthetic"
  | "event";

export type MemoryLayer = "soul" | "growth" | "experience";

// ─── Memory Relation Types ──────────────────────────────────

export interface MemoryRelation {
  id: string;
  sourceMemoryId: string;
  targetMemoryId: string;
  relationType: RelationType;
  strength: number; // 0-1
  createdAt: string;
}

export type RelationType =
  | "defines"
  | "fears"
  | "trusts"
  | "remembers"
  | "shapes"
  | "depends_on";

// ─── Query Types ────────────────────────────────────────────

export interface MemoryQuery {
  entityId?: string;
  type?: MemoryType;
  category?: MemoryCategory;
  layer?: MemoryLayer;
  isConstitutional?: boolean;
  limit?: number;
  order?: "asc" | "desc";
  olderThan?: string; // ISO date string
  excludeExpired?: boolean;
  includeRelations?: boolean;
}

// ─── Consolidation Types ────────────────────────────────────

export interface ConsolidationResult {
  promoted: number;
  compressed: number;
  deleted: number;
  skipped: number;
}

// ─── Model Provider ─────────────────────────────────────────

export interface ModelProvider {
  extract: <T>(prompt: string, schema: ZodSchema<T>) => Promise<T>;
  consolidate: <T>(prompt: string, schema: ZodSchema<T>) => Promise<T>;
}

// ─── Soul Config ────────────────────────────────────────────

export interface SoulConfig {
  entityId: string;
  storage: import("./adapters/types").StorageAdapter;
  model: ModelProvider;
  config?: {
    consolidationAgeDays?: number;
    salienceThreshold?: number;
    maxCandidatesPerRun?: number;
    prompts?: Partial<PromptOverrides>;
  };
}

export interface PromptOverrides {
  extraction: string;
  relation: string;
  promotion: string;
  compression: string;
}

// ─── Extract Options ────────────────────────────────────────

export interface ExtractOptions {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  context?: { speakerName?: string };
}

// ─── toPrompt Options ───────────────────────────────────────

export interface ToPromptOptions {
  maxTokens?: number;
  prioritize?: "recency" | "importance" | "layer";
}

// ─── Layer Mapping ──────────────────────────────────────────

export const LAYER_CATEGORIES: Record<MemoryLayer, MemoryCategory[]> = {
  soul: ["identity"],
  growth: ["cognition", "skill", "aesthetic", "relation"],
  experience: ["event"],
};

export const VALID_CATEGORIES: MemoryCategory[] = [
  "identity",
  "relation",
  "cognition",
  "skill",
  "aesthetic",
  "event",
];

export const VALID_RELATION_TYPES: RelationType[] = [
  "defines",
  "fears",
  "trusts",
  "remembers",
  "shapes",
  "depends_on",
];
