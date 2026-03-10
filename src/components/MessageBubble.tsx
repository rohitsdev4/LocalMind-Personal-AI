"use client";

// ============================================================
// LocalMind — Message Bubble Component
// Renders different message types: user, assistant, tool, system
// ============================================================

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "@/lib/types";
import {
    Bot,
    User,
    Wrench,
    CheckCircle2,
    XCircle,
    Sparkles,
    ListTodo,
    BookHeart,
    Search,
    Bell,
    Calendar,
    Flame,
} from "lucide-react";

interface MessageBubbleProps {
    message: ChatMessage;
    isLatest?: boolean;
}

const TOOL_ICONS: Record<string, React.ReactNode> = {
    create_task: <ListTodo className="w-3.5 h-3.5" />,
    log_habit: <Flame className="w-3.5 h-3.5" />,
    write_journal: <BookHeart className="w-3.5 h-3.5" />,
    search_memory: <Search className="w-3.5 h-3.5" />,
    set_reminder: <Bell className="w-3.5 h-3.5" />,
    get_current_date: <Calendar className="w-3.5 h-3.5" />,
};

export function MessageBubble({ message, isLatest }: MessageBubbleProps) {
    // Skip system messages (they shouldn't be visible)
    if (message.role === "system") return null;

    const isUser = message.role === "user";
    const isTool = message.role === "tool";
    const isAssistant = message.role === "assistant";

    // ==============================
    // Tool Result Message
    // ==============================
    if (isTool) {
        const isSuccess = message.content.includes("✅") || message.content.includes("🔥") || message.content.includes("📝") || message.content.includes("⏰") || message.content.includes("📅") || message.content.includes("🔍");
        const isExecuting = message.content.includes("⚙️");
        const toolIcon = message.toolName ? TOOL_ICONS[message.toolName] : <Wrench className="w-3.5 h-3.5" />;

        return (
            <div className={`flex justify-center my-2 animate-fade-in ${isLatest ? "animate-slide-up" : ""}`}>
                <div
                    className={`inline-flex items-start gap-2 px-4 py-2.5 rounded-xl text-xs font-medium max-w-[85%] border ${isExecuting
                            ? "bg-accent-amber/10 border-accent-amber/20 text-accent-amber"
                            : isSuccess
                                ? "bg-accent-emerald/10 border-accent-emerald/20 text-accent-emerald"
                                : "bg-accent-rose/10 border-accent-rose/20 text-accent-rose"
                        }`}
                >
                    <span className="mt-0.5 flex-shrink-0">
                        {isExecuting ? (
                            <div className="animate-spin">
                                <Wrench className="w-3.5 h-3.5" />
                            </div>
                        ) : isSuccess ? (
                            toolIcon || <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                            <XCircle className="w-3.5 h-3.5" />
                        )}
                    </span>
                    <span className="whitespace-pre-wrap leading-relaxed">{message.content}</span>
                </div>
            </div>
        );
    }

    // ==============================
    // User Message
    // ==============================
    if (isUser) {
        return (
            <div className={`flex justify-end mb-3 animate-fade-in ${isLatest ? "animate-slide-up" : ""}`}>
                <div className="flex items-end gap-2 max-w-[85%]">
                    <div className="bg-gradient-to-br from-brand-500 to-brand-600 text-white rounded-2xl rounded-br-md px-4 py-3 shadow-lg shadow-brand-500/10">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                            {message.content}
                        </p>
                        <span className="block text-[10px] text-white/40 mt-1.5 text-right">
                            {formatTime(message.timestamp)}
                        </span>
                    </div>
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-brand-500/20 flex items-center justify-center">
                        <User className="w-3.5 h-3.5 text-brand-400" />
                    </div>
                </div>
            </div>
        );
    }

    // ==============================
    // Assistant Message
    // ==============================
    if (isAssistant) {
        return (
            <div className={`flex justify-start mb-3 animate-fade-in ${isLatest ? "animate-slide-up" : ""}`}>
                <div className="flex items-end gap-2 max-w-[85%] w-full">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-accent-purple/30 to-accent-pink/30 flex items-center justify-center">
                        <Sparkles className="w-3.5 h-3.5 text-accent-purple" />
                    </div>
                    <div className="bg-surface-100/80 border border-white/5 text-white rounded-2xl rounded-bl-md px-4 py-3 backdrop-blur-sm w-full overflow-hidden">
                        <div className="text-sm leading-relaxed break-words">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                    strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                                    ul: ({ children }) => <ul className="list-disc list-inside mb-2">{children}</ul>,
                                    ol: ({ children }) => <ol className="list-decimal list-inside mb-2">{children}</ol>,
                                    li: ({ children }) => <li className="mb-1">{children}</li>,
                                    a: ({ children, href }) => (
                                        <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:underline">
                                            {children}
                                        </a>
                                    ),
                                    code: (props) => {
                                        // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
                                        const { inline, className, children, node, ref, ...rest } = props as any;
                                        return !inline ? (
                                            <pre className="bg-black/50 p-3 rounded-lg overflow-x-auto text-xs my-2 border border-white/10">
                                                <code className={className} {...rest}>
                                                    {children}
                                                </code>
                                            </pre>
                                        ) : (
                                            <code className="bg-black/30 px-1 py-0.5 rounded text-xs text-accent-pink" {...rest}>
                                                {children}
                                            </code>
                                        );
                                    },
                                    pre: ({ children }) => <>{children}</>,
                                }}
                            >
                                {message.content}
                            </ReactMarkdown>
                        </div>
                        <span className="block text-[10px] text-white/25 mt-1.5">
                            {formatTime(message.timestamp)}
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    return null;
}

// ============================================================
// Thinking Indicator (shown while AI generates)
// ============================================================

export function ThinkingIndicator() {
    return (
        <div className="flex justify-start mb-3 animate-fade-in">
            <div className="flex items-end gap-2 max-w-[85%]">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-accent-purple/30 to-accent-pink/30 flex items-center justify-center">
                    <Bot className="w-3.5 h-3.5 text-accent-purple animate-pulse-soft" />
                </div>
                <div className="bg-surface-100/80 border border-white/5 rounded-2xl rounded-bl-md px-4 py-3 backdrop-blur-sm">
                    <div className="flex items-center gap-1.5">
                        <div className="flex gap-1">
                            <span
                                className="block w-1.5 h-1.5 rounded-full bg-accent-purple animate-typing"
                                style={{ animationDelay: "0ms" }}
                            />
                            <span
                                className="block w-1.5 h-1.5 rounded-full bg-accent-purple animate-typing"
                                style={{ animationDelay: "200ms" }}
                            />
                            <span
                                className="block w-1.5 h-1.5 rounded-full bg-accent-purple animate-typing"
                                style={{ animationDelay: "400ms" }}
                            />
                        </div>
                        <span className="text-xs text-white/30 ml-1">Thinking...</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ============================================================
// Helpers
// ============================================================

function formatTime(timestamp: string): string {
    try {
        return new Date(timestamp).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });
    } catch {
        return "";
    }
}


export default MessageBubble;
