"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Bell, Trash2, Check, Clock, Repeat } from "lucide-react";
import { Reminder } from "@/lib/types";
import * as db from "@/lib/db";

interface RemindersViewProps {
    onBack: () => void;
}

export function RemindersView({ onBack }: RemindersViewProps) {
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [showCompleted, setShowCompleted] = useState(false);
    const [loading, setLoading] = useState(true);

    const loadReminders = useCallback(async () => {
        setLoading(true);
        const all = await db.getAllReminders();
        setReminders(all);
        setLoading(false);
    }, []);

    useEffect(() => {
        loadReminders();
    }, [loadReminders]);

    const handleComplete = async (id: string) => {
        await db.updateReminder(id, { completed: true });
        loadReminders();
    };

    const handleDelete = async (id: string) => {
        await db.deleteReminder(id);
        loadReminders();
    };

    const getTimeInfo = (timeStr: string, completed: boolean) => {
        if (completed) return { label: "Completed", color: "text-green-400" };
        const time = new Date(timeStr).getTime();
        const now = Date.now();
        const diff = time - now;

        if (diff < 0) return { label: "Overdue", color: "text-red-400" };
        if (diff < 60000) return { label: "Less than 1 min", color: "text-yellow-400" };
        if (diff < 3600000) return { label: `${Math.floor(diff / 60000)} min`, color: "text-yellow-400" };
        if (diff < 86400000) return { label: `${Math.floor(diff / 3600000)} hr`, color: "text-blue-400" };
        return { label: `${Math.floor(diff / 86400000)} days`, color: "text-gray-400" };
    };

    const filtered = showCompleted ? reminders : reminders.filter((r) => !r.completed);
    const active = filtered.filter((r) => !r.completed);
    const completed = filtered.filter((r) => r.completed);

    return (
        <div className="flex flex-col h-full bg-surface-400">
            <div className="flex items-center gap-3 p-4 border-b border-white/5">
                <button onClick={onBack} className="p-2 rounded-xl hover:bg-white/5 transition-colors">
                    <ArrowLeft size={20} className="text-gray-400" />
                </button>
                <h1 className="text-lg font-semibold text-white">Reminders</h1>
                <div className="ml-auto">
                    <button
                        onClick={() => setShowCompleted(!showCompleted)}
                        className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                            showCompleted ? "bg-brand-500/20 text-brand-400" : "bg-white/5 text-gray-500"
                        }`}
                    >
                        {showCompleted ? "Hide Completed" : "Show Completed"}
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loading ? (
                    <div className="text-center text-gray-500 py-12">Loading reminders...</div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16">
                        <Bell size={48} className="mx-auto text-gray-600 mb-4" />
                        <p className="text-gray-400 text-lg font-medium">No reminders</p>
                        <p className="text-gray-600 text-sm mt-1">
                            Ask LocalMind to set a reminder for you!
                        </p>
                    </div>
                ) : (
                    <>
                        {active.length > 0 && (
                            <div>
                                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                                    Active ({active.length})
                                </h2>
                                <div className="space-y-2">
                                    {active.map((reminder) => {
                                        const timeInfo = getTimeInfo(reminder.time, false);
                                        return (
                                            <div
                                                key={reminder.id}
                                                className="group flex items-start gap-3 p-3 bg-surface-200 rounded-xl border border-white/5 hover:border-white/10 transition-all"
                                            >
                                                <button
                                                    onClick={() => handleComplete(reminder.id)}
                                                    className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-md border-2 border-gray-600 hover:border-brand-400 flex items-center justify-center transition-colors"
                                                >
                                                </button>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-white">{reminder.message}</p>
                                                    <div className="flex items-center gap-2 mt-1.5">
                                                        <span className={`text-xs flex items-center gap-1 ${timeInfo.color}`}>
                                                            <Clock size={10} />
                                                            {timeInfo.label}
                                                        </span>
                                                        <span className="text-xs text-gray-600">
                                                            {new Date(reminder.time).toLocaleString()}
                                                        </span>
                                                        {reminder.repeat !== "none" && (
                                                            <span className="text-xs text-purple-400 flex items-center gap-0.5">
                                                                <Repeat size={10} />
                                                                {reminder.repeat}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleDelete(reminder.id)}
                                                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 text-gray-600 hover:text-red-400 transition-all"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {showCompleted && completed.length > 0 && (
                            <div>
                                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                                    Completed ({completed.length})
                                </h2>
                                <div className="space-y-2">
                                    {completed.map((reminder) => (
                                        <div
                                            key={reminder.id}
                                            className="group flex items-start gap-3 p-3 bg-white/2 rounded-xl border border-white/5 opacity-60"
                                        >
                                            <div className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-md bg-brand-500 border-2 border-brand-500 flex items-center justify-center">
                                                <Check size={12} className="text-white" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-gray-500 line-through">{reminder.message}</p>
                                                <span className="text-xs text-gray-600">
                                                    {new Date(reminder.time).toLocaleString()}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => handleDelete(reminder.id)}
                                                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 text-gray-600 hover:text-red-400 transition-all"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
