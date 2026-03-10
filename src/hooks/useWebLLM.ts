// ============================================================
// LocalMind — OpenRouter Hook (STREAMING + OPTIMIZED)
// ============================================================

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import type {
    ChatMessage,
    EngineStatus,
    UserSettings,
} from "@/lib/types";
import {
    parseToolCalls,
    looksLikeFailedToolCall,
} from "@/lib/toolParser";
import { executeTool } from "@/lib/tools";
import { getContextWindow } from "@/lib/memory";
import { buildSystemPrompt } from "@/lib/systemPrompt";
import db from "@/lib/db";

// ============================================================
// Types
// ============================================================

interface UseWebLLMReturn {
    status: EngineStatus;
    messages: ChatMessage[];
    isGenerating: boolean;
    error: string | null;
    initEngine: (modelId?: string) => Promise<void>;
    sendMessage: (content: string) => Promise<void>;
    clearMessages: () => void;
    stopGeneration: () => void;
}

// ============================================================
// Hook Implementation
// ============================================================

export function useWebLLM(): UseWebLLMReturn {
    const [status, setStatus] = useState<EngineStatus>("idle");
    const [error, setError] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const abortRef = useRef<AbortController | null>(null);

    // Messages
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const messagesRef = useRef<ChatMessage[]>([]);

    // Keep ref in sync with state
    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    // ============================================================
    // Engine Initialization
    // ============================================================

    const initEngine = useCallback(async () => {
        try {
            setStatus("loading");
            setError(null);

            setStatus("ready");

            // Build and set the initial system prompt
            const systemPrompt = await buildSystemPrompt();
            const systemMessage: ChatMessage = {
                id: uuidv4(),
                role: "system",
                content: systemPrompt,
                timestamp: new Date().toISOString(),
            };

            setMessages([systemMessage]);
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            setError(`Failed to initialize: ${errMsg}`);
            setStatus("error");
            console.error("Init error:", err);
        }
    }, []);

    // ============================================================
    // STREAMING Message Generation (KEY OPTIMIZATION)
    // ============================================================

    const sendMessage = useCallback(
        async (content: string) => {
            if (isGenerating) return;

            abortRef.current = new AbortController();

            // Add user message
            const userMessage: ChatMessage = {
                id: uuidv4(),
                role: "user",
                content,
                timestamp: new Date().toISOString(),
            };

            const updatedMessages = [...messagesRef.current, userMessage];
            setMessages(updatedMessages);
            setIsGenerating(true);
            setStatus("generating");

            try {
                // Get context window
                const settings = await db.getSettings();

                if (!settings.openRouterApiKey) {
                    throw new Error("OpenRouter API Key is missing. Please enter it in Settings.");
                }

                const contextMessages = await getContextWindow(
                    updatedMessages,
                    Math.min(settings.maxContextMessages, 8)
                );

                // Format for API
                const llmMessages = contextMessages
                    .filter((m) => m.role !== "tool") // Skip tool messages
                    .map((m) => ({
                        role: (m.role === "tool" ? "system" : m.role) as
                            | "system"
                            | "user"
                            | "assistant",
                        content: m.content,
                    }));

                // ====== STREAMING GENERATION ======
                const assistantMsgId = uuidv4();
                const assistantMessage: ChatMessage = {
                    id: assistantMsgId,
                    role: "assistant",
                    content: "",
                    timestamp: new Date().toISOString(),
                };

                // Add empty assistant message to UI immediately
                setMessages((prev) => [...prev, assistantMessage]);

                let fullContent = "";

                let response: Response | null = null;
                let usedApi: "openrouter" | "anthropic" | "openai" = "openrouter";

                const tryOpenRouter = async () => {
                    let orResponse: Response | null = null;
                    const maxRetries = 2;
                    for (let attempt = 0; attempt <= maxRetries; attempt++) {
                        try {
                            orResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                                method: "POST",
                                headers: {
                                    "Authorization": `Bearer ${settings.openRouterApiKey}`,
                                    "HTTP-Referer": window.location.href,
                                    "X-Title": "LocalMind",
                                    "Content-Type": "application/json"
                                },
                                body: JSON.stringify({
                                    model: settings.selectedModel,
                                    messages: llmMessages,
                                    stream: true,
                                }),
                                signal: abortRef.current?.signal,
                            });
                            if (orResponse.ok) return orResponse;
                            if (orResponse.status !== 429 && orResponse.status < 500) break;
                            if (attempt < maxRetries) await new Promise((res) => setTimeout(res, 1000 * (attempt + 1)));
                        } catch (err) {
                            if (abortRef.current?.signal.aborted) throw err;
                            if (attempt === maxRetries) break;
                            await new Promise((res) => setTimeout(res, 1000 * (attempt + 1)));
                        }
                    }
                    return orResponse;
                };

                const tryAnthropic = async () => {
                    if (!settings.anthropicApiKey) return null;
                    // Format messages for Anthropic (system is separated, user/assistant alternating)
                    const systemMsgs = llmMessages.filter(m => m.role === "system").map(m => m.content).join("\n");
                    const antMsgs = llmMessages.filter(m => m.role !== "system").map(m => ({
                        role: m.role,
                        content: m.content
                    }));

                    try {
                        const antResponse = await fetch("https://api.anthropic.com/v1/messages", {
                            method: "POST",
                            headers: {
                                "x-api-key": settings.anthropicApiKey,
                                "anthropic-version": "2023-06-01",
                                "anthropic-dangerously-allow-browser": "true",
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({
                                model: "claude-3-5-sonnet-20241022",
                                system: systemMsgs || undefined,
                                messages: antMsgs,
                                max_tokens: 1024,
                                stream: true,
                            }),
                            signal: abortRef.current?.signal,
                        });
                        return antResponse;
                    } catch (err) {
                        if (abortRef.current?.signal.aborted) throw err;
                        return null;
                    }
                };

                const tryOpenAI = async () => {
                    if (!settings.openaiApiKey) return null;
                    try {
                        const oaResponse = await fetch("https://api.openai.com/v1/chat/completions", {
                            method: "POST",
                            headers: {
                                "Authorization": `Bearer ${settings.openaiApiKey}`,
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({
                                model: "gpt-4o",
                                messages: llmMessages,
                                stream: true,
                            }),
                            signal: abortRef.current?.signal,
                        });
                        return oaResponse;
                    } catch (err) {
                        if (abortRef.current?.signal.aborted) throw err;
                        return null;
                    }
                };

                // Fallback Logic Sequence
                response = await tryOpenRouter();
                if (response && response.ok) {
                    usedApi = "openrouter";
                } else {
                    response = await tryAnthropic();
                    if (response && response.ok) {
                        usedApi = "anthropic";
                    } else {
                        response = await tryOpenAI();
                        if (response && response.ok) {
                            usedApi = "openai";
                        }
                    }
                }

                if (!response || !response.ok) {
                    const errorText = response ? await response.text() : "All APIs failed";
                    throw new Error(`API error (${response?.status || "Unknown"}): ${errorText}`);
                }

                if (!response.body) {
                    throw new Error("No response body returned from API.");
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = "";

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split("\n");

                    // Keep the last partial line in the buffer
                    buffer = lines.pop() || "";

                    for (const line of lines) {
                        const trimmedLine = line.trim();
                        if (!trimmedLine) continue;

                        if (usedApi === "anthropic") {
                            if (trimmedLine.startsWith("event: ")) continue;
                            if (trimmedLine.startsWith("data: ")) {
                                const data = trimmedLine.slice(6);
                                try {
                                    const parsed = JSON.parse(data);
                                    if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                                        fullContent += parsed.delta.text;
                                        setMessages((prev) =>
                                            prev.map((m) =>
                                                m.id === assistantMsgId
                                                    ? { ...m, content: fullContent }
                                                    : m
                                            )
                                        );
                                    }
                                } catch {
                                    // ignore parse errors
                                }
                            }
                        } else {
                            // OpenRouter & OpenAI
                            if (trimmedLine.startsWith("data: ")) {
                                const data = trimmedLine.slice(6);
                                if (data === "[DONE]") continue;

                                try {
                                    const parsed = JSON.parse(data);
                                    const delta = parsed.choices?.[0]?.delta?.content || "";
                                    if (delta) {
                                        fullContent += delta;
                                        setMessages((prev) =>
                                            prev.map((m) =>
                                                m.id === assistantMsgId
                                                    ? { ...m, content: fullContent }
                                                    : m
                                            )
                                        );
                                    }
                                } catch (e) {
                                    console.error("Error parsing JSON chunk:", e, data);
                                }
                            }
                        }
                    }
                }

                // Process any remaining buffer content
                if (buffer.trim().startsWith("data: ")) {
                    const data = buffer.trim().slice(6);
                    if (data !== "[DONE]") {
                        try {
                            const parsed = JSON.parse(data);
                            let delta = "";
                            if (usedApi === "anthropic") {
                                if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                                    delta = parsed.delta.text;
                                }
                            } else {
                                delta = parsed.choices?.[0]?.delta?.content || "";
                            }

                            if (delta) {
                                fullContent += delta;
                                setMessages((prev) =>
                                    prev.map((m) =>
                                        m.id === assistantMsgId
                                            ? { ...m, content: fullContent }
                                            : m
                                    )
                                );
                            }
                        } catch (e) {
                            console.error("Error parsing final JSON chunk:", e, data);
                        }
                    }
                }

                if (abortRef.current?.signal.aborted) {
                    return;
                }

                // ====== POST-GENERATION: Check for tool calls ======
                const { toolCalls, cleanText, hasToolCalls } =
                    parseToolCalls(fullContent);

                if (hasToolCalls) {
                    // Update the assistant message with cleaned text
                    setMessages((prev) =>
                        prev.map((m) =>
                            m.id === assistantMsgId
                                ? { ...m, content: cleanText || "Let me handle that for you..." }
                                : m
                        )
                    );

                    // Execute each tool call
                    for (const toolCall of toolCalls) {
                        const executingMessage: ChatMessage = {
                            id: uuidv4(),
                            role: "tool",
                            content: `⚙️ Executing ${toolCall.name}...`,
                            toolName: toolCall.name,
                            timestamp: new Date().toISOString(),
                        };
                        setMessages((prev) => [...prev, executingMessage]);

                        // Execute the tool
                        const result = await executeTool(toolCall);

                        // Replace executing message with result
                        const resultMessage: ChatMessage = {
                            id: executingMessage.id,
                            role: "tool",
                            content: result.displayMessage,
                            toolName: toolCall.name,
                            toolResult: result.data,
                            timestamp: new Date().toISOString(),
                        };

                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === executingMessage.id ? resultMessage : m
                            )
                        );

                        // For search_memory, do a quick follow-up (also streamed)
                        if (
                            toolCall.name === "search_memory" &&
                            result.success &&
                            result.data
                        ) {
                            await streamFollowUp(
                                settings,
                                llmMessages,
                                toolCall,
                                result
                            );
                        }
                    }
                } else if (looksLikeFailedToolCall(fullContent)) {
                    // Simple error message for failed tools without retrying stream to save time
                    setMessages((prev) => [
                        ...prev,
                        {
                            id: uuidv4(),
                            role: "assistant",
                            content: "I tried to use a tool, but formatted it incorrectly. Please ask again.",
                            timestamp: new Date().toISOString(),
                        },
                    ]);
                }
            } catch (err) {
                if (err instanceof Error && err.name === 'AbortError') return;

                const errMsg = err instanceof Error ? err.message : String(err);
                setError(`Generation error: ${errMsg}`);
                console.error("Generation error:", err);

                const errorMessage: ChatMessage = {
                    id: uuidv4(),
                    role: "assistant",
                    content: `I encountered an error. Please try again. (${errMsg})`,
                    timestamp: new Date().toISOString(),
                };
                setMessages((prev) => [...prev, errorMessage]);
            } finally {
                setIsGenerating(false);
                setStatus("ready");
            }
        },
        [isGenerating]
    );

    // ============================================================
    // Streaming follow-up for search_memory results
    // ============================================================
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async function streamFollowUp(
        settings: UserSettings,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        baseMsgs: any[],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        toolCall: any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        result: any
    ) {
        if (!settings.openRouterApiKey) return;

        const contextInjection = {
            role: "system" as const,
            content: `[MEMORY RESULTS for "${toolCall.args.query}"]\n${result.displayMessage}\n[END]\nUse this to answer the user. Be concise.`,
        };

        const followUpId = uuidv4();
        setMessages((prev) => [
            ...prev,
            {
                id: followUpId,
                role: "assistant" as const,
                content: "",
                timestamp: new Date().toISOString(),
            },
        ]);

        let followUpContent = "";

        try {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${settings.openRouterApiKey}`,
                    "HTTP-Referer": window.location.href,
                    "X-Title": "LocalMind",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: settings.selectedModel,
                    messages: [...baseMsgs, contextInjection],
                    stream: true,
                }),
                signal: abortRef.current?.signal,
            });

            if (!response.ok || !response.body) return;

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (!trimmedLine) continue;

                    if (trimmedLine.startsWith("data: ")) {
                        const data = trimmedLine.slice(6);
                        if (data === "[DONE]") continue;

                        try {
                            const parsed = JSON.parse(data);
                            const delta = parsed.choices?.[0]?.delta?.content || "";
                            if (delta) {
                                followUpContent += delta;
                                setMessages((prev) =>
                                    prev.map((m) =>
                                        m.id === followUpId
                                            ? { ...m, content: followUpContent }
                                            : m
                                    )
                                );
                            }
                        } catch {
                            // ignore parse errors
                        }
                    }
                }
            }

            if (buffer.trim().startsWith("data: ")) {
                const data = buffer.trim().slice(6);
                if (data !== "[DONE]") {
                    try {
                        const parsed = JSON.parse(data);
                        const delta = parsed.choices?.[0]?.delta?.content || "";
                        if (delta) {
                            followUpContent += delta;
                            setMessages((prev) =>
                                prev.map((m) =>
                                    m.id === followUpId
                                        ? { ...m, content: followUpContent }
                                        : m
                                )
                            );
                        }
                    } catch {
                        // Ignore
                    }
                }
            }
        } catch (err) {
            console.error("Follow-up error:", err);
        }
    }

    // ============================================================
    // Utility Functions
    // ============================================================

    const clearMessages = useCallback(() => {
        const systemMsg = messagesRef.current.find((m) => m.role === "system");
        setMessages(systemMsg ? [systemMsg] : []);
    }, []);

    const stopGeneration = useCallback(() => {
        if (abortRef.current) {
            abortRef.current.abort();
        }
        setIsGenerating(false);
        setStatus("ready");
    }, []);

    // ============================================================
    // Auto-save chat session periodically
    // ============================================================
    useEffect(() => {
        const saveInterval = setInterval(async () => {
            const currentMessages = messagesRef.current;
            if (currentMessages.length > 1) {
                const session = {
                    id: "current_session",
                    title:
                        currentMessages.find((m) => m.role === "user")?.content.slice(0, 50) ||
                        "New Chat",
                    messages: currentMessages,
                    createdAt: currentMessages[0]?.timestamp || new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    summaries: [],
                };
                await db.saveChatSession(session);
            }
        }, 30000);

        return () => clearInterval(saveInterval);
    }, []);

    return {
        status,
        messages,
        isGenerating,
        error,
        initEngine,
        sendMessage,
        clearMessages,
        stopGeneration,
    };
}

export default useWebLLM;
