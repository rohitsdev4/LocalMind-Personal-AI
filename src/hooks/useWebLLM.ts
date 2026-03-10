// ============================================================
// LocalMind — WebLLM Hook (STREAMING + OPTIMIZED)
// Key optimizations:
//   1. Streaming generation — tokens appear instantly
//   2. Reduced max_tokens (512 vs 1024) for faster responses
//   3. Greedy sampling (temp=0.6) for faster decoding
//   4. Smaller context window (8 messages) to reduce prefill
//   5. Abort support via AbortController
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
import {
    parseToolCalls,
    generateRetryPrompt,
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
    // Engine state
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const engineRef = useRef<any>(null);
    const [status, setStatus] = useState<EngineStatus>("idle");
    const [error, setError] = useState<string | null>(null);
    const [webGPUSupported, setWebGPUSupported] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const abortRef = useRef(false);
    const fetchAbortControllerRef = useRef<AbortController | null>(null);

    // ============================================================
    // Helper: Stream OpenRouter
    // ============================================================
    const streamOpenRouter = async (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messagesToComplete: any[],
        apiKey: string,
        modelId: string,
        temperature: number,
        maxTokens: number,
        onChunk: (content: string) => void
    ) => {
        const controller = new AbortController();
        fetchAbortControllerRef.current = controller;

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": window.location.origin,
                "X-Title": "LocalMind",
            },
            body: JSON.stringify({
                model: modelId,
                messages: messagesToComplete,
                temperature,
                max_tokens: maxTokens,
                top_p: 0.9,
                stream: true,
            }),
            signal: controller.signal,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`OpenRouter API error: ${errorData.error?.message || response.statusText}`);
        }

        if (!response.body) {
            throw new Error("ReadableStream not yet supported in this browser.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullContent = "";

        try {
            while (true) {
                if (abortRef.current) break;
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;
                        try {
                            const parsed = JSON.parse(data);
                            const delta = parsed.choices[0]?.delta?.content || "";
                            if (delta) {
                                fullContent += delta;
                                onChunk(fullContent);
                            }
                        } catch (e) {
                            console.warn("Error parsing OpenRouter stream chunk", e);
                        }
                    }
                }
            }
        } finally {
            fetchAbortControllerRef.current = null;
        }

        return fullContent;
    };

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

            if (selectedModel === "openrouter") {
                engineRef.current = "openrouter";
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
                return;
            }

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
                        loaded = parseFloat(sizeMatch[1]) * 1024 * 1024;
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
    // STREAMING Message Generation (KEY OPTIMIZATION)
    // Tokens appear word-by-word as they are generated
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
                // Get context window — use smaller window (8 msgs) for speed
                const settings = await db.getSettings();
                const contextMessages = await getContextWindow(
                    updatedMessages,
                    Math.min(settings.maxContextMessages, 8) // Cap at 8 for speed
                );

                // Format for WebLLM — only use system/user/assistant roles
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
                // Create a placeholder assistant message that we'll update in real-time
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

                if (settings.selectedModel === "openrouter") {
                    const apiKey = settings.openRouterApiKey;
                    if (!apiKey) {
                        throw new Error("OpenRouter API key is missing. Please configure it in settings.");
                    }
                    const openRouterModelId = settings.openRouterModel || "google/gemini-2.5-flash";

                    fullContent = await streamOpenRouter(
                        llmMessages,
                        apiKey,
                        openRouterModelId,
                        0.6,
                        512,
                        (content) => {
                            setMessages((prev) =>
                                prev.map((m) =>
                                    m.id === assistantMsgId
                                        ? { ...m, content }
                                        : m
                                )
                            );
                        }
                    );

                    if (abortRef.current) return;
                } else {
                    // Use streaming API — tokens appear as they are generated
                    const stream = await engine.chat.completions.create({
                        messages: llmMessages,
                        temperature: 0.6, // Lower temp = faster sampling
                        max_tokens: 512, // Shorter responses = faster
                        top_p: 0.9,
                        stream: true, // <--- STREAMING ENABLED
                    });

                    // Process the stream chunk by chunk
                    for await (const chunk of stream) {
                        if (abortRef.current) break;

                        const delta = chunk.choices[0]?.delta?.content || "";
                        if (delta) {
                            fullContent += delta;

                            // Update the message in-place (real-time token display)
                            setMessages((prev) =>
                                prev.map((m) =>
                                    m.id === assistantMsgId
                                        ? { ...m, content: fullContent }
                                        : m
                                )
                            );
                        }
                    }

                    if (abortRef.current) {
                        // If aborted, keep whatever was generated so far
                        return;
                    }
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
                        // Show executing state
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
                                engine,
                                llmMessages,
                                toolCall,
                                result
                            );
                        }
                    }
                } else if (looksLikeFailedToolCall(fullContent)) {
                    // Retry with streaming
                    const retryPrompt = generateRetryPrompt(fullContent);
                    const retryMsg = {
                        role: "system" as const,
                        content: retryPrompt,
                    };

                    const retryMsgId = uuidv4();
                    setMessages((prev) => [
                        ...prev,
                        {
                            id: retryMsgId,
                            role: "assistant",
                            content: "",
                            timestamp: new Date().toISOString(),
                        },
                    ]);

                    let retryContent = "";
                    if (settings.selectedModel === "openrouter") {
                        const apiKey = settings.openRouterApiKey;
                        if (apiKey) {
                            const openRouterModelId = settings.openRouterModel || "google/gemini-2.5-flash";
                            retryContent = await streamOpenRouter(
                                [...llmMessages, retryMsg],
                                apiKey,
                                openRouterModelId,
                                0.4,
                                512,
                                (content) => {
                                    setMessages((prev) =>
                                        prev.map((m) =>
                                            m.id === retryMsgId
                                                ? { ...m, content }
                                                : m
                                        )
                                    );
                                }
                            );
                        }
                    } else {
                        const retryStream = await engine.chat.completions.create({
                            messages: [...llmMessages, retryMsg],
                            temperature: 0.4,
                            max_tokens: 512,
                            stream: true,
                        });

                        for await (const chunk of retryStream) {
                            if (abortRef.current) break;
                            const delta = chunk.choices[0]?.delta?.content || "";
                            if (delta) {
                                retryContent += delta;
                                setMessages((prev) =>
                                    prev.map((m) =>
                                        m.id === retryMsgId
                                            ? { ...m, content: retryContent }
                                            : m
                                    )
                                );
                            }
                        }
                    }

                    // Check if retry contains tool calls
                    const retryParsed = parseToolCalls(retryContent);
                    if (retryParsed.hasToolCalls) {
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === retryMsgId
                                    ? { ...m, content: retryParsed.cleanText || "" }
                                    : m
                            )
                        );
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
                    }
                }
                // If no tool calls, the streamed text is already displayed ✅
            } catch (err) {
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [isGenerating]
    );

    // ============================================================
    // Streaming follow-up for search_memory results
    // ============================================================
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async function streamFollowUp(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        engine: any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        baseMsgs: any[],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        toolCall: any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        result: any
    ) {
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

        const settings = await db.getSettings();

        if (settings.selectedModel === "openrouter") {
            const apiKey = settings.openRouterApiKey;
            if (apiKey) {
                const openRouterModelId = settings.openRouterModel || "google/gemini-2.5-flash";
                followUpContent = await streamOpenRouter(
                    [...baseMsgs, contextInjection],
                    apiKey,
                    openRouterModelId,
                    0.6,
                    256,
                    (content) => {
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === followUpId
                                    ? { ...m, content }
                                    : m
                            )
                        );
                    }
                );
            }
        } else {
            const followUpStream = await engine.chat.completions.create({
                messages: [...baseMsgs, contextInjection],
                temperature: 0.6,
                max_tokens: 256, // Short follow-up
                stream: true,
            });

            for await (const chunk of followUpStream) {
                if (abortRef.current) break;
                const delta = chunk.choices[0]?.delta?.content || "";
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
            }
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
        abortRef.current = true;
        if (fetchAbortControllerRef.current) {
            fetchAbortControllerRef.current.abort();
            fetchAbortControllerRef.current = null;
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
