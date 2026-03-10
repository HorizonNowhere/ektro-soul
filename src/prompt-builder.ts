import type { Memory, ToPromptOptions } from "./types";
import { estimateTokens } from "./utils/tokens";

export function buildPrompt(memories: Memory[], options: ToPromptOptions = {}): string {
  const maxTokens = options.maxTokens ?? 2000;
  const prioritize = options.prioritize ?? "layer";

  // Separate by layer
  const soul = memories.filter((m) => m.isConstitutional && m.category === "identity");
  const growth = memories.filter((m) =>
    ["cognition", "skill", "aesthetic", "relation"].includes(m.category) && !m.isConstitutional
  );
  const experience = memories.filter((m) => m.category === "event");

  // Sort within layers
  const sortByImportance = (a: Memory, b: Memory) => {
    const impA = (a.metadata?.importance as number) ?? 3;
    const impB = (b.metadata?.importance as number) ?? 3;
    return impB - impA;
  };
  const sortByRecency = (a: Memory, b: Memory) =>
    b.createdAt.localeCompare(a.createdAt);

  if (prioritize === "importance") {
    growth.sort(sortByImportance);
    experience.sort(sortByImportance);
  } else if (prioritize === "recency") {
    growth.sort(sortByRecency);
    experience.sort(sortByRecency);
  } else {
    // layer: importance for growth, recency for experience
    growth.sort(sortByImportance);
    experience.sort(sortByRecency);
  }

  // Build sections with token budget
  const sections: string[] = [];
  let tokensUsed = 0;

  // Soul Layer — always fully included
  if (soul.length) {
    const soulLines = soul.map((m) => `- ${m.content}`);
    const soulBlock = `## Core Identity (Soul Layer)\n${soulLines.join("\n")}`;
    tokensUsed += estimateTokens(soulBlock);
    sections.push(soulBlock);
  }

  // Growth Layer — fill until budget
  if (growth.length) {
    const growthLines: string[] = [];
    for (const m of growth) {
      const line = `- ${m.content}`;
      const lineTokens = estimateTokens(line);
      if (tokensUsed + lineTokens > maxTokens) break;
      growthLines.push(line);
      tokensUsed += lineTokens;
    }
    if (growthLines.length) {
      sections.push(`## Learned Wisdom (Growth Layer)\n${growthLines.join("\n")}`);
    }
  }

  // Experience Layer — fill remaining budget
  if (experience.length) {
    const expLines: string[] = [];
    for (const m of experience) {
      const line = `- ${m.content}`;
      const lineTokens = estimateTokens(line);
      if (tokensUsed + lineTokens > maxTokens) break;
      expLines.push(line);
      tokensUsed += lineTokens;
    }
    if (expLines.length) {
      sections.push(`## Recent Events (Experience Layer)\n${expLines.join("\n")}`);
    }
  }

  return sections.join("\n\n");
}
