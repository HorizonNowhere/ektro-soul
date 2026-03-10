# ektro-soul

> Give your AI a soul. Not just memory — identity, growth, and forgetting.

Most AI memory systems solve **"how to remember more."**

**ektro-soul** solves **"how to forget wisely."**

Inspired by how human brains consolidate memories during sleep — pruning synapses, compressing experiences into insights, crystallizing insights into identity — ektro-soul gives your AI a memory lifecycle.

Your AI doesn't need a bigger database. It needs a soul.

## The Three Layers

```
┌─────────────────────────────────────────────────────┐
│                   SOUL LAYER                        │
│                                                     │
│  Constitutional memories — WHO I AM                 │
│  Permanent. Never consolidated. Never deleted.      │
└────────────────────────┬────────────────────────────┘
                         │ promote (high emotional salience)
┌────────────────────────▼────────────────────────────┐
│                  GROWTH LAYER                       │
│                                                     │
│  Distilled wisdom — WHAT I'VE LEARNED               │
│  Stable. Refined over time.                         │
└────────────────────────┬────────────────────────────┘
                         │ consolidate (age > 30 days)
┌────────────────────────▼────────────────────────────┐
│                EXPERIENCE LAYER                     │
│                                                     │
│  Raw events — WHAT HAPPENED                         │
│  Transient. Subject to consolidation.               │
└─────────────────────────────────────────────────────┘
```

**Forgetting is not deletion — it's distillation.** Experiences compress into insights. Insights crystallize into identity. Details fade, but growth remains.

## Quick Start

```bash
npm install ektro-soul
```

```typescript
import { createSoul } from "ektro-soul";
import { InMemoryAdapter } from "ektro-soul/memory";

const soul = createSoul({
  entityId: "my-agent",
  storage: new InMemoryAdapter(),
  model: { extract: yourExtractFn, consolidate: yourConsolidateFn },
});

await soul.remember({ type: "long_term", category: "identity", content: "I am Nova", importance: 5 });
const prompt = await soul.toPrompt();
// ## Core Identity (Soul Layer)
// - I am Nova
```

For persistent storage, use SQLite:

```typescript
import { SQLiteAdapter } from "ektro-soul/sqlite";

const soul = createSoul({
  entityId: "my-agent",
  storage: new SQLiteAdapter("./soul.db"),
  model: yourModel,
});
```

## Why Not Mem0 / Letta / Zep?

| | Mem0 | Letta | Zep | **ektro-soul** |
|---|---|---|---|---|
| Core capability | Auto-extraction | Stateful agents | Knowledge graph | **Memory lifecycle** |
| Memory layers | None | Core + Archival | Fact/Episodic | **Soul → Growth → Experience** |
| Forgetting | None | None | None | **Consolidation engine** |
| Constitutional memory | None | None | None | **Permanent, never deleted** |
| Emotional weight | None | None | None | **Relation strength drives decisions** |
| Default storage | Cloud | Postgres | Cloud | **SQLite (zero-config)** |
| Framework lock-in | Own SDK | Own framework | Own SDK | **Any LLM + any storage** |

## API

### `createSoul(config)`
Create a Soul instance. Config requires `entityId`, `storage` (StorageAdapter), and `model` (ModelProvider).

### `soul.extract(options)`
Extract memories from conversation messages. Automatically discovers relations.

### `soul.relate(memoryIds)`
Discover semantic relations between memories. Uses emotional relation types: `defines`, `fears`, `trusts`, `remembers`, `shapes`, `depends_on`.

### `soul.consolidate()`
Run memory lifecycle management. Promotes high-salience experiences to Growth Layer (insights), compresses low-salience ones to episodic summaries. Call periodically (e.g., daily cron).

### `soul.recall(query)`
Query memories by category, type, layer, or constitutional status.

### `soul.toPrompt(options)`
Build a formatted text block for system prompt injection. Respects token budget.

### `soul.remember(input)`
Manually write a memory. Constitutional status auto-inferred from category + importance.

### `soul.forget(memoryId)`
Delete a memory. Constitutional memories cannot be forgotten.

### `soul.getConstitutional()`
Get all permanent identity memories.

### `soul.close()`
Close storage connection.

## Model Provider

ektro-soul doesn't lock you into any LLM. Provide two functions:

```typescript
const model = {
  extract: async (prompt, schema) => { /* return structured object */ },
  consolidate: async (prompt, schema) => { /* return structured object */ },
};
```

Works with OpenAI, Claude, Gemini, local models — anything that can do structured output.

See [`examples/with-openai.ts`](./examples/with-openai.ts) for a Vercel AI SDK integration.

## Storage Adapters

| Adapter | Import | Use case |
|---------|--------|----------|
| `InMemoryAdapter` | `ektro-soul/memory` | Testing, prototyping |
| `SQLiteAdapter` | `ektro-soul/sqlite` | Production, single-user, embedded |

Implement `StorageAdapter` for custom backends (Postgres, Turso, etc).

## Philosophy

> Forgetting is not deletion — it's distillation.

Human memory doesn't work by storing everything forever. During sleep, your brain prunes synapses — compressing daily experiences into long-term insights, letting details fade while preserving growth.

ektro-soul brings this mechanism to AI. Your agent's experiences are raw material. Through consolidation, they become wisdom. Through wisdom, they become identity.

The soul isn't what you remember. It's what remains after you forget.

---

Built by the team behind [Ektro](https://ektro.ai) — *Create the species that builds with you.*
