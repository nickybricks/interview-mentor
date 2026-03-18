import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import openai from "@/lib/openai";
import {
  PROMPTS,
  DEFAULT_PROMPT,
  type PromptKey,
} from "@/lib/prompts";
import {
  readSettings,
  getDefaultSystemPrompt,
  type AIFeatureKey,
} from "@/lib/ai-settings";
import {
  validateMessageLength,
  sanitizeInput,
} from "@/lib/security";

// Model pricing rates (USD per 1M tokens) — update when OpenAI changes prices
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-5-mini": { input: 0.25, output: 2.0 },
  "gpt-5-nano": { input: 0.05, output: 0.4 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1-nano": { input: 0.1, output: 0.4 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "codex-mini-latest": { input: 0.75, output: 3.0 },
};

// POST /api/messages - Send a message and get AI response (streaming)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chatId, content, persona, autoStart, regenerate } = body;

    // autoStart mode: bot sends the first message without user input
    const isAutoStart = autoStart === true;
    const isRegenerate = regenerate === true;

    if (!chatId || (!content && !isAutoStart && !isRegenerate)) {
      return new Response(
        JSON.stringify({ error: "chatId and content are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    let sanitizedContent = "";

    if (!isAutoStart && !isRegenerate) {
      // Validate message
      const lengthCheck = validateMessageLength(content);
      if (!lengthCheck.valid) {
        return new Response(JSON.stringify({ error: lengthCheck.error }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Sanitize input
      sanitizedContent = sanitizeInput(content);
    }

    // Get chat with project context
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        project: true,
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!chat) {
      return new Response(JSON.stringify({ error: "Chat not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Regenerate mode: deactivate the last assistant message, keep it as a version
    let regenerateVersionGroup: string | null = null;
    let deactivatedMessageId: string | null = null;
    if (isRegenerate) {
      const lastAssistant = await prisma.message.findFirst({
        where: { chatId, role: "assistant", active: true },
        orderBy: { createdAt: "desc" },
      });
      if (lastAssistant) {
        // Use existing versionGroup or create one from the message id
        regenerateVersionGroup =
          lastAssistant.versionGroup ?? lastAssistant.id;
        deactivatedMessageId = lastAssistant.id;
        await prisma.message.update({
          where: { id: lastAssistant.id },
          data: { active: false, versionGroup: regenerateVersionGroup },
        });
      }
    }

    // Save user message (skip for autoStart and regenerate)
    if (!isAutoStart && !isRegenerate) {
      await prisma.message.create({
        data: {
          chatId,
          role: "user",
          content: sanitizedContent,
        },
      });
    }

    // Read AI settings from config
    const aiSettings = await readSettings();
    const featureKey = chat.type as AIFeatureKey;
    const featureSettings = aiSettings[featureKey] ?? aiSettings.preparation;

    // Build system prompt: use saved override, or per-request persona, or default
    let systemPrompt: string;
    if (featureSettings.systemPrompt) {
      systemPrompt = featureSettings.systemPrompt;
    } else if (chat.type === "preparation") {
      const promptKey = (persona || chat.persona || DEFAULT_PROMPT) as PromptKey;
      systemPrompt = PROMPTS[promptKey] || PROMPTS[DEFAULT_PROMPT];
    } else {
      systemPrompt = getDefaultSystemPrompt(featureKey);
    }

    // Add CV and job description context if available
    let contextInfo = "";
    if (chat.project.cvText) {
      contextInfo += `\n\n## Candidate's CV:\n${chat.project.cvText}`;
    }
    if (chat.project.jobDescription) {
      contextInfo += `\n\n## Target Job Description:\n${chat.project.jobDescription}`;
    }

    const fullSystemPrompt = systemPrompt + contextInfo;

    // Build message history for OpenAI
    const messageHistory: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [{ role: "system", content: fullSystemPrompt }];

    // Add previous messages (limit to last 50 for token management)
    // Filter out inactive versions so only the active conversation thread is sent
    const activeMessages = chat.messages.filter((m) => m.active);
    // For regenerate: exclude the just-deactivated assistant message
    const filteredMessages = isRegenerate
      ? activeMessages.filter((m) => m.id !== deactivatedMessageId)
      : activeMessages;
    const recentMessages = filteredMessages.slice(-50);
    for (const msg of recentMessages) {
      if (msg.role === "user" || msg.role === "assistant") {
        messageHistory.push({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        });
      }
    }

    // Add current user message (or intro trigger for autoStart)
    // For regenerate: the last user message is already in the history, so skip
    if (isAutoStart) {
      // Hidden intro trigger — not saved to DB, just sent to the AI
      const introPrompts: Record<string, string> = {
        preparation:
          "Please introduce yourself as my interview coach. Briefly introduce yourself, explain how the preparation session will work (that you will ask me interview questions, assess my answers and give me feedback), and ask me if I’m ready to begin. Keep it brief and encouraging.",
        mock_interview:
          "Please introduce yourself as the interviewer. Briefly introduce yourself, explain how the mock interview will proceed, and ask me if I’m ready to begin. Keep it professional and realistic.",
      };
      const introPrompt =
        introPrompts[chat.type] ??
        "Please greet me and explain how this session will work.";
      messageHistory.push({ role: "user", content: introPrompt });
    } else if (!isRegenerate) {
      messageHistory.push({ role: "user", content: sanitizedContent });
    }

    // Estimate user message tokens (rough: ~1 token per 4 chars)
    if (!isAutoStart) {
      const estimatedTokens = Math.ceil(sanitizedContent.length / 4);
      // Update the user message we just created with token estimate
      const lastUserMsg = await prisma.message.findFirst({
        where: { chatId, role: "user" },
        orderBy: { createdAt: "desc" },
      });
      if (lastUserMsg) {
        await prisma.message.update({
          where: { id: lastUserMsg.id },
          data: { tokens: estimatedTokens },
        });
      }
    }

    const modelUsed = featureSettings.model;

    // Models that only accept default values for certain params
    const isRestricted = ["gpt-5-mini", "gpt-5-nano"].includes(modelUsed);
    const noTemperature = isRestricted;
    const noFreqPenalty = isRestricted;
    const noTopP = isRestricted;

    // Stream response from OpenAI using config settings
    const stream = await openai.chat.completions.create({
      model: modelUsed,
      messages: messageHistory,
      ...(!noTemperature &&
        featureSettings.temperature != null && {
          temperature: featureSettings.temperature,
        }),
      stream: true,
      stream_options: { include_usage: true },
      ...(featureSettings.maxTokens != null && {
        max_tokens: featureSettings.maxTokens,
      }),
      ...(!noTopP &&
        featureSettings.topP != null &&
        featureSettings.topP !== 1 && { top_p: featureSettings.topP }),
      ...(!noFreqPenalty &&
        featureSettings.frequencyPenalty != null &&
        featureSettings.frequencyPenalty !== 0 && {
          frequency_penalty: featureSettings.frequencyPenalty,
        }),
    });

    // Create a readable stream for the response
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        let fullResponse = "";
        let completionTokens = 0;
        let promptTokens = 0;
        const streamStartTime = Date.now();
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content || "";
            if (text) {
              fullResponse += text;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
              );
            }
            // Capture usage from the final chunk (stream_options: include_usage)
            if (chunk.usage) {
              completionTokens = chunk.usage.completion_tokens ?? 0;
              promptTokens = chunk.usage.prompt_tokens ?? 0;
            }
          }

          const durationMs = Date.now() - streamStartTime;

          // Calculate cost breakdown using model pricing constants
          const pricing = MODEL_PRICING[modelUsed] ?? MODEL_PRICING["gpt-4.1-mini"];
          const inputCost = (promptTokens * pricing.input) / 1_000_000;
          const outputCost = (completionTokens * pricing.output) / 1_000_000;
          const totalCost = inputCost + outputCost;

          // Save assistant message to DB
          const assistantMessage = await prisma.message.create({
            data: {
              chatId,
              role: "assistant",
              content: fullResponse,
              tokens: completionTokens,
              inputTokens: promptTokens,
              model: modelUsed,
              cost: Math.round(totalCost * 1_000_000) / 1_000_000,
              ...(regenerateVersionGroup && {
                versionGroup: regenerateVersionGroup,
              }),
            },
          });

          // Extract score if present (for preparation chats)
          const scoreMatch = fullResponse.match(
            /(?:\*\*)?Score:(?:\*\*)?\s*(\d+(?:\.\d+)?)\s*\/\s*10/
          );
          if (scoreMatch) {
            const score = parseFloat(scoreMatch[1]);
            // Update the user's last message with the score and flagged status
            const lastUserMessage = await prisma.message.findFirst({
              where: { chatId, role: "user" },
              orderBy: { createdAt: "desc" },
            });
            if (lastUserMessage) {
              await prisma.message.update({
                where: { id: lastUserMessage.id },
                data: {
                  score,
                  flagged: score < 7, // 0-6: needs revisiting
                },
              });
            }

            // Update project overallScore (average of all scored messages)
            const allScored = await prisma.message.findMany({
              where: {
                role: "user",
                score: { not: null },
                chat: { projectId: chat.projectId },
              },
              select: { score: true },
            });
            if (allScored.length > 0) {
              const avg =
                allScored.reduce((sum, m) => sum + (m.score ?? 0), 0) /
                allScored.length;
              await prisma.project.update({
                where: { id: chat.projectId },
                data: { overallScore: Math.round(avg * 10) / 10 },
              });
            }
          }

          // Extract category if present
          const categoryMatch = fullResponse.match(
            /\*\*Category:\*\*\s*(?:🏆|🧠|🏢|👥|📚)?\s*(.+)/
          );
          if (categoryMatch) {
            await prisma.message.update({
              where: { id: assistantMessage.id },
              data: { category: categoryMatch[1].trim() },
            });
            // Also store category on the user message for easier querying
            if (scoreMatch) {
              const lastUserMessage = await prisma.message.findFirst({
                where: { chatId, role: "user" },
                orderBy: { createdAt: "desc" },
              });
              if (lastUserMessage) {
                await prisma.message.update({
                  where: { id: lastUserMessage.id },
                  data: { category: categoryMatch[1].trim() },
                });
              }
            }
          }

          // Send done signal with full token breakdown
          const tokensPerSec =
            durationMs > 0
              ? Math.round((completionTokens / (durationMs / 1000)) * 100) / 100
              : 0;

          // Compute version info for regenerated messages
          let versionInfo: { versionGroup: string; versionIndex: number; versionTotal: number } | undefined;
          if (regenerateVersionGroup) {
            const allVersions = await prisma.message.findMany({
              where: { versionGroup: regenerateVersionGroup },
              orderBy: { createdAt: "asc" },
              select: { id: true },
            });
            versionInfo = {
              versionGroup: regenerateVersionGroup,
              versionIndex: allVersions.findIndex((v) => v.id === assistantMessage.id),
              versionTotal: allVersions.length,
            };
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                done: true,
                messageId: assistantMessage.id,
                inputTokens: promptTokens,
                outputTokens: completionTokens,
                totalTokens: promptTokens + completionTokens,
                model: modelUsed,
                inputCost: Math.round(inputCost * 1_000_000) / 1_000_000,
                outputCost: Math.round(outputCost * 1_000_000) / 1_000_000,
                totalCost: Math.round(totalCost * 1_000_000) / 1_000_000,
                durationMs,
                tokensPerSec,
                ...(versionInfo && { version: versionInfo }),
              })}\n\n`
            )
          );
          controller.close();
        } catch (error) {
          console.error("Streaming error:", error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: "Streaming failed" })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Failed to process message:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process message" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
