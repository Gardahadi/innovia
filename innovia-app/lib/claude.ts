import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const DEFAULT_MODEL = "claude-opus-4-6";
const DEFAULT_MAX_TOKENS = 4096;

interface CallOptions {
  system?: string;
  model?: string;
  maxTokens?: number;
}

/**
 * Non-streaming call. Returns the full text content of the first message block.
 */
export async function callClaude(
  messages: Anthropic.MessageParam[],
  options: CallOptions = {}
): Promise<string> {
  const response = await anthropic.messages.create({
    model: options.model ?? DEFAULT_MODEL,
    max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
    system: options.system,
    messages,
  });

  const block = response.content[0];
  if (block.type !== "text") {
    throw new Error(`Unexpected content block type: ${block.type}`);
  }
  return block.text;
}

/**
 * Streaming call. Yields text delta strings as they arrive.
 * Use with `for await` in a Route Handler or Server Action.
 */
export async function* streamClaude(
  messages: Anthropic.MessageParam[],
  options: CallOptions = {}
): AsyncGenerator<string> {
  const stream = anthropic.messages.stream({
    model: options.model ?? DEFAULT_MODEL,
    max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
    system: options.system,
    messages,
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text;
    }
  }
}
