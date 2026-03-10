"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
    Send,
    Menu,
    Settings,
    ArrowDown,
    Loader2,
    Square,
    Sparkles,
} from "lucide-react";
import { useWebLLM } from "@/hooks/useWebLLM";
import { MessageBubble } from "./MessageBubble";
import { SettingsModal } from "./SettingsModal";
import { Sidebar, SidebarView } from "./Sidebar";
import { TasksView } from "./TasksView";
import { RemindersView } from "./RemindersView";
import { JournalView } from "./JournalView";
import { ErrorBoundary } from "./ErrorBoundary";
import * as db from "@/lib/db";
import { restoreReminders } from "@/lib/tools";

// Quick action suggestions for empty chat state
const QUICK_ACTIONS = [
    { label: "Create a task", prompt: "Create a task to review my weekly goals by Friday" },
    { label: "Start a habit", prompt: "Create a daily habit to meditate for 10 minutes" },
    { label: "Write in journal", prompt: "I want to journal about my day" },
    { label: "Set a reminder", prompt: "Remind me to call the dentist tomorrow at 10am" },
];

export function ChatInterface() {
    // AI hook
    const {
        status,
        messages,
        isGenerating,
        currentModel,
        sendMessage,
        initEngine,
        clearMessages,
        stopGeneration,
        updateModel,
    } = useWebLLM();

    // UI state
    const [input, setInput] = useState("");
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [currentView, setCurrentView] = useState<SidebarView>("chat");
    const [showScrollBtn, setShowScrollBtn] = useState(false);

    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const initRef = useRef(false);

    // ============================================================
    // Initialization
    // ============================================================

    useEffect(() => {
        if (initRef.current) return;
        initRef.current = true;

        (async () => {
            // Check for API key; open settings if missing
            const settings = await db.getSettings();
            if (!settings.openRouterApiKey) {
                setSettingsOpen(true);
            }

            // Initialize the AI engine
            await initEngine();

            // Restore any pending reminders from DB
            restoreReminders();
        })();
    }, [initEngine]);

    // ============================================================
    // Auto-scroll
    // ============================================================

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    // Scroll when new messages arrive or while generating
    useEffect(() => {
        scrollToBottom();
    }, [messages, isGenerating, scrollToBottom]);

    // Show/hide scroll-to-bottom button
    useEffect(() => {
        const container = messagesContainerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = container;
            setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 100);
        };

        container.addEventListener("scroll", handleScroll);
        return () => container.removeEventListener("scroll", handleScroll);
    }, []);

    // ============================================================
    // Input handling
    // ============================================================

    const handleSend = useCallback(async () => {
        const trimmed = input.trim();
        if (!trimmed || isGenerating) return;

        setInput("");

        // Reset textarea height
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
        }

        await sendMessage(trimmed);
    }, [input, isGenerating, sendMessage]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        },
        [handleSend]
    );

    // Auto-resize textarea
    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
        const textarea = e.target;
        textarea.style.height = "auto";
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
    }, []);

    // ============================================================
    // Navigation
    // ============================================================

    const handleNavigate = useCallback((view: SidebarView) => {
        setCurrentView(view);
    }, []);

    const handleModelChange = useCallback(
        (model: string) => {
            updateModel(model);
        },
        [updateModel]
    );

    // ============================================================
    // Render view content
    // ============================================================

    if (currentView === "tasks") {
        return (
            <ErrorBoundary>
                <TasksView onBack={() => setCurrentView("chat")} />
            </ErrorBoundary>
        );
    }

    if (currentView === "habits") {
        // HabitsView already exists in the original codebase
        // We import it dynamically to avoid issues if it's not yet updated
        return (
            <ErrorBoundary>
                <DynamicHabitsView onBack={() => setCurrentView("chat")} />
            </ErrorBoundary>
        );
    }

    if (currentView === "reminders") {
        return (
            <ErrorBoundary>
                <RemindersView onBack={() => setCurrentView("chat")} />
            </ErrorBoundary>
        );
    }

    if (currentView === "journal") {
        return (
            <ErrorBoundary>
                <JournalView onBack={() => setCurrentView("chat")} />
            </ErrorBoundary>
        );
    }

    // ============================================================
    // Chat view (default)
    // ============================================================

    const isEmpty = messages.filter((m) => m.role !== "system").length === 0;

    return (
        <ErrorBoundary>
            <div className="flex flex-col h-screen bg-gray-950 text-white">
                {/* Header */}
                <header className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
                        >
                            <Menu size={20} className="text-gray-400" />
                        </button>
                        <div>
                            <h1 className="text-base font-semibold">LocalMind</h1>
                            <p className="text-xs text-gray-500">
                                {status === "ready" ? "Online" : status === "loading" ? "Initializing..." : ""}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setSettingsOpen(true)}
                        className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
                    >
                        <Settings size={20} className="text-gray-400" />
                    </button>
                </header>

                {/* Messages area */}
                <div
                    ref={messagesContainerRef}
                    className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
                >
                    {isEmpty ? (
                        // Empty state with quick actions
                        <div className="flex flex-col items-center justify-center h-full space-y-6">
                            <div className="text-center space-y-2">
                                <div className="w-16 h-16 rounded-2xl bg-purple-600/20 flex items-center justify-center mx-auto mb-4">
                                    <Sparkles size={28} className="text-purple-400" />
                                </div>
                                <h2 className="text-xl font-semibold">Welcome to LocalMind</h2>
                                <p className="text-gray-500 text-sm max-w-sm">
                                    Your AI life assistant. Manage tasks, track habits, journal, and set reminders.
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-2 max-w-sm w-full">
                                {QUICK_ACTIONS.map((action) => (
                                    <button
                                        key={action.label}
                                        onClick={() => {
                                            setInput(action.prompt);
                                            textareaRef.current?.focus();
                                        }}
                                        className="p-3 rounded-xl bg-gray-800/50 hover:bg-gray-800 border border-gray-800 text-left text-sm text-gray-300 transition-colors"
                                    >
                                        {action.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        // Message list
                        <>
                            {messages
                                .filter((m) => m.role !== "system")
                                .map((msg, idx, arr) => (
                                    <MessageBubble
                                        key={msg.id}
                                        message={msg}
                                        isGenerating={
                                            isGenerating &&
                                            msg.role === "assistant" &&
                                            idx === arr.length - 1
                                        }
                                    />
                                ))}
                            {isGenerating &&
                                messages[messages.length - 1]?.role !== "assistant" && (
                                    <div className="flex items-center gap-2 text-gray-500 text-sm">
                                        <Loader2 size={16} className="animate-spin" />
                                        Thinking...
                                    </div>
                                )}
                        </>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Scroll to bottom button */}
                {showScrollBtn && (
                    <button
                        onClick={scrollToBottom}
                        className="absolute bottom-24 right-4 p-2 bg-gray-800 hover:bg-gray-700 rounded-full shadow-lg transition-colors"
                    >
                        <ArrowDown size={18} className="text-gray-300" />
                    </button>
                )}

                {/* Input area */}
                <div className="border-t border-gray-800 px-4 py-3 bg-gray-950">
                    <div className="flex items-end gap-2 max-w-3xl mx-auto">
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            placeholder="Message LocalMind..."
                            rows={1}
                            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                        />
                        {isGenerating ? (
                            <button
                                onClick={stopGeneration}
                                className="p-3 bg-red-600 hover:bg-red-700 rounded-xl transition-colors"
                            >
                                <Square size={18} />
                            </button>
                        ) : (
                            <button
                                onClick={handleSend}
                                disabled={!input.trim()}
                                className="p-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors"
                            >
                                <Send size={18} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Sidebar */}
                <Sidebar
                    isOpen={sidebarOpen}
                    currentView={currentView}
                    onNavigate={handleNavigate}
                    onClose={() => setSidebarOpen(false)}
                />

                {/* Settings modal */}
                <SettingsModal
                    isOpen={settingsOpen}
                    onClose={() => setSettingsOpen(false)}
                    currentModel={currentModel}
                    onModelChange={handleModelChange}
                />
            </div>
        </ErrorBoundary>
    );
}

// ================================================================
// Dynamic HabitsView loader
// Falls back gracefully if the original HabitsView has issues
// ================================================================

function DynamicHabitsView({ onBack }: { onBack: () => void }) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    try {
        // HabitsView is a large existing component -- import it directly
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { HabitsView } = require("./HabitsView");
        return <HabitsView onBack={onBack} />;
    } catch {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gray-950 text-white">
                <p className="text-gray-400">Habits view loading...</p>
                <button
                    onClick={onBack}
                    className="mt-4 px-4 py-2 bg-gray-800 rounded-lg text-sm"
                >
                    Back to Chat
                </button>
            </div>
        );
    }
}
