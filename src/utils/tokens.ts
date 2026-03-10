/**
 * Simple token estimation: ~4 characters per token for English text.
 * This is a rough estimate; for production use, consider tiktoken.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
