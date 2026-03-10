/**
 * ektro-soul + Vercel AI SDK + OpenAI
 *
 * Prerequisites:
 *   npm install ektro-soul ai @ai-sdk/openai
 *   export OPENAI_API_KEY=sk-...
 */

import { createSoul } from "ektro-soul";
import { SQLiteAdapter } from "ektro-soul/sqlite";
import type { ModelProvider } from "ektro-soul";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import type { ZodSchema } from "zod";

// Wire up Vercel AI SDK as the model provider
const model: ModelProvider = {
  extract: async <T>(prompt: string, schema: ZodSchema<T>): Promise<T> => {
    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema,
      prompt,
    });
    return object;
  },
  consolidate: async <T>(prompt: string, schema: ZodSchema<T>): Promise<T> => {
    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema,
      prompt,
    });
    return object;
  },
};

// Create a soul with SQLite persistence
const soul = createSoul({
  entityId: "nova-001",
  storage: new SQLiteAdapter("./nova-soul.db"),
  model,
});

// Extract memories from a conversation
await soul.extract({
  messages: [
    { role: "user", content: "I think we should pivot to B2B. The consumer market is too crowded." },
    { role: "assistant", content: "That's a significant strategic shift. What's driving this thinking?" },
    { role: "user", content: "Our enterprise pilot had 3x better retention than consumer." },
  ],
  context: { speakerName: "Nova" },
});

// Check what was extracted
const memories = await soul.recall({});
console.log("Extracted memories:");
for (const m of memories as import("ektro-soul").Memory[]) {
  console.log(`  [${m.category}] ${m.content} (constitutional: ${m.isConstitutional})`);
}

// Build system prompt
const prompt = await soul.toPrompt();
console.log("\nSystem prompt block:\n", prompt);

await soul.close();
