// ============================================================
// LocalMind — WebLLM Hook
// React hook for managing the AI engine lifecycle:
//   - Model download & initialization
//   - Chat completion with streaming
//   - Context window management
//   - Tool call detection and execution
// ============================================================

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import type {
    ChatMessage,
    EngineStatus,
    ModelDownloadProgress,
    UserSettings,
} from "@/lib/types";
import { parseToolCalls, generateRetryPrompt, looksLikeFailedToolCall } from "@/lib/toolParser";
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
    // Engine state
    const engineRef = useRef<import("@mlc-ai/web-llm").MLCEngine | null>(null);
    const [status, setStatus] = useState<EngineStatus>("idle");
    const [error, setError] = useState<string | null>(null);
    const [webGPUSupported, setWebGPUSupported] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const abortRef = useRef(false);

    // Progress tracking
    const [progress, setProgress] = useState<ModelDownloadProgress>({
        progress: 0,
        timeElapsed: 0,
        text: "Preparing...",
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
    // WebGPU Detection
    // ============================================================
    useEffect(() => {
        const checkWebGPU = async () => {
            if (typeof navigator === "undefined") return;
            try {
                if (!("gpu" in navigator)) {
                    setWebGPUSupported(false);
                    setError(
                        "WebGPU is not supported in your browser. Please use Chrome 113+ or Edge 113+ on a supported device."
                    );
                    return;
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const gpu = (navigator as any).gpu;
                const adapter = await gpu.requestAdapter();
                if (!adapter) {
                    setWebGPUSupported(false);
                    setError(
                        "WebGPU adapter not found. Your device may not support GPU acceleration."
                    );
                }
            } catch {
                setWebGPUSupported(false);
                setError("WebGPU check failed. Please try a newer browser.");
            }
        };
        checkWebGPU();
    }, []);

    // ============================================================
    // Engine Initialization
    // ============================================================

    const initEngine = useCallback(async (modelId?: string) => {
        if (engineRef.current) return;

        try {
            setStatus("downloading");
            setError(null);
            const startTime = Date.now();

            // Dynamically import WebLLM (it's a large module)
            const webllm = await import("@mlc-ai/web-llm");

            // Get user settings for model selection
            const settings: UserSettings = await db.getSettings();
            const selectedModel = modelId || settings.selectedModel;

            // Create the engine with progress tracking
            const engine = new webllm.MLCEngine();

            // Set up progress callback
            engine.setInitProgressCallback(
                (report: { progress: number; text: string }) => {
                    const elapsed = (Date.now() - startTime) / 1000;

                    // Parse progress details from the text
                    const sizeMatch = report.text.match(
                        /(\d+(?:\.\d+)?)\s*(?:MB|GB)\s*\/\s*(\d+(?:\.\d+)?)\s*(?:MB|GB)/i
                    );
                    let loaded = 0;
                    let total = 0;
                    if (sizeMatch) {
                        loaded = parseFloat(sizeMatch[1]) * 1024 * 1024; // Convert to bytes
                        total = parseFloat(sizeMatch[2]) * 1024 * 1024;
                    }

                    setProgress({
                        progress: Math.round(report.progress * 100),
                        timeElapsed: elapsed,
                        text: report.text,
                        loaded,
                        total,
                    });
                }
            );

            setStatus("loading");

            // Initialize the model
            await engine.reload(selectedModel);

            engineRef.current = engine;
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
            setError(`Failed to initialize AI engine: ${errMsg}`);
            setStatus("error");
            console.error("WebLLM init error:", err);
        }
    }, []);

    // ============================================================
    // Message Sending & Generation
    // ============================================================

    const sendMessage = useCallback(
        async (content: string) => {
            if (!engineRef.current || isGenerating) return;

            const engine = engineRef.current;
            abortRef.current = false;

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
                // Get context window (sliding window + memory)
                const settings = await db.getSettings();
                const contextMessages = await getContextWindow(
                    updatedMessages,
                    settings.maxContextMessages
                );

                // Format for WebLLM
                const llmMessages = contextMessages.map((m) => ({
                    role: m.role as "system" | "user" | "assistant",
                    content: m.content,
                }));

                // Generate completion
                const reply = await engine.chat.completions.create({
                    messages: llmMessages,
                    temperature: 0.7,
                    max_tokens: 1024,
                    stream: false,
                });

                if (abortRef.current) return;

                const assistantContent =
                    reply.choices[0]?.message?.content || "I couldn't generate a response.";

                // Parse for tool calls
                const { toolCalls, cleanText, hasToolCalls } =
                    parseToolCalls(assistantContent);

                if (hasToolCalls) {
                    // Add the assistant's text part first (if any)
                    if (cleanText) {
                        const textMessage: ChatMessage = {
                            id: uuidv4(),
                            role: "assistant",
                            content: cleanText,
                            timestamp: new Date().toISOString(),
                        };
                        setMessages((prev) => [...prev, textMessage]);
                    }

                    // Execute each tool call
                    for (const toolCall of toolCalls) {
                        // Show "executing" state
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

                        // Replace the executing message with the result
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

                        // If it's a search_memory result, feed back to the AI for context
                        if (
                            toolCall.name === "search_memory" &&
                            result.success &&
                            result.data
                        ) {
                            // Inject the search results and get AI to respond with context
                            const searchContextMsg: ChatMessage = {
                                id: uuidv4(),
                                role: "system",
                                content: `[MEMORY SEARCH RESULTS for "${toolCall.args.query}"]\n${result.displayMessage}\n[END SEARCH RESULTS]\nPlease use this information to answer the user's question.`,
                                timestamp: new Date().toISOString(),
                            };

                            const followUpMessages = [
                                ...messagesRef.current,
                                searchContextMsg,
                            ];

                            const followUpContext = await getContextWindow(
                                followUpMessages,
                                settings.maxContextMessages
                            );

                            const followUpLLM = followUpContext.map((m) => ({
                                role: m.role as "system" | "user" | "assistant",
                                content: m.content,
                            }));

                            const followUpReply = await engine.chat.completions.create({
                                messages: followUpLLM,
                                temperature: 0.7,
                                max_tokens: 512,
                                stream: false,
                            });

                            const followUpContent =
                                followUpReply.choices[0]?.message?.content || "";

                            if (followUpContent) {
                                const followUpMessage: ChatMessage = {
                                    id: uuidv4(),
                                    role: "assistant",
                                    content: parseToolCalls(followUpContent).cleanText || followUpContent,
                                    timestamp: new Date().toISOString(),
                                };
                                setMessages((prev) => [...prev, followUpMessage]);
                            }
                        }
                    }
                } else {
                    // Check if it looks like a failed tool call attempt
                    if (looksLikeFailedToolCall(assistantContent)) {
                        // Send retry prompt
                        const retryPrompt = generateRetryPrompt(assistantContent);
                        const retrySystemMsg: ChatMessage = {
                            id: uuidv4(),
                            role: "system",
                            content: retryPrompt,
                            timestamp: new Date().toISOString(),
                        };

                        // Add the broken response (so user can see what happened)
                        const brokenMsg: ChatMessage = {
                            id: uuidv4(),
                            role: "assistant",
                            content: assistantContent,
                            timestamp: new Date().toISOString(),
                        };
                        setMessages((prev) => [...prev, brokenMsg, retrySystemMsg]);

                        // Retry generation
                        const retryMessages = [
                            ...messagesRef.current,
                            brokenMsg,
                            retrySystemMsg,
                        ];
                        const retryContext = await getContextWindow(
                            retryMessages,
                            settings.maxContextMessages
                        );

                        const retryLLM = retryContext.map((m) => ({
                            role: m.role as "system" | "user" | "assistant",
                            content: m.content,
                        }));

                        const retryReply = await engine.chat.completions.create({
                            messages: retryLLM,
                            temperature: 0.5,
                            max_tokens: 1024,
                            stream: false,
                        });

                        const retryContent =
                            retryReply.choices[0]?.message?.content || "";

                        if (retryContent) {
                            // Try parsing again
                            const retryParsed = parseToolCalls(retryContent);
                            if (retryParsed.hasToolCalls) {
                                for (const tc of retryParsed.toolCalls) {
                                    const result = await executeTool(tc);
                                    const resultMsg: ChatMessage = {
                                        id: uuidv4(),
                                        role: "tool",
                                        content: result.displayMessage,
                                        toolName: tc.name,
                                        toolResult: result.data,
                                        timestamp: new Date().toISOString(),
                                    };
                                    setMessages((prev) => [...prev, resultMsg]);
                                }
                                if (retryParsed.cleanText) {
                                    const retryTextMsg: ChatMessage = {
                                        id: uuidv4(),
                                        role: "assistant",
                                        content: retryParsed.cleanText,
                                        timestamp: new Date().toISOString(),
                                    };
                                    setMessages((prev) => [...prev, retryTextMsg]);
                                }
                            } else {
                                const retryTextMsg: ChatMessage = {
                                    id: uuidv4(),
                                    role: "assistant",
                                    content: retryContent,
                                    timestamp: new Date().toISOString(),
                                };
                                setMessages((prev) => [...prev, retryTextMsg]);
                            }
                        }
                    } else {
                        // Normal text response
                        const assistantMessage: ChatMessage = {
                            id: uuidv4(),
                            role: "assistant",
                            content: assistantContent,
                            timestamp: new Date().toISOString(),
                        };
                        setMessages((prev) => [...prev, assistantMessage]);
                    }
                }
            } catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err);
                setError(`Generation error: ${errMsg}`);
                console.error("Generation error:", err);

                const errorMessage: ChatMessage = {
                    id: uuidv4(),
                    role: "assistant",
                    content: `I encountered an error while generating a response. Please try again. (Error: ${errMsg})`,
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
        abortRef.current = true;
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
                // More than just system message
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
        }, 30000); // Save every 30 seconds

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
