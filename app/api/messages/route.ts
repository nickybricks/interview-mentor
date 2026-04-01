import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  streamChat,
  createBoundModel,
  toLangChainMessages,
  type ChatMessage,
} from "@/lib/langchain";
import {
  PROMPTS,
  DEFAULT_PROMPT,
  type PromptKey,
  buildCoachingContext,
  buildLinkedInPrompt,
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
import {
  retrieveWithQueryTranslation,
  type RAGSource,
} from "@/lib/rag";
import { interviewTools, kickoffTools, linkedInTools } from "@/lib/tools";
import { ToolMessage } from "@langchain/core/messages";
import { getModelPricing } from "@/lib/model-pricing";

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
      const estimatedTokens = Math.ceil(sanitizedContent.length / 4);
      await prisma.message.create({
        data: {
          chatId,
          role: "user",
          content: sanitizedContent,
          tokens: estimatedTokens,
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
    } else if (chat.type === "linkedin") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chatMeta = chat.metadata as Record<string, any> | null;
      const depthLevel = chatMeta?.depthLevel ?? "standard";
      systemPrompt = buildLinkedInPrompt(chat.project, depthLevel);
    } else {
      systemPrompt = getDefaultSystemPrompt(featureKey);
    }

    // For kickoff chats that were already completed: adjust prompt for follow-up questions
    const isKickoffResumed = chat.type === "kickoff" && chat.status === "completed";
    if (isKickoffResumed) {
      systemPrompt += `\n\n## IMPORTANT: Kickoff Already Completed
The kickoff session was already completed and the coaching profile was saved.
The user has returned with a follow-up question.
- Answer their question helpfully and concisely.
- After answering, call save_coaching_profile again to persist any updates.
- Keep your response focused — do not restart the full kickoff flow.`;
    }

    // Add CV and job description context if available
    let contextInfo = "";
    if (chat.project.cvText) {
      contextInfo += `\n\n## Candidate's CV:\n${chat.project.cvText}`;
    }
    if (chat.project.jobDescription) {
      contextInfo += `\n\n## Target Job Description:\n${chat.project.jobDescription}`;
    }

    // RAG: Retrieve relevant context for preparation, mock_interview, kickoff, and linkedin chats
    const RAG_ENABLED_TYPES = ["preparation", "mock_interview", "kickoff", "linkedin"];
    let ragSources: RAGSource[] = [];
    let ragContext = "";
    const userQuery = isAutoStart ? "" : isRegenerate ? "" : sanitizedContent;

    if (RAG_ENABLED_TYPES.includes(chat.type) && userQuery) {
      try {
        const ragResult = await retrieveWithQueryTranslation(
          userQuery,
          featureKey,
        );
        ragSources = ragResult.sources;
        ragContext = ragResult.context;
      } catch (err) {
        console.error("RAG retrieval failed (non-blocking):", err);
      }
    }

    // Inject coaching context for downstream chats (preparation, mock_interview)
    const COACHING_CONTEXT_TYPES = ["preparation", "mock_interview"];
    if (COACHING_CONTEXT_TYPES.includes(chat.type) && chat.project.coachingState) {
      const coachingContext = buildCoachingContext(chat.project.coachingState);
      if (coachingContext) {
        if (systemPrompt.includes("{{COACHING_STATE}}")) {
          systemPrompt = systemPrompt.replace("{{COACHING_STATE}}", coachingContext);
        } else {
          // Legacy prompt without placeholder: prepend coaching context
          contextInfo = coachingContext + contextInfo;
        }
      }
    }

    // Remove any unreplaced {{COACHING_STATE}} placeholder (no coaching state available)
    if (systemPrompt.includes("{{COACHING_STATE}}")) {
      systemPrompt = systemPrompt.replace("{{COACHING_STATE}}", "");
    }

    // Build full system prompt: base + CV/JD context + RAG context
    // LinkedIn prompt already includes the current date via buildLinkedInPrompt; inject for all other types here.
    let fullSystemPrompt = systemPrompt + contextInfo;
    if (chat.type !== "linkedin") {
      fullSystemPrompt += `\n\nCURRENT DATE (UTC): ${new Date().toISOString()}`;
    }
    if (ragContext) {
      fullSystemPrompt += `\n\n## Relevant Context\nThe following excerpts were retrieved from the knowledge base and uploaded documents. Use them to inform your response when relevant:\n\n${ragContext}`;
    }

    // Build message history for LangChain
    const messageHistory: ChatMessage[] = [
      { role: "system", content: fullSystemPrompt },
    ];

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
        kickoff:
          "Please introduce yourself as Interview Mentor, the candidate’s personal interview coach. Warmly welcome them and explain that this is the kickoff session where you’ll get to know them and build a personalized coaching plan. Then ask your first question: What role or roles are you preparing for?",
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

    const modelUsed = featureSettings.model;

    // Determine if tools should be available
    const TOOL_ENABLED_TYPES = ["preparation", "mock_interview", "kickoff", "linkedin"];
    const toolsEnabled = TOOL_ENABLED_TYPES.includes(chat.type) && !isAutoStart;

    const chatOptions = {
      model: modelUsed,
      temperature: featureSettings.temperature,
      maxTokens: featureSettings.maxTokens,
      topP: featureSettings.topP,
      frequencyPenalty: featureSettings.frequencyPenalty,
    };

    // Create a readable stream for the response
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        let fullResponse = "";
        let completionTokens = 0;
        let promptTokens = 0;
        const streamStartTime = Date.now();
        // Collect tool call results for the frontend
        const toolCallResults: { name: string; result: unknown }[] = [];
        let kickoffCompleteSent = false;

        try {
          if (toolsEnabled) {
            // ─── Tool-calling path ──────────────────────────────────────
            const activeTools =
              chat.type === "kickoff"
                ? kickoffTools
                : chat.type === "linkedin"
                  ? linkedInTools
                  : interviewTools;
            const boundModel = createBoundModel(activeTools, chatOptions);
            const lcMessages = toLangChainMessages(messageHistory);

            // Tool execution loop: stream → check for tool calls → execute → re-stream
            let maxIterations = 5;
            while (maxIterations-- > 0) {
              const stream = await boundModel.stream(lcMessages);

              // Collect streamed chunks to detect tool calls
              let collectedText = "";
              let responseForHistory: import("@langchain/core/messages").AIMessageChunk | null = null;

              for await (const chunk of stream) {
                // Accumulate for history (concat chunks)
                responseForHistory = responseForHistory
                  ? responseForHistory.concat(chunk)
                  : chunk;

                // Capture usage from final chunk
                if (chunk.usage_metadata) {
                  completionTokens += chunk.usage_metadata.output_tokens ?? 0;
                  promptTokens += chunk.usage_metadata.input_tokens ?? 0;
                }

                // Stream text content to client in real-time
                const text = typeof chunk.content === "string" ? chunk.content : "";
                if (text) {
                  collectedText += text;
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
                  );
                }
              }

              // Check if the full response has tool calls
              const toolCalls = responseForHistory?.tool_calls;
              if (!toolCalls || toolCalls.length === 0) {
                // No tool calls — text was already streamed above
                if (collectedText) {
                  fullResponse = collectedText;
                }
                break;
              }

              // Execute each tool call
              lcMessages.push(responseForHistory!);
              for (const tc of toolCalls) {
                // Notify frontend that tool is running
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ toolCall: { name: tc.name, status: "running" } })}\n\n`
                  )
                );

                // Inject projectId and jobDescription where needed
                const args = { ...tc.args };
                if (tc.name === "get_weak_areas") {
                  args.projectId = chat.projectId;
                }
                if (tc.name === "score_answer" && !args.jobDescription) {
                  args.jobDescription = chat.project.jobDescription ?? "";
                }
                if (tc.name === "save_coaching_profile") {
                  args.projectId = chat.projectId;
                  args.chatId = chatId;
                }
                if (tc.name === "save_linkedin_analysis") {
                  args.projectId = chat.projectId;
                }
                if (tc.name === "update_coaching_state") {
                  args.projectId = chat.projectId;
                }

                // Find and execute the tool
                const toolDef = activeTools.find((t) => t.name === tc.name);
                let toolResult = "";
                if (toolDef) {
                  try {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    toolResult = await (toolDef as any).invoke(args);
                  } catch (err) {
                    console.error(`Tool ${tc.name} failed:`, err);
                    toolResult = JSON.stringify({ error: `Tool ${tc.name} failed` });
                  }
                }

                // Parse and track results for the frontend
                let parsedResult: unknown;
                try {
                  parsedResult = JSON.parse(toolResult);
                } catch {
                  parsedResult = toolResult;
                }
                toolCallResults.push({ name: tc.name, result: parsedResult });

                // Notify frontend that tool is done
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ toolCall: { name: tc.name, status: "done", result: parsedResult } })}\n\n`
                  )
                );

                // Send kickoff_complete signal (only once per response, only for kickoff chats)
                if (tc.name === "save_coaching_profile" && chat.type === "kickoff" && !kickoffCompleteSent) {
                  kickoffCompleteSent = true;
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ kickoff_complete: true })}\n\n`)
                  );
                }

                // Add tool result as ToolMessage to conversation
                lcMessages.push(
                  new ToolMessage({
                    content: toolResult,
                    tool_call_id: tc.id ?? tc.name,
                  })
                );
              }
              // Loop back to get the LLM's final response incorporating tool results
            }

            // If the tool loop exhausted all iterations without a final text response
            if (maxIterations <= 0 && !fullResponse) {
              console.warn(`[messages] Tool loop hit max iterations for chat ${chatId}`);
              fullResponse = "I wasn't able to complete that in time. Please try again.";
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: fullResponse })}\n\n`)
              );
            }
          } else {
            // ─── Standard streaming path (no tools) ─────────────────────
            const stream = await streamChat(messageHistory, chatOptions);

            for await (const chunk of stream) {
              const text =
                typeof chunk.content === "string" ? chunk.content : "";
              if (text) {
                fullResponse += text;
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
                );
              }
              if (chunk.usage_metadata) {
                completionTokens = chunk.usage_metadata.output_tokens ?? 0;
                promptTokens = chunk.usage_metadata.input_tokens ?? 0;
              }
            }
          }

          const durationMs = Date.now() - streamStartTime;

          // Calculate cost breakdown using dynamic model pricing
          const pricing = await getModelPricing(modelUsed);
          const inputCost = (promptTokens * pricing.input) / 1_000_000;
          const outputCost = (completionTokens * pricing.output) / 1_000_000;
          const totalCost = inputCost + outputCost;

          // Save assistant message to DB (include tool call results if any)
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
              ...(toolCallResults.length > 0 && {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                toolCalls: toolCallResults.map((tc) => ({
                  name: tc.name,
                  status: "done",
                  result: tc.result,
                })) as any,
              }),
            },
          });

          // Extract score — prefer tool-based score, fallback to regex
          let extractedScore: number | null = null;

          const scoreToolResult = toolCallResults.find((tc) => tc.name === "score_answer");
          if (scoreToolResult && typeof scoreToolResult.result === "object" && scoreToolResult.result !== null) {
            const result = scoreToolResult.result as { overallScore?: number };
            if (result.overallScore != null) {
              extractedScore = result.overallScore;
            }
          }

          if (extractedScore == null) {
            const scoreMatch = fullResponse.match(
              /(?:\*\*)?Score:(?:\*\*)?\s*(\d+(?:\.\d+)?)\s*\/\s*10/
            );
            if (scoreMatch) {
              extractedScore = parseFloat(scoreMatch[1]);
            }
          }

          // Extract category if present
          const categoryMatch = fullResponse.match(
            /\*\*Category:\*\*\s*(?:🏆|🧠|🏢|👥|📚)?\s*(.+)/
          );
          const extractedCategory = categoryMatch?.[1]?.trim() ?? null;

          // Batch post-stream DB updates in parallel (async-parallel)
          const postStreamUpdates: Promise<unknown>[] = [];

          // Persist RAG sources (non-blocking — schema field may not be in older client versions)
          if (ragSources.length > 0) {
            postStreamUpdates.push(
              prisma.message.update({
                where: { id: assistantMessage.id },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                data: { sources: ragSources.map((s) => ({
                  source: s.source,
                  similarity: Math.round(s.similarity * 1000) / 1000,
                  preview: s.content.slice(0, 100),
                })) as any },
              }).catch((err) => console.warn("[messages] sources update skipped:", err))
            );
          }

          // Update assistant message category
          if (extractedCategory) {
            postStreamUpdates.push(
              prisma.message.update({
                where: { id: assistantMessage.id },
                data: { category: extractedCategory },
              })
            );
          }

          // Update user message with score + category, then recalculate project average
          if (extractedScore != null || extractedCategory) {
            const score = extractedScore;
            postStreamUpdates.push(
              (async () => {
                const lastUserMessage = await prisma.message.findFirst({
                  where: { chatId, role: "user" },
                  orderBy: { createdAt: "desc" },
                });
                if (!lastUserMessage) return;

                // Single update for score + category on user message
                await prisma.message.update({
                  where: { id: lastUserMessage.id },
                  data: {
                    ...(score != null && { score, flagged: score < 7 }),
                    ...(extractedCategory && { category: extractedCategory }),
                  },
                });

                // Recalculate project average if scored
                if (score != null) {
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
              })()
            );
          }

          await Promise.all(postStreamUpdates);

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

          // Send sources AFTER the done event
          if (ragSources.length > 0) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  sources: ragSources.map((s) => ({
                    source: s.source,
                    similarity: Math.round(s.similarity * 1000) / 1000,
                    preview: s.content.slice(0, 100),
                  })),
                })}\n\n`
              )
            );
          }

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
