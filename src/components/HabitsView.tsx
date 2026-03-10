import React, { useEffect, useState } from "react";
import { Flame, ArrowLeft } from "lucide-react";
import db from "@/lib/db";
import type { Habit } from "@/lib/types";

interface HabitsViewProps {
    onClose: () => void;
}

export function HabitsView({ onClose }: HabitsViewProps) {
    const [habits, setHabits] = useState<Habit[]>([]);

    useEffect(() => {
        loadHabits();
    }, []);

    const loadHabits = async () => {
        const loadedHabits = await db.getAllHabits();
        setHabits(loadedHabits);
    };

    // Generate last 30 days for the heatmap
    const getLast30Days = () => {
        const days = [];
        for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            days.push(d.toISOString().split("T")[0]);
        }
        return days;
    };

    const heatmapDays = getLast30Days();

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
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent-amber to-brand-500 flex items-center justify-center shadow-lg shadow-accent-amber/20">
                    <Flame className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-lg font-bold text-white tracking-tight">Habits & Streaks</h1>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {habits.length === 0 ? (
                    <div className="text-center py-10 text-white/50">
                        <Flame className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>No habits tracked yet.</p>
                        <p className="text-sm mt-1">Ask the AI to log a habit!</p>
                    </div>
                ) : (
                    habits.map((habit) => (
                        <div
                            key={habit.id}
                            className="p-5 rounded-2xl bg-surface-100 border border-white/5 shadow-xl"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-lg font-semibold text-white">{habit.name}</h3>
                                    <p className="text-sm text-white/40 capitalize">{habit.frequency}</p>
                                </div>
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-accent-amber/10 text-accent-amber">
                                    <Flame className="w-4 h-4" />
                                    <span className="font-bold">{habit.streak} day streak</span>
                                </div>
                            </div>

                            {/* Heatmap */}
                            <div className="mt-4">
                                <h4 className="text-xs font-medium text-white/30 uppercase tracking-wider mb-2">
                                    Last 30 Days
                                </h4>
                                <div className="flex flex-wrap gap-1.5">
                                    {heatmapDays.map((day) => {
                                        const log = habit.logs.find((l) => l.date === day);
                                        let bgClass = "bg-white/5"; // No data

                                        if (log) {
                                            if (log.status === "done") bgClass = "bg-accent-amber";
                                            else if (log.status === "skipped") bgClass = "bg-white/20";
                                            else bgClass = "bg-accent-rose";
                                        }

                                        return (
                                            <div
                                                key={day}
                                                title={`${day}: ${log ? log.status : "No data"}`}
                                                className={`w-5 h-5 sm:w-6 sm:h-6 rounded-md ${bgClass} transition-all hover:scale-110 cursor-help`}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
