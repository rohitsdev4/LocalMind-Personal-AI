// ================================================================
// LocalMind -- AI Hook (OpenRouter API)
// Handles streaming chat completions, tool calling, and context management
// ================================================================

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import {
    ChatMessage,
    EngineStatus,
    UserSettings,
} from "@/lib/types";
import { buildSystemPrompt } from "@/lib/systemPrompt";
import { parseToolCalls, looksLikeFailedToolCall } from "@/lib/toolParser";
import { executeTool, restoreReminders } from "@/lib/tools";
import { getContextWindow, addToMemory } from "@/lib/memory";
import * as db from "@/lib/db";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MAX_TOOL_ITERATIONS = 3;

export function useWebLLM() {
    const [status, setStatus] = useState<EngineStatus>("idle");
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [currentModel, setCurrentModel] = useState("meta-llama/llama-3.3-70b-instruct:free");

    const abortControllerRef = useRef<AbortController | null>(null);
    const systemPromptRef = useRef<string>("");
    const settingsRef = useRef<UserSettings | null>(null);
    const initializedRef = useRef(false);

    // ================================================================
    // Load settings and auto-initialize
    // ================================================================

    useEffect(() => {
        async function loadAndInit() {
            if (initializedRef.current) return;

            const settings = await db.getSettings();
            settingsRef.current = settings;
            setCurrentModel(settings.selectedModel);

            // Load existing chat session
            const session = await db.getChatSession();
            if (session.messages.length > 0) {
                setMessages(session.messages);
            }

            // Auto-init if API key exists
            if (settings.openRouterApiKey) {
                await initEngine();
            }

            // Restore pending reminders
            restoreReminders();

            initializedRef.current = true;
        }
        loadAndInit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ================================================================
    // Initialize engine (build system prompt, verify API key)
    // ================================================================

    const initEngine = useCallback(async () => {
        try {
            setStatus("loading");
            const settings = await db.getSettings();
            settingsRef.current = settings;

            if (!settings.openRouterApiKey) {
                setStatus("error");
                return;
            }

            // Build system prompt with tool definitions and memory
            systemPromptRef.current = await buildSystemPrompt();
            setCurrentModel(settings.selectedModel);
            setStatus("ready");
        } catch (error) {
            console.error("[LocalMind] Init error:", error);
            setStatus("error");
        }
    }, []);

    // ================================================================
    // Auto-save messages to IndexedDB
    // ================================================================

    const saveSession = useCallback(async (msgs: ChatMessage[]) => {
        const session = await db.getChatSession();
        session.messages = msgs;
        if (msgs.length > 0) {
            // Auto-title from first user message
            const firstUser = msgs.find((m) => m.role === "user");
            if (firstUser && session.title === "New Chat") {
                session.title = firstUser.content.substring(0, 50) + (firstUser.content.length > 50 ? "..." : "");
            }
        }
        await db.saveChatSession(session);
    }, []);

    // ================================================================
    // Send message to OpenRouter API
    // ================================================================

    const sendMessage = useCallback(async (content: string) => {
        if (!content.trim() || isGenerating) return;

        const settings = settingsRef.current || await db.getSettings();
        if (!settings.openRouterApiKey) {
            console.error("[LocalMind] No API key");
            return;
        }

        // Ensure engine is ready
        if (status !== "ready") {
            await initEngine();
            if (!systemPromptRef.current) return;
        }

        setIsGenerating(true);

        // Create user message
        const userMessage: ChatMessage = {
            id: uuidv4(),
            role: "user",
            content: content.trim(),
            timestamp: new Date().toISOString(),
        };

        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);

        try {
            await generateResponse(updatedMessages, settings);
        } catch (error) {
            if ((error as Error).name !== "AbortError") {
                console.error("[LocalMind] Send error:", error);
                const errorMsg: ChatMessage = {
                    id: uuidv4(),
                    role: "assistant",
                    content: `Sorry, I encountered an error: ${(error as Error).message || "Unknown error"}. Please check your API key in settings.`,
                    timestamp: new Date().toISOString(),
                };
                const withError = [...updatedMessages, errorMsg];
                setMessages(withError);
                await saveSession(withError);
            }
        } finally {
            setIsGenerating(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [messages, isGenerating, status]);

    // ================================================================
    // Generate response with streaming and tool call loop
    // ================================================================

    const generateResponse = async (
        currentMessages: ChatMessage[],
        settings: UserSettings
    ) => {
        let iterationMessages = [...currentMessages];
        let toolIteration = 0;

        while (toolIteration < MAX_TOOL_ITERATIONS) {
            // Build context window
            const contextWindow = await getContextWindow(
                iterationMessages,
                settings.maxContextMessages || 50
            );

            // Prepare messages for API - include tool results as context
            const apiMessages: Array<{ role: string; content: string }> = [
                { role: "system", content: systemPromptRef.current },
            ];

            for (const msg of contextWindow) {
                if (msg.role === "tool") {
                    // Convert tool results to system messages so the API sees them
                    const toolName = msg.toolName || "tool";
                    const result = msg.toolResult as { success?: boolean; message?: string } | undefined;
                    const resultText = result?.message || msg.content || "Tool executed";
                    apiMessages.push({
                        role: "system",
                        content: `[Tool Result - ${toolName}]: ${resultText}`,
                    });
                } else if (msg.role === "user" || msg.role === "assistant") {
                    apiMessages.push({
                        role: msg.role,
                        content: msg.content,
                    });
                }
            }

            // Create assistant message placeholder
            const assistantMessage: ChatMessage = {
                id: uuidv4(),
                role: "assistant",
                content: "",
                timestamp: new Date().toISOString(),
            };

            const withAssistant = [...iterationMessages, assistantMessage];
            setMessages(withAssistant);

            // Call OpenRouter API with streaming
            abortControllerRef.current = new AbortController();

            const response = await fetch(OPENROUTER_API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${settings.openRouterApiKey}`,
                    "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "https://localmind.app",
                    "X-Title": "LocalMind",
                },
                body: JSON.stringify({
                    model: settings.selectedModel || currentModel,
                    messages: apiMessages,
                    stream: true,
                    max_tokens: 2048,
                    temperature: 0.7,
                }),
                signal: abortControllerRef.current.signal,
            });

            if (!response.ok) {
                const errorBody = await response.text();
                let errorMessage = `API error (${response.status})`;
                try {
                    const errorJson = JSON.parse(errorBody);
                    errorMessage = errorJson.error?.message || errorMessage;
                } catch {
                    // Use default error message
                }
                throw new Error(errorMessage);
            }

            // Stream the response
            const reader = response.body?.getReader();
            if (!reader) throw new Error("No response body");

            const decoder = new TextDecoder();
            let fullContent = "";
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || !trimmed.startsWith("data: ")) continue;
                    const data = trimmed.slice(6);
                    if (data === "[DONE]") continue;

                    try {
                        const parsed = JSON.parse(data);
                        const delta = parsed.choices?.[0]?.delta?.content;
                        if (delta) {
                            fullContent += delta;
                            // Update message in real-time
                            assistantMessage.content = fullContent;
                            setMessages([...iterationMessages, { ...assistantMessage }]);
                        }
                    } catch {
                        // Skip malformed SSE data
                    }
                }
            }

            // Finalize assistant message
            assistantMessage.content = fullContent;

            // Check for tool calls
            const { toolCalls, cleanText, hasToolCalls } = parseToolCalls(fullContent);

            if (hasToolCalls && toolIteration < MAX_TOOL_ITERATIONS - 1) {
                // Update assistant message with clean text
                assistantMessage.content = cleanText;
                iterationMessages = [...iterationMessages, { ...assistantMessage }];
                setMessages([...iterationMessages]);

                // Execute each tool call
                for (const toolCall of toolCalls) {
                    const result = await executeTool(toolCall);

                    // Create tool result message
                    const toolMessage: ChatMessage = {
                        id: uuidv4(),
                        role: "tool",
                        content: result.message,
                        timestamp: new Date().toISOString(),
                        toolName: toolCall.name,
                        toolResult: result,
                    };

                    iterationMessages = [...iterationMessages, toolMessage];
                    setMessages([...iterationMessages]);
                }

                toolIteration++;
                // Continue loop for AI to process tool results
            } else {
                // No tool calls or max iterations reached
                if (hasToolCalls && toolIteration >= MAX_TOOL_ITERATIONS - 1) {
                    // Execute remaining tool calls but don't loop back
                    for (const toolCall of toolCalls) {
                        const result = await executeTool(toolCall);
                        const toolMessage: ChatMessage = {
                            id: uuidv4(),
                            role: "tool",
                            content: result.message,
                            timestamp: new Date().toISOString(),
                            toolName: toolCall.name,
                            toolResult: result,
                        };
                        iterationMessages = [...iterationMessages, { ...assistantMessage }, toolMessage];
                    }
                    setMessages([...iterationMessages]);
                } else {
                    // Check for failed tool calls
                    if (looksLikeFailedToolCall(fullContent)) {
                        console.warn("[LocalMind] Detected failed tool call pattern in:", fullContent);
                    }
                    iterationMessages = [...iterationMessages, { ...assistantMessage }];
                    setMessages([...iterationMessages]);
                }

                // Save and add to memory
                await saveSession(iterationMessages);
                await addToMemory(iterationMessages);
                break;
            }
        }
    };

    // ================================================================
    // Stop generation
    // ================================================================

    const stopGeneration = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsGenerating(false);
    }, []);

    // ================================================================
    // Clear messages (new chat)
    // ================================================================

    const clearMessages = useCallback(async () => {
        setMessages([]);
        await db.clearChatSession();
    }, []);

    // ================================================================
    // Update model without clearing chat
    // ================================================================

    const updateModel = useCallback(async (modelId: string) => {
        setCurrentModel(modelId);
        await db.updateSettings({ selectedModel: modelId });
        if (settingsRef.current) {
            settingsRef.current.selectedModel = modelId;
        }
    }, []);

    return {
        status,
        messages,
        isGenerating,
        currentModel,
        sendMessage,
        initEngine,
        clearMessages,
        stopGeneration,
        updateModel,
    };
}
