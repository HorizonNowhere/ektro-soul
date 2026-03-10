import type { StorageAdapter } from "./adapters/types";
import type {
  Memory,
  MemoryRelation,
  MemoryQuery,
  MemoryCategory,
  ModelProvider,
  SoulConfig,
  ExtractOptions,
  ToPromptOptions,
  ConsolidationResult,
  PromptOverrides,
} from "./types";
import { extractMemories } from "./extractor";
import { discoverRelations } from "./relator";
import { consolidateMemories } from "./consolidator";
import { buildPrompt } from "./prompt-builder";

export class Soul {
  private entityId: string;
  private storage: StorageAdapter;
  private model: ModelProvider;
  private consolidationAgeDays: number;
  private salienceThreshold: number;
  private maxCandidatesPerRun: number;
  private promptOverrides?: Partial<PromptOverrides>;
  private initialized = false;

  constructor(config: SoulConfig) {
    this.entityId = config.entityId;
    this.storage = config.storage;
    this.model = config.model;
    this.consolidationAgeDays = config.config?.consolidationAgeDays ?? 30;
    this.salienceThreshold = config.config?.salienceThreshold ?? 0.7;
    this.maxCandidatesPerRun = config.config?.maxCandidatesPerRun ?? 100;
    this.promptOverrides = config.config?.prompts;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.storage.initialize();
      this.initialized = true;
    }
  }

  /**
   * Extract memories from a conversation.
   * Automatically triggers relation discovery (async, non-blocking).
   */
  async extract(options: ExtractOptions): Promise<string[]> {
    await this.ensureInitialized();
    const ids = await extractMemories(
      this.entityId,
      options,
      this.storage,
      this.model,
      this.promptOverrides
    );

    // Async relation discovery — don't block
    if (ids.length) {
      this.relate(ids).catch(() => {});
    }

    return ids;
  }

  /**
   * Discover relations between new memories and existing ones.
   */
  async relate(newMemoryIds: string[]): Promise<void> {
    await this.ensureInitialized();
    await discoverRelations(
      this.entityId,
      newMemoryIds,
      this.storage,
      this.model,
      this.promptOverrides
    );
  }

  /**
   * Run memory consolidation. Call periodically (e.g., daily cron).
   */
  async consolidate(): Promise<ConsolidationResult> {
    await this.ensureInitialized();
    return consolidateMemories(
      this.entityId,
      this.storage,
      this.model,
      {
        consolidationAgeDays: this.consolidationAgeDays,
        salienceThreshold: this.salienceThreshold,
        maxCandidatesPerRun: this.maxCandidatesPerRun,
      },
      this.promptOverrides
    );
  }

  /**
   * Query memories by conditions.
   */
  async recall(query: MemoryQuery = {}): Promise<Memory[] | { memories: Memory[]; relations: MemoryRelation[] }> {
    await this.ensureInitialized();
    const entityQuery = { ...query, entityId: this.entityId };
    const memories = await this.storage.queryMemories(entityQuery);

    if (query.includeRelations) {
      const memoryIds = memories.map((m) => m.id);
      const relations = memoryIds.length
        ? await this.storage.queryRelations(memoryIds)
        : [];
      return { memories, relations };
    }

    return memories;
  }

  /**
   * Get all constitutional (permanent) memories.
   */
  async getConstitutional(): Promise<Memory[]> {
    await this.ensureInitialized();
    return this.storage.queryMemories({
      entityId: this.entityId,
      isConstitutional: true,
    });
  }

  /**
   * Manually write a memory (skips AI extraction).
   */
  async remember(input: {
    type: Memory["type"];
    category: MemoryCategory;
    content: string;
    importance?: number;
    isConstitutional?: boolean;
    metadata?: Record<string, unknown>;
  }): Promise<Memory> {
    await this.ensureInitialized();

    const importance = input.importance ?? 3;
    const isConstitutional =
      input.isConstitutional ?? (input.category === "identity" && importance >= 4);

    const [memory] = await this.storage.insertMemories([{
      entityId: this.entityId,
      type: input.type,
      category: input.category,
      content: input.content,
      metadata: { importance, ...input.metadata },
      isConstitutional,
      expiresAt:
        input.type === "short_term"
          ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          : null,
    }]);

    return memory;
  }

  /**
   * Delete a memory. Constitutional memories cannot be forgotten.
   */
  async forget(memoryId: string): Promise<void> {
    await this.ensureInitialized();

    const memories = await this.storage.queryMemories({ entityId: this.entityId });
    const memory = memories.find((m) => m.id === memoryId);

    if (!memory) {
      throw new Error(`Memory not found: ${memoryId}`);
    }
    if (memory.isConstitutional) {
      throw new Error("Cannot forget constitutional memory. Use unconstitute() first.");
    }

    await this.storage.deleteMemories([memoryId]);
  }

  /**
   * Build a formatted text block for system prompt injection.
   */
  async toPrompt(options: ToPromptOptions = {}): Promise<string> {
    await this.ensureInitialized();
    const memories = await this.storage.queryMemories({
      entityId: this.entityId,
      excludeExpired: true,
    });
    return buildPrompt(memories, options);
  }

  /**
   * Close the storage connection.
   */
  async close(): Promise<void> {
    await this.storage.close();
    this.initialized = false;
  }
}
