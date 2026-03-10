import React, { useEffect, useState } from "react";
import { BookHeart, ArrowLeft, BarChart3 } from "lucide-react";
import db from "@/lib/db";
import type { JournalEntry, Mood } from "@/lib/types";

interface JournalViewProps {
    onClose: () => void;
}

export function JournalView({ onClose }: JournalViewProps) {
    const [entries, setEntries] = useState<JournalEntry[]>([]);

    useEffect(() => {
        loadEntries();
    }, []);

    const loadEntries = async () => {
        const loadedEntries = await db.getAllJournalEntries();
        setEntries(loadedEntries);
    };

    const moodEmoji: Record<Mood, string> = {
        great: "😄",
        good: "🙂",
        okay: "😐",
        bad: "😟",
        terrible: "😢",
    };

    const moodColors: Record<Mood, string> = {
        great: "text-accent-emerald",
        good: "text-accent-teal",
        okay: "text-brand-400",
        bad: "text-accent-amber",
        terrible: "text-accent-rose",
    };

    const moodBgColors: Record<Mood, string> = {
        great: "bg-accent-emerald",
        good: "bg-accent-teal",
        okay: "bg-brand-400",
        bad: "bg-accent-amber",
        terrible: "bg-accent-rose",
    };

    // Calculate analytics
    const moodCounts: Record<Mood, number> = {
        great: 0,
        good: 0,
        okay: 0,
        bad: 0,
        terrible: 0,
    };

    entries.forEach((e) => {
        if (moodCounts[e.mood] !== undefined) {
            moodCounts[e.mood]++;
        }
    });

    const totalEntries = entries.length;

    return (
        <div className="fixed inset-0 z-40 bg-surface flex flex-col animate-fade-in">
            {/* Header */}
            <header className="flex-shrink-0 flex items-center gap-3 px-4 py-3 bg-surface-100/50 border-b border-white/5 backdrop-blur-xl">
                <button
                    onClick={onClose}
                    className="p-2 -ml-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent-pink to-brand-500 flex items-center justify-center shadow-lg shadow-accent-pink/20">
                    <BookHeart className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-lg font-bold text-white tracking-tight">Journal & Analytics</h1>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {totalEntries === 0 ? (
                    <div className="text-center py-10 text-white/50">
                        <BookHeart className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>No journal entries yet.</p>
                        <p className="text-sm mt-1">Ask the AI to log your day!</p>
                    </div>
                ) : (
                    <>
                        {/* Analytics Card */}
                        <div className="p-5 rounded-2xl bg-surface-100 border border-white/5 shadow-xl">
                            <div className="flex items-center gap-2 mb-4 text-white">
                                <BarChart3 className="w-5 h-5 text-accent-pink" />
                                <h3 className="text-lg font-semibold">Mood Analytics</h3>
                            </div>

                            <div className="space-y-4">
                                {(Object.keys(moodCounts) as Mood[]).map((mood) => {
                                    const count = moodCounts[mood];
                                    const percentage = totalEntries > 0 ? (count / totalEntries) * 100 : 0;

                                    return (
                                        <div key={mood} className="flex items-center gap-3">
                                            <div className="w-8 text-center text-xl" title={mood}>
                                                {moodEmoji[mood]}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span className={`capitalize font-medium ${moodColors[mood]}`}>{mood}</span>
                                                    <span className="text-white/50">{count} ({percentage.toFixed(0)}%)</span>
                                                </div>
                                                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${moodBgColors[mood]} transition-all duration-1000`}
                                                        style={{ width: `${percentage}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Recent Entries */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider px-1">
                                Recent Entries
                            </h3>
                            {entries.map((entry) => (
                                <div key={entry.id} className="p-4 rounded-xl bg-surface-100/50 border border-white/5">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-2xl">{moodEmoji[entry.mood]}</span>
                                        <span className="text-xs text-white/30">
                                            {new Date(entry.createdAt).toLocaleDateString(undefined, {
                                                weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                            })}
                                        </span>
                                    </div>
                                    <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
                                        {entry.entry}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
