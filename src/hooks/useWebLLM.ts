// ============================================================
// LocalMind — OpenRouter Hook (STREAMING + OPTIMIZED)
// ============================================================

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import type {
    ChatMessage,
    EngineStatus,
    ModelDownloadProgress,
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
    progress: ModelDownloadProgress;
    messages: ChatMessage[];
    isGenerating: boolean;
    error: string | null;
    webGPUSupported: boolean;
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
    const [webGPUSupported, setWebGPUSupported] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const abortRef = useRef<AbortController | null>(null);

    // Fake progress tracking since we don't download models anymore
    const [progress] = useState<ModelDownloadProgress>({
        progress: 100,
        timeElapsed: 0,
        text: "Ready",
        loaded: 0,
        total: 0,
    });

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

            // Set webGPUSupported to true to bypass check
            setWebGPUSupported(true);

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

                // Use OpenRouter streaming API
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
                        messages: llmMessages,
                        stream: true,
                    }),
                    signal: abortRef.current.signal,
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
                }

                if (!response.body) {
                    throw new Error("No response body returned from OpenRouter API.");
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split("\n").filter((line) => line.trim() !== "");

                    for (const line of lines) {
                        if (line.startsWith("data: ")) {
                            const data = line.slice(6);
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
                            } catch {
                                // Ignore parse errors for incomplete chunks
                            }
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

                        // NOTE: streamFollowUp has been removed for simplicity in this rewrite.
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
        progress,
        messages,
        isGenerating,
        error,
        webGPUSupported,
        initEngine,
        sendMessage,
        clearMessages,
        stopGeneration,
    };
}

export default useWebLLM;
