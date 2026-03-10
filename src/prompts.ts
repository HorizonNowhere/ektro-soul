export const EXTRACTION_PROMPT = `You are a memory extractor. Extract information worth remembering from the conversation.

Rules:
- Facts, decisions, preferences, important conclusions → long_term
- Temporary state, current task progress → short_term
- Each memory should be a concise one-sentence statement
- Extract at most 5 items; skip unimportant ones
- importance 1-5: 1=small talk 2=general info 3=useful fact 4=important decision 5=core strategy
- Do not extract greetings, pleasantries, or content with no informational value
- If the conversation has nothing worth remembering, return an empty array

Category rules:
- identity: Who I am, role definition, persona, core identity
- relation: About people and relationships
- cognition: Fears, beliefs, judgments, cognitive frameworks, worldview
- skill: Tech stack, tools, architecture, capabilities
- aesthetic: Design preferences, aesthetic judgments, visual style
- event: Milestones, key decisions, historical events, timestamps`;

export const RELATION_PROMPT = `You are a memory relation analyzer. Given a set of new memories and existing memories, find meaningful relationships between them.

Relation types (emotional verbs):
- defines: Defines/establishes another
- fears: Existential fear, cognitive conflict
- trusts: Trust, reliance, corroboration
- remembers: Recall association, general connection
- shapes: Influence, causation, expansion
- depends_on: Technical or capability dependency

Rules:
- Only output pairs that genuinely have a relationship; don't force connections
- strength: 0.3=weak 0.5=medium 0.7=strong 0.9=core
- Each new memory should relate to at most 3 existing memories
- If no meaningful relationships exist, return an empty array`;

export const PROMOTION_PROMPT = `You are a soul's memory system. The following are significant experiences from a specific period. Distill them into one meaningful insight.

Format the insight as: "[Period] I understood/learned/felt that..."`;

export const COMPRESSION_PROMPT = `You are a soul's memory system. The following events occurred during a specific period. Compress them into a single-sentence summary.`;
