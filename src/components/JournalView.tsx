"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, BookOpen, Trash2 } from "lucide-react";
import { JournalEntry } from "@/lib/types";
import * as db from "@/lib/db";

interface JournalViewProps {
    onBack: () => void;
}

const MOOD_EMOJI: Record<string, string> = {
    great: "\u2B50",
    good: "\uD83D\uDE0A",
    okay: "\uD83D\uDE10",
    bad: "\uD83D\uDE1F",
    terrible: "\uD83D\uDE22",
};

const MOOD_COLORS: Record<string, string> = {
    great: "bg-yellow-500/20 text-yellow-400",
    good: "bg-green-500/20 text-green-400",
    okay: "bg-blue-500/20 text-blue-400",
    bad: "bg-orange-500/20 text-orange-400",
    terrible: "bg-red-500/20 text-red-400",
};

export function JournalView({ onBack }: JournalViewProps) {
    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [loading, setLoading] = useState(true);

    const loadEntries = useCallback(async () => {
        setLoading(true);
        const all = await db.getAllJournalEntries();
        setEntries(all);
        setLoading(false);
    }, []);

    useEffect(() => {
        loadEntries();
    }, [loadEntries]);

    const handleDelete = async (id: string) => {
        await db.deleteJournalEntry(id);
        loadEntries();
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) return "Today";
        if (days === 1) return "Yesterday";
        if (days < 7) return `${days} days ago`;
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    };

    return (
        <div className="flex flex-col h-full bg-surface-400">
            <div className="flex items-center gap-3 p-4 border-b border-white/5">
                <button onClick={onBack} className="p-2 rounded-xl hover:bg-white/5 transition-colors">
                    <ArrowLeft size={20} className="text-gray-400" />
                </button>
                <h1 className="text-lg font-semibold text-white">Journal</h1>
                <span className="text-sm text-gray-500">{entries.length} entries</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loading ? (
                    <div className="text-center text-gray-500 py-12">Loading journal...</div>
                ) : entries.length === 0 ? (
                    <div className="text-center py-16">
                        <BookOpen size={48} className="mx-auto text-gray-600 mb-4" />
                        <p className="text-gray-400 text-lg font-medium">No journal entries yet</p>
                        <p className="text-gray-600 text-sm mt-1">
                            Share your thoughts with LocalMind and they will be journaled!
                        </p>
                    </div>
                ) : (
                    entries.map((entry) => (
                        <div
                            key={entry.id}
                            className="group bg-surface-200 rounded-xl border border-white/5 hover:border-white/10 p-4 transition-all"
                        >
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${MOOD_COLORS[entry.mood] || MOOD_COLORS.okay}`}>
                                        {MOOD_EMOJI[entry.mood] || MOOD_EMOJI.okay} {entry.mood}
                                    </span>
                                    <span className="text-xs text-gray-600">{formatDate(entry.createdAt)}</span>
                                </div>
                                <button
                                    onClick={() => handleDelete(entry.id)}
                                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 text-gray-600 hover:text-red-400 transition-all"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                            <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{entry.entry}</p>
                            {entry.tags && entry.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-3">
                                    {entry.tags.map((tag) => (
                                        <span
                                            key={tag}
                                            className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-gray-500"
                                        >
                                            #{tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
