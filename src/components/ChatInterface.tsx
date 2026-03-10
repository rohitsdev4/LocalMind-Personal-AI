"use client";

// ============================================================
// LocalMind — Main Chat Interface
// Full-screen chat with input area, message list, and controls
// ============================================================

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
    Send,
    Settings,
    Brain,
    Sparkles,
    Plus,
    Mic,
    Paperclip,
    ArrowDown,
    Zap,
    Menu,
} from "lucide-react";
import { MessageBubble, ThinkingIndicator } from "./MessageBubble";
import { DownloadProgress } from "./DownloadProgress";
import { SettingsModal } from "./SettingsModal";
import { InstallPrompt } from "./InstallPrompt";
import { useWebLLM } from "@/hooks/useWebLLM";
import { useReminders } from "@/hooks/useReminders";
import db from "@/lib/db";
import { Sidebar } from "./Sidebar";
import { CheckCircle, Clock, Bell } from "lucide-react";

// ============================================================
// Quick action suggestions for empty state
// ============================================================

const SUGGESTIONS = [
    {
        icon: "📝",
        label: "Create a task",
        prompt: "Create a task to buy groceries tomorrow",
    },
    {
        icon: "🔥",
        label: "Log a habit",
        prompt: "I just completed my morning workout",
    },
    {
        icon: "📖",
        label: "Write journal",
        prompt: "I want to journal about my day. I felt productive and grateful.",
    },
    {
        icon: "🔍",
        label: "Search memory",
        prompt: "What tasks did I create recently?",
    },
];

interface ChatInterfaceProps {
    onOpenSidebar?: () => void;
}

export function ChatInterface({ onOpenSidebar }: ChatInterfaceProps) {
    const {
        status,
        messages,
        isGenerating,
        error,
        initEngine,
        sendMessage,
        clearMessages,
        stopGeneration,
    } = useWebLLM();

    const [input, setInput] = useState("");
    const [showSettings, setShowSettings] = useState(false);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [currentModel, setCurrentModel] = useState("SmolLM2-360M-Instruct-q4f16_1-MLC");
    const [showSidebar, setShowSidebar] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Visible messages (exclude system messages)
    const visibleMessages = messages.filter((m) => m.role !== "system");

    // Reminders Hook for active toast
    const { activeToast, dismissReminder, snoozeReminder, dismissToast } = useReminders();

    // ============================================================
    // Check API Key on Load
    // ============================================================
    useEffect(() => {
        const checkApiKey = async () => {
            const settings = await db.getSettings();
            if (!settings.openRouterApiKey) {
                setShowSettings(true);
            }
        };
        checkApiKey();
    }, []);

    // ============================================================
    // Auto-scroll to bottom on new messages
    // ============================================================

    const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
        messagesEndRef.current?.scrollIntoView({ behavior });
    }, []);

    useEffect(() => {
        if (!showScrollButton) {
            scrollToBottom();
        }
    }, [messages, isGenerating, scrollToBottom, showScrollButton]);

    // Detect if user has scrolled up
    const handleScroll = useCallback(() => {
        const container = messagesContainerRef.current;
        if (!container) return;
        const { scrollTop, scrollHeight, clientHeight } = container;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
        setShowScrollButton(!isNearBottom);
    }, []);

    // ============================================================
    // Input Handling
    // ============================================================

    const handleSend = useCallback(async () => {
        const trimmed = input.trim();
        if (!trimmed || isGenerating) return;
        setInput("");
        // Reset textarea height
        if (inputRef.current) {
            inputRef.current.style.height = "auto";
        }
        await sendMessage(trimmed);
    }, [input, isGenerating, sendMessage]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        },
        [handleSend]
    );

    // Auto-resize textarea
    const handleInputChange = useCallback(
        (e: React.ChangeEvent<HTMLTextAreaElement>) => {
            setInput(e.target.value);
            const el = e.target;
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
        },
        []
    );

    const handleSuggestionClick = useCallback(
        async (prompt: string) => {
            setInput("");
            await sendMessage(prompt);
        },
        [sendMessage]
    );

    const handleModelChange = useCallback(
        (modelId: string) => {
            setCurrentModel(modelId);
            // Note: Model change requires engine restart
            clearMessages();
        },
        [clearMessages]
    );


    // ============================================================
    // Main Render
    // ============================================================

    return (
        <div className="fixed inset-0 flex flex-col bg-surface">
            {/* Download Progress Overlay */}
            {(status === "downloading" || status === "loading" || status === "error") && (
                <DownloadProgress
                    progress={{ progress: 100, loaded: 100, total: 100, text: "Ready", timeElapsed: 0 }}
                    status={status}
                    error={error}
                    onRetry={() => initEngine(currentModel)}
                />
            )}

            {/* ============================== */}
            {/* Header */}
            {/* ============================== */}
            <header className="relative flex-shrink-0 flex items-center justify-between px-4 py-3 bg-surface-100/50 border-b border-white/5 backdrop-blur-xl z-20">
                {/* Subtle gradient background */}
                <div className="absolute inset-0 bg-gradient-to-r from-brand-500/5 via-transparent to-accent-purple/5" />

                <div className="relative flex items-center gap-3">
                    <button
                        onClick={onOpenSidebar || (() => setShowSidebar(true))}
                        className="p-2 -ml-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-accent-purple flex items-center justify-center shadow-lg shadow-brand-500/20">
                        <Brain className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-base font-bold text-white tracking-tight leading-none">
                            LocalMind
                        </h1>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span
                                className={`block w-1.5 h-1.5 rounded-full ${status === "ready"
                                    ? "bg-accent-emerald animate-pulse-soft"
                                    : status === "generating"
                                        ? "bg-accent-amber animate-pulse"
                                        : "bg-white/20"
                                    }`}
                            />
                            <span className="text-[11px] text-white/40">
                                {status === "ready"
                                    ? "Ready"
                                    : status === "generating"
                                        ? "Generating..."
                                        : status === "idle"
                                            ? "Tap to start"
                                            : "Loading..."}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="relative flex items-center gap-1">
                    <button
                        onClick={clearMessages}
                        className="p-2.5 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-all"
                        title="New Chat"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => setShowSettings(true)}
                        className="p-2.5 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-all"
                        title="Settings"
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                </div>
            </header>

            {/* ============================== */}
            {/* Messages Area */}
            {/* ============================== */}
            <div
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto px-4 py-4 scroll-smooth"
                style={{
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                }}
            >
                {/* Empty State */}
                {visibleMessages.length === 0 && status === "ready" && (
                    <div className="flex flex-col items-center justify-center h-full animate-fade-in">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500/20 to-accent-purple/20 flex items-center justify-center mb-4">
                            <Sparkles className="w-8 h-8 text-brand-400" />
                        </div>
                        <h2 className="text-lg font-semibold text-white mb-1">
                            Hi! I&apos;m LocalMind
                        </h2>
                        <p className="text-sm text-white/40 text-center max-w-[260px] mb-8">
                            Your AI assistant. I can help you manage tasks, track
                            habits, and journal. Powered by OpenRouter.
                        </p>

                        {/* Suggestion Chips */}
                        <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
                            {SUGGESTIONS.map((s, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleSuggestionClick(s.prompt)}
                                    className="flex items-center gap-2 px-3.5 py-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] hover:border-white/10 transition-all text-left"
                                >
                                    <span className="text-lg">{s.icon}</span>
                                    <span className="text-xs text-white/60 font-medium">
                                        {s.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Init Prompt */}
                {status === "idle" && (
                    <div className="flex flex-col items-center justify-center h-full animate-fade-in">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-500 to-accent-purple flex items-center justify-center mb-6 shadow-2xl shadow-brand-500/30 animate-glow">
                            <Brain className="w-10 h-10 text-white" />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">
                            Welcome to LocalMind
                        </h2>
                        <p className="text-sm text-white/40 text-center max-w-[280px] mb-6">
                            Powered by OpenRouter. Enter your free API key in settings to start.
                        </p>
                        <button
                            onClick={() => setShowSettings(true)}
                            className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-brand-500 to-accent-purple text-white font-semibold text-sm shadow-xl shadow-brand-500/30 hover:shadow-brand-500/40 transition-all active:scale-95 flex items-center gap-2 mb-4"
                        >
                            <Settings className="w-4 h-4" />
                            Open Settings
                        </button>
                        <button
                            onClick={() => initEngine(currentModel)}
                            className="px-8 py-3.5 rounded-2xl bg-surface-200 text-white font-semibold text-sm shadow-xl hover:bg-surface-300 transition-all active:scale-95 flex items-center gap-2"
                        >
                            <Zap className="w-4 h-4" />
                            Start (If Key Added)
                        </button>
                    </div>
                )}

                {/* Message List */}
                {visibleMessages.map((msg, i) => (
                    <MessageBubble
                        key={msg.id}
                        message={msg}
                        isLatest={i === visibleMessages.length - 1}
                    />
                ))}

                {/* Thinking Indicator */}
                {isGenerating && <ThinkingIndicator />}

                <div ref={messagesEndRef} />
            </div>

            {/* Scroll to Bottom FAB */}
            {showScrollButton && (
                <button
                    onClick={() => scrollToBottom()}
                    className="absolute bottom-24 right-4 z-30 p-2.5 rounded-full bg-surface-200 border border-white/10 shadow-xl text-white/60 hover:text-white transition-all animate-fade-in"
                >
                    <ArrowDown className="w-4 h-4" />
                </button>
            )}

            {/* ============================== */}
            {/* Input Area */}
            {/* ============================== */}
            {status === "ready" && (
                <div className="flex-shrink-0 px-4 pb-4 pt-2 bg-gradient-to-t from-surface via-surface to-transparent">
                    <div className="flex items-end gap-2 p-2 rounded-2xl bg-surface-100/80 border border-white/5 backdrop-blur-xl shadow-2xl shadow-black/30">
                        {/* Attachment button (decorative for now) */}
                        <button className="p-2 rounded-xl text-white/20 hover:text-white/40 transition-all flex-shrink-0 hidden">
                            <Paperclip className="w-5 h-5" />
                        </button>

                        {/* Text Input */}
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask me anything..."
                            rows={1}
                            className="flex-1 bg-transparent text-sm text-white placeholder-white/25 resize-none outline-none py-2 px-2 max-h-[120px] leading-relaxed"
                            style={{ scrollbarWidth: "none" }}
                            disabled={isGenerating}
                        />

                        {/* Voice button (decorative for now) */}
                        <button className="p-2 rounded-xl text-white/20 hover:text-white/40 transition-all flex-shrink-0 hidden">
                            <Mic className="w-5 h-5" />
                        </button>

                        {/* Send / Stop Button */}
                        {isGenerating ? (
                            <button
                                onClick={stopGeneration}
                                className="p-2.5 rounded-xl bg-accent-rose/20 text-accent-rose hover:bg-accent-rose/30 transition-all flex-shrink-0"
                                title="Stop generating"
                            >
                                <div className="w-4 h-4 rounded-sm bg-accent-rose" />
                            </button>
                        ) : (
                            <button
                                onClick={handleSend}
                                disabled={!input.trim()}
                                className={`p-2.5 rounded-xl transition-all flex-shrink-0 ${input.trim()
                                    ? "bg-brand-500 text-white shadow-lg shadow-brand-500/30 hover:bg-brand-600 active:scale-95"
                                    : "bg-white/5 text-white/15"
                                    }`}
                                title="Send message"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Bottom safety label */}
                    <p className="text-center text-[10px] text-white/15 mt-2">
                        Powered by OpenRouter API
                    </p>
                </div>
            )}

            {/* Settings Modal */}
            <SettingsModal
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
                onModelChange={handleModelChange}
                currentModel={currentModel}
            />

            {/* In-App Reminder Toast */}
            {activeToast && (
                <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-slide-down">
                    <div className="bg-surface-200 border border-brand-500/50 rounded-2xl p-4 shadow-2xl shadow-brand-500/20 backdrop-blur-xl flex flex-col gap-3 min-w-[300px]">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center">
                                    <Bell className="w-4 h-4 text-brand-400" />
                                </div>
                                <div>
                                    <p className="text-xs text-brand-400 font-semibold uppercase tracking-wider">Reminder</p>
                                    <h3 className="text-white font-medium text-base">{activeToast.message}</h3>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <button
                                onClick={() => dismissReminder(activeToast.id)}
                                className="flex-1 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-1"
                            >
                                <CheckCircle className="w-4 h-4" /> Done
                            </button>
                            <button
                                onClick={() => snoozeReminder(activeToast.id, 60)}
                                className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-1"
                            >
                                <Clock className="w-4 h-4" /> Snooze 1h
                            </button>
                            <button
                                onClick={dismissToast}
                                className="px-3 py-2 bg-transparent hover:bg-white/5 text-white/50 hover:text-white rounded-xl text-sm font-medium transition-colors"
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* PWA Install Prompt */}
            <InstallPrompt />

            <Sidebar
                isOpen={showSidebar}
                onClose={() => setShowSidebar(false)}
                currentView="chat"
                onViewChange={() => {}}
            />

            {/* Hide scrollbar globally */}
            <style jsx global>{`
        *::-webkit-scrollbar {
          display: none;
        }
      `}</style>
        </div>
    );
}

export default ChatInterface;
