import { ChatOpenAI } from "@langchain/openai";
import {
  SystemMessage,
  HumanMessage,
  AIMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import type { StructuredToolInterface } from "@langchain/core/tools";
import OpenAI from "openai";

// Raw OpenAI client — only used for non-chat endpoints (Whisper transcription)
export const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export interface ChatOptions {
  model?: string;
  temperature?: number | null;
  maxTokens?: number | null;
  topP?: number;
  frequencyPenalty?: number;
}

// Models that only accept default values for temperature / frequency_penalty
const RESTRICTED_MODELS = new Set(["gpt-5-mini", "gpt-5-nano"]);

function toLangChainMessages(messages: ChatMessage[]): BaseMessage[] {
  return messages.map((m) => {
    switch (m.role) {
      case "system":
        return new SystemMessage(m.content);
      case "user":
        return new HumanMessage(m.content);
      case "assistant":
        return new AIMessage(m.content);
    }
  });
}

function createModel(
  options: ChatOptions = {},
  extra: { streamUsage?: boolean } = {}
): ChatOpenAI {
  const {
    model = "gpt-4.1-mini",
    temperature,
    maxTokens,
    topP,
    frequencyPenalty,
  } = options;

  const restricted = RESTRICTED_MODELS.has(model);

  return new ChatOpenAI({
    model,
    apiKey: process.env.OPENAI_API_KEY,
    ...(!restricted && temperature != null && { temperature }),
    ...(maxTokens != null && { maxTokens }),
    ...(!restricted && topP != null && topP !== 1 && { topP }),
    ...(!restricted &&
      frequencyPenalty != null &&
      frequencyPenalty !== 0 && { frequencyPenalty }),
    ...(extra.streamUsage && { streamUsage: true }),
  });
}

/**
 * Stream a chat completion. Returns an async iterable of AIMessageChunks.
 * Use `streamUsage: true` on the model to get token counts in the final chunk.
 */
export async function streamChat(
  messages: ChatMessage[],
  options: ChatOptions = {}
) {
  const model = createModel(options, { streamUsage: true });
  const lcMessages = toLangChainMessages(messages);
  return model.stream(lcMessages);
}

/**
 * Non-streaming chat completion. Returns the full AIMessage response.
 */
export async function chat(
  messages: ChatMessage[],
  options: ChatOptions = {}
) {
  const model = createModel(options);
  const lcMessages = toLangChainMessages(messages);
  return model.invoke(lcMessages);
}

/**
 * Create a ChatOpenAI model with tools bound. Returns the bound model.
 */
export function createBoundModel(
  tools: StructuredToolInterface[],
  options: ChatOptions = {}
) {
  const model = createModel(options, { streamUsage: true });
  return model.bindTools(tools);
}

export { toLangChainMessages };
