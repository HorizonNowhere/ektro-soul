import { createSoul } from "ektro-soul";
import { InMemoryAdapter } from "ektro-soul/memory";

// Minimal mock model — replace with your LLM of choice
const model = {
  extract: async () => ({ memories: [] }),
  consolidate: async () => ({ summary: "", insight: "" }),
};

const soul = createSoul({
  entityId: "my-agent",
  storage: new InMemoryAdapter(),
  model,
});

// Give your AI some memories
await soul.remember({
  type: "long_term",
  category: "identity",
  content: "I am an AI assistant named Nova",
  importance: 5,
});

await soul.remember({
  type: "long_term",
  category: "cognition",
  content: "Users prefer concise answers over verbose ones",
});

await soul.remember({
  type: "long_term",
  category: "event",
  content: "Helped user debug a TypeScript error",
});

// Build a prompt block for your system message
const prompt = await soul.toPrompt();
console.log(prompt);
// ## Core Identity (Soul Layer)
// - I am an AI assistant named Nova
//
// ## Learned Wisdom (Growth Layer)
// - Users prefer concise answers over verbose ones
//
// ## Recent Events (Experience Layer)
// - Helped user debug a TypeScript error

// Constitutional memories are permanent
const core = await soul.getConstitutional();
console.log(`\nConstitutional memories: ${core.length}`);

await soul.close();
