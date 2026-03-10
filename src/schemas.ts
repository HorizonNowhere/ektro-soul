import { z } from "zod";

export const memorySchema = z.object({
  memories: z.array(
    z.object({
      type: z.enum(["short_term", "long_term"]),
      content: z.string().describe("A concise factual statement, one sentence"),
      importance: z.number().min(1).max(5).describe("1=trivial 5=critical decision"),
      category: z.enum(["identity", "relation", "cognition", "skill", "aesthetic", "event"]).describe("Semantic category"),
      tags: z.array(z.string()).describe("Classification tags"),
    })
  ),
});

export const relationSchema = z.object({
  relations: z.array(
    z.object({
      source_id: z.string().describe("ID of the new memory"),
      target_id: z.string().describe("ID of the existing memory"),
      relation_type: z.enum(["defines", "fears", "trusts", "remembers", "shapes", "depends_on"]),
      strength: z.number().min(0).max(1).describe("Relation strength 0-1"),
    })
  ),
});

export const promotionSchema = z.object({
  insight: z.string().describe("Distilled insight from the experiences, format: [Period] I understood/learned/felt..."),
});

export const compressionSchema = z.object({
  summary: z.string().describe("Compressed summary, one sentence describing the core of what happened"),
});

export type ExtractedMemory = z.infer<typeof memorySchema>;
export type ExtractedRelation = z.infer<typeof relationSchema>;
export type PromotionResult = z.infer<typeof promotionSchema>;
export type CompressionResult = z.infer<typeof compressionSchema>;
