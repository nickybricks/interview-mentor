import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default openai;

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

function buildParams(options: ChatOptions) {
  const {
    model = "gpt-4.1-mini",
    temperature,
    maxTokens,
    topP,
    frequencyPenalty,
  } = options;

  const restricted = RESTRICTED_MODELS.has(model);

  return {
    model,
    ...(!restricted && temperature != null && { temperature }),
    ...(maxTokens != null && { max_tokens: maxTokens }),
    ...(!restricted && topP != null && topP !== 1 && { top_p: topP }),
    ...(!restricted &&
      frequencyPenalty != null &&
      frequencyPenalty !== 0 && { frequency_penalty: frequencyPenalty }),
  };
}

export async function streamChat(
  messages: ChatMessage[],
  options: ChatOptions = {}
) {
  const stream = await openai.chat.completions.create({
    ...buildParams(options),
    messages,
    stream: true,
  });

  return stream;
}

export async function chat(
  messages: ChatMessage[],
  options: ChatOptions = {}
) {
  const response = await openai.chat.completions.create({
    ...buildParams(options),
    messages,
  });

  return response;
}
