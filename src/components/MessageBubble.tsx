"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
    User,
    Bot,
    CheckCircle,
    XCircle,
    ListTodo,
    Flame,
    BookHeart,
    Search,
    Bell,
    Calendar,
    Loader2,
    Trash2,
    Edit,
} from "lucide-react";
import { ChatMessage } from "@/lib/types";

interface MessageBubbleProps {
    message: ChatMessage;
    isGenerating?: boolean;
}

const TOOL_ICONS: Record<string, typeof ListTodo> = {
    create_task: ListTodo,
    get_tasks: ListTodo,
    complete_task: CheckCircle,
    update_task: Edit,
    delete_task: Trash2,
    create_habit: Flame,
    log_habit: Flame,
    get_habits: Flame,
    delete_habit: Trash2,
    write_journal: BookHeart,
    get_journal_entries: BookHeart,
    search_memory: Search,
    set_reminder: Bell,
    get_reminders: Bell,
    cancel_reminder: Trash2,
    get_current_date: Calendar,
};

function ToolResultBubble({ message }: { message: ChatMessage }) {
    const result = message.toolResult as { success?: boolean; message?: string } | undefined;
    const isSuccess = result?.success !== false;
    const Icon = message.toolName ? TOOL_ICONS[message.toolName] || Bot : Bot;

    return (
        <div
            className={`flex items-start gap-2 px-3 py-2 rounded-lg text-sm ${
                isSuccess
                    ? "bg-green-500/10 border border-green-500/20 text-green-300"
                    : "bg-red-500/10 border border-red-500/20 text-red-300"
            }`}
        >
            <div className="flex-shrink-0 mt-0.5">
                {isSuccess ? (
                    <CheckCircle size={16} className="text-green-400" />
                ) : (
                    <XCircle size={16} className="text-red-400" />
                )}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                    <Icon size={14} className="opacity-60" />
                    <span className="font-medium text-xs opacity-70">
                        {message.toolName || "tool"}
                    </span>
                </div>
                <p className="break-words">{result?.message || message.content}</p>
            </div>
        </div>
    );
}

function MessageBubbleInner({ message, isGenerating }: MessageBubbleProps) {
    // Tool result messages
    if (message.role === "tool") {
        return <ToolResultBubble message={message} />;
    }

    // System messages (summaries, etc.)
    if (message.role === "system") {
        return null; // Don't render system messages
    }

    const isUser = message.role === "user";

    return (
        <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
            {/* Avatar */}
            {!isUser && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600/20 flex items-center justify-center">
                    <Bot size={16} className="text-purple-400" />
                </div>
            )}

            {/* Message content */}
            <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                    isUser
                        ? "bg-purple-600 text-white"
                        : "bg-gray-800 text-gray-100"
                }`}
            >
                {isUser ? (
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                ) : (
                    <div className="prose prose-invert prose-sm max-w-none break-words">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                code({ className, children, ...props }) {
                                    const isInline = !className;
                                    if (isInline) {
                                        return (
                                            <code
                                                className="bg-gray-700 px-1.5 py-0.5 rounded text-sm"
                                                {...props}
                                            >
                                                {children}
                                            </code>
                                        );
                                    }
                                    return (
                                        <pre className="bg-gray-900 rounded-lg p-3 overflow-x-auto">
                                            <code className={className} {...props}>
                                                {children}
                                            </code>
                                        </pre>
                                    );
                                },
                                p({ children }) {
                                    return <p className="mb-2 last:mb-0">{children}</p>;
                                },
                                ul({ children }) {
                                    return <ul className="list-disc pl-4 mb-2">{children}</ul>;
                                },
                                ol({ children }) {
                                    return <ol className="list-decimal pl-4 mb-2">{children}</ol>;
                                },
                            }}
                        >
                            {message.content}
                        </ReactMarkdown>
                        {isGenerating && (
                            <span className="inline-flex items-center gap-1 text-purple-400 text-xs mt-1">
                                <Loader2 size={12} className="animate-spin" />
                                thinking...
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* User avatar */}
            {isUser && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                    <User size={16} className="text-gray-300" />
                </div>
            )}
        </div>
    );
}

export const MessageBubble = memo(MessageBubbleInner);
