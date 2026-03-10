import React, { useState, useEffect } from "react";
import * as db from "@/lib/db";
import type { Habit } from "@/lib/types";
import { Flame, ListPlus, BarChart3, CheckCircle2, XCircle, PauseCircle, MessageSquare, Trash2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

export default function HabitsView() {
    const [activeTab, setActiveTab] = useState<"today" | "manage" | "analytics">("today");
    const [habits, setHabits] = useState<Habit[]>([]);

    useEffect(() => {
        loadHabits();
    }, []);

    const loadHabits = async () => {
        const loaded = await db.getAllHabits();
        setHabits(loaded);
    };

    return (
        <div className="flex flex-col h-full bg-surface text-white">
            {/* Header Tabs */}
            <div className="flex items-center gap-2 p-4 border-b border-white/5 overflow-x-auto no-scrollbar shrink-0">
                <button
                    onClick={() => setActiveTab("today")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        activeTab === "today"
                        ? "bg-accent-amber/20 text-accent-amber border border-accent-amber/30"
                        : "bg-surface-100 text-white/50 hover:bg-surface-200 hover:text-white"
                    }`}
                >
                    <CheckCircle2 className="w-4 h-4" />
                    Today
                </button>
                <button
                    onClick={() => setActiveTab("manage")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        activeTab === "manage"
                        ? "bg-brand-500/20 text-brand-400 border border-brand-500/30"
                        : "bg-surface-100 text-white/50 hover:bg-surface-200 hover:text-white"
                    }`}
                >
                    <ListPlus className="w-4 h-4" />
                    Manage
                </button>
                <button
                    onClick={() => setActiveTab("analytics")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        activeTab === "analytics"
                        ? "bg-accent-purple/20 text-accent-purple border border-accent-purple/30"
                        : "bg-surface-100 text-white/50 hover:bg-surface-200 hover:text-white"
                    }`}
                >
                    <BarChart3 className="w-4 h-4" />
                    Analytics
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {activeTab === "today" && <HabitsTodayTab habits={habits} onRefresh={loadHabits} />}
                {activeTab === "manage" && <HabitsManageTab habits={habits} onRefresh={loadHabits} />}
                {activeTab === "analytics" && <HabitsAnalyticsTab habits={habits} />}
            </div>
        </div>
    );
}

function HabitsTodayTab({ habits, onRefresh, }: { habits: Habit[], onRefresh: () => void,  }) {
    const today = new Date().toISOString().split("T")[0];

    // Group by time of day
    const morningHabits = habits.filter(h => h.timeOfDay === "morning");
    const afternoonHabits = habits.filter(h => h.timeOfDay === "afternoon");
    const eveningHabits = habits.filter(h => h.timeOfDay === "evening");
    const anyTimeHabits = habits.filter(h => h.timeOfDay === "any" || !h.timeOfDay);

    const [noteModalHabit, setNoteModalHabit] = useState<Habit | null>(null);
    const [noteText, setNoteText] = useState("");

    const handleLog = async (habit: Habit, status: "done" | "skipped" | "missed" | "paused", note?: string) => {
        const logIndex = habit.logs.findIndex((l) => l.date === today);
        const newLogs = [...habit.logs];

        let newStreak = habit.streak;
        let newLongest = habit.longestStreak || 0;

        if (logIndex >= 0) {
            // Re-evaluating streak is complex if going back in time, but for "today" it's simple
            const oldStatus = newLogs[logIndex].status;
            newLogs[logIndex] = { ...newLogs[logIndex], status, note: note !== undefined ? note : newLogs[logIndex].note };

            if (oldStatus !== "done" && status === "done") {
                newStreak += 1;
            } else if (oldStatus === "done" && status !== "done") {
                newStreak = Math.max(0, newStreak - 1);
            }
        } else {
            newLogs.push({ date: today, status, note });
            if (status === "done") {
                newStreak += 1;
            } else if (status === "skipped" || status === "missed") {
                newStreak = 0;
            }
        }

        if (newStreak > newLongest) {
            newLongest = newStreak;
        }

        await db.saveHabit({
            ...habit,
            logs: newLogs,
            streak: newStreak,
            longestStreak: newLongest,
            updatedAt: new Date().toISOString()
        });

        onRefresh();

        // Optionally send a message to chat
        // onSendMessage(`I just logged ${status} for ${habit.name}`);
    };

    const renderHabitGroup = (title: string, groupHabits: Habit[]) => {
        if (groupHabits.length === 0) return null;

        return (
            <div className="space-y-3 mb-6">
                <h4 className="text-xs font-bold text-white/50 uppercase tracking-wider pl-1">{title}</h4>
                <div className="space-y-2">
                    {groupHabits.map((habit) => {
                        const todayLog = habit.logs.find((l) => l.date === today);
                        const isDone = todayLog?.status === "done";

                        return (
                            <div key={habit.id} className="flex items-center justify-between p-3.5 bg-surface-100 rounded-2xl border border-white/5 shadow-lg">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-xl flex items-center justify-center ${isDone ? 'bg-accent-emerald/20 text-accent-emerald' : 'bg-surface-200 text-white/40'}`}>
                                        <CheckCircle2 className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h5 className={`font-semibold text-sm ${isDone ? 'text-white/60 line-through' : 'text-white'}`}>
                                            {habit.name}
                                        </h5>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-xs text-white/40">{habit.category || 'General'}</span>
                                            <span className="text-xs text-white/40">•</span>
                                            <span className="text-xs flex items-center gap-1 text-accent-amber">
                                                <Flame className="w-3 h-3" /> {habit.streak}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={() => handleLog(habit, "done")}
                                        className={`p-2 rounded-xl transition-all ${isDone ? 'bg-accent-emerald text-white shadow-lg shadow-accent-emerald/20' : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'}`}
                                    >
                                        <CheckCircle2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleLog(habit, "skipped")}
                                        className={`p-2 rounded-xl transition-all ${todayLog?.status === "skipped" ? 'bg-white/20 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'}`}
                                        title="Skip"
                                    >
                                        <XCircle className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleLog(habit, "paused")}
                                        className={`p-2 rounded-xl transition-all ${todayLog?.status === "paused" ? 'bg-accent-amber/20 text-accent-amber' : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'}`}
                                        title="Pause"
                                    >
                                        <PauseCircle className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => {
                                            setNoteModalHabit(habit);
                                            setNoteText(todayLog?.note || "");
                                        }}
                                        className={`p-2 rounded-xl transition-all ${todayLog?.note ? 'bg-brand-500/20 text-brand-400' : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'}`}
                                        title="Add Note"
                                    >
                                        <MessageSquare className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const quotes = [
        "Small daily improvements are the key to staggering long-term results.",
        "Motivation is what gets you started. Habit is what keeps you going.",
        "Success is the sum of small efforts, repeated day in and day out.",
        "Your net worth to the world is usually determined by what remains after your bad habits are subtracted from your good ones."
    ];
    const dailyQuote = quotes[new Date().getDate() % quotes.length];

    if (habits.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-48 text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-surface-200 flex items-center justify-center">
                    <Flame className="w-8 h-8 text-white/20" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-white">No habits yet</h3>
                    <p className="text-sm text-white/40 mt-1">Go to Manage to create your first habit.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in pb-10">
            <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-brand-500/10 to-accent-purple/10 border border-white/5">
                <div className="flex items-center gap-2 mb-2">
                    <Flame className="w-5 h-5 text-accent-amber" />
                    <h3 className="font-bold text-white">Daily Motivation</h3>
                </div>
                <p className="text-sm text-white/70 italic">&quot;{dailyQuote}&quot;</p>
            </div>

            {renderHabitGroup("Morning", morningHabits)}
            {renderHabitGroup("Afternoon", afternoonHabits)}
            {renderHabitGroup("Evening", eveningHabits)}
            {renderHabitGroup("Any Time", anyTimeHabits)}

            {noteModalHabit && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-surface-100 w-full max-w-sm rounded-2xl p-4 border border-white/10 shadow-2xl">
                        <h3 className="text-lg font-bold text-white mb-2">Note for {noteModalHabit.name}</h3>
                        <textarea
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            placeholder="Add a note about today's progress..."
                            className="w-full bg-surface-200 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-white/30 mb-4 h-24 resize-none"
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setNoteModalHabit(null)}
                                className="px-4 py-2 rounded-xl text-white/50 hover:text-white transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    const todayLog = noteModalHabit.logs.find(l => l.date === today);
                                    handleLog(noteModalHabit, todayLog?.status || "done", noteText);
                                    setNoteModalHabit(null);
                                }}
                                className="px-4 py-2 rounded-xl bg-brand-500 text-white font-medium hover:bg-brand-600 transition-all"
                            >
                                Save Note
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function HabitsManageTab({ habits, onRefresh }: { habits: Habit[], onRefresh: () => void }) {
    const [isCreating, setIsCreating] = useState(false);
    const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
    const [name, setName] = useState("");
    const [category, setCategory] = useState("Health");
    const [timeOfDay, setTimeOfDay] = useState<"morning" | "afternoon" | "evening" | "any">("any");
    const [frequencyType, setFrequencyType] = useState<"daily" | "weekly" | "monthly" | "x_per_week">("daily");
    const [frequencyTimes, setFrequencyTimes] = useState(3);

    const openCreate = () => {
        setIsCreating(true);
        setEditingHabitId(null);
        setName("");
        setCategory("Health");
        setTimeOfDay("any");
        setFrequencyType("daily");
        setFrequencyTimes(3);
    };

    const openEdit = (habit: Habit) => {
        setIsCreating(true);
        setEditingHabitId(habit.id);
        setName(habit.name);
        setCategory(habit.category || "Health");
        setTimeOfDay(habit.timeOfDay || "any");
        if (typeof habit.frequency === "object" && habit.frequency.type === "x_per_week") {
            setFrequencyType("x_per_week");
            setFrequencyTimes(habit.frequency.times);
        } else {
            setFrequencyType(habit.frequency as "daily" | "weekly" | "monthly");
            setFrequencyTimes(3);
        }
    };

    const handleSave = async () => {
        if (!name.trim()) return;

        if (editingHabitId) {
            const habit = habits.find(h => h.id === editingHabitId);
            if (habit) {
                const updatedHabit: Habit = {
                    ...habit,
                    name: name.trim(),
                    category,
                    timeOfDay,
                    frequency: frequencyType === "x_per_week" ? { type: "x_per_week", times: frequencyTimes } : frequencyType,
                    updatedAt: new Date().toISOString(),
                };
                await db.saveHabit(updatedHabit);
            }
        } else {
            const newHabit: Habit = {
                id: uuidv4(),
                name: name.trim(),
                category,
                timeOfDay,
                frequency: frequencyType === "x_per_week" ? { type: "x_per_week", times: frequencyTimes } : frequencyType,
                logs: [],
                streak: 0,
                longestStreak: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            await db.saveHabit(newHabit);
        }

        onRefresh();
        setIsCreating(false);
        setEditingHabitId(null);
    };

    const handleDelete = async (id: string) => {
        if (confirm("Are you sure you want to delete this habit? All progress will be lost.")) {
            await db.deleteHabit(id);
            onRefresh();
        }
    };

    if (isCreating) {
        return (
            <div className="animate-fade-in space-y-4">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold">{editingHabitId ? "Edit Habit" : "Create Habit"}</h3>
                    <button onClick={() => setIsCreating(false)} className="text-white/50 hover:text-white">Cancel</button>
                </div>

                <div className="space-y-4 bg-surface-100 p-4 rounded-2xl border border-white/5">
                    <div>
                        <label className="block text-xs font-bold text-white/50 mb-1 uppercase tracking-wider">Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Drink Water"
                            className="w-full bg-surface-200 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-white/30"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-white/50 mb-1 uppercase tracking-wider">Category</label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full bg-surface-200 border border-white/10 rounded-xl p-3 text-sm text-white"
                            >
                                <option value="Health">Health</option>
                                <option value="Learning">Learning</option>
                                <option value="Productivity">Productivity</option>
                                <option value="Mindfulness">Mindfulness</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-white/50 mb-1 uppercase tracking-wider">Time of Day</label>
                            <select
                                value={timeOfDay}
                                onChange={(e) => setTimeOfDay(e.target.value as "morning" | "afternoon" | "evening" | "any")}
                                className="w-full bg-surface-200 border border-white/10 rounded-xl p-3 text-sm text-white"
                            >
                                <option value="any">Any Time</option>
                                <option value="morning">Morning</option>
                                <option value="afternoon">Afternoon</option>
                                <option value="evening">Evening</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-white/50 mb-1 uppercase tracking-wider">Frequency</label>
                        <select
                            value={frequencyType}
                            onChange={(e) => setFrequencyType(e.target.value as "daily" | "weekly" | "monthly" | "x_per_week")}
                            className="w-full bg-surface-200 border border-white/10 rounded-xl p-3 text-sm text-white mb-2"
                        >
                            <option value="daily">Daily</option>
                            <option value="x_per_week">X Times Per Week</option>
                        </select>

                        {frequencyType === "x_per_week" && (
                            <div className="flex items-center gap-4">
                                <span className="text-sm text-white/70">Times per week:</span>
                                <input
                                    type="number"
                                    min="1"
                                    max="6"
                                    value={frequencyTimes}
                                    onChange={(e) => setFrequencyTimes(parseInt(e.target.value))}
                                    className="w-20 bg-surface-200 border border-white/10 rounded-xl p-2 text-sm text-center text-white"
                                />
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={!name.trim()}
                        className="w-full py-3 rounded-xl bg-brand-500 text-white font-medium hover:bg-brand-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                    >
                        {editingHabitId ? "Save Changes" : "Create Habit"}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in space-y-4 pb-10">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold">Manage Habits</h3>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-500/20 text-brand-400 font-medium text-sm hover:bg-brand-500/30 transition-all"
                >
                    <ListPlus className="w-4 h-4" />
                    New Habit
                </button>
            </div>

            {habits.length === 0 ? (
                <div className="text-center py-10 bg-surface-100 rounded-2xl border border-white/5">
                    <p className="text-white/50">No habits created yet.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {habits.map((habit) => (
                        <div key={habit.id} className="flex items-center justify-between p-4 bg-surface-100 rounded-2xl border border-white/5">
                            <div>
                                <h4 className="font-semibold">{habit.name}</h4>
                                <div className="flex items-center gap-2 text-xs text-white/50 mt-1">
                                    <span>{habit.category}</span>
                                    <span>•</span>
                                    <span>{habit.timeOfDay === 'any' ? 'Any Time' : habit.timeOfDay}</span>
                                    <span>•</span>
                                    <span>{typeof habit.frequency === 'object' ? `${habit.frequency.times}x/week` : habit.frequency}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => openEdit(habit)}
                                    className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-all"
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={() => handleDelete(habit.id)}
                                    className="p-2 rounded-xl text-accent-rose/50 hover:text-accent-rose hover:bg-accent-rose/10 transition-all"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function HabitsAnalyticsTab({ habits }: { habits: Habit[] }) {
    if (habits.length === 0) {
        return (
            <div className="text-center py-10">
                <p className="text-white/50">Log habits to see your analytics.</p>
            </div>
        );
    }

    const today = new Date().toISOString().split("T")[0];

    // Overall Stats

    const longestStreakOverall = Math.max(...habits.map(h => h.longestStreak || 0), 0);

    // Completion rate (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

    let possibleLogs = 0;
    let actualLogs = 0;

    habits.forEach(h => {
        // Simplified calculation for demo purposes: assume daily habit created 30 days ago
        // Real logic would calculate based on creation date and specific frequency
        const habitCreatedDate = h.createdAt.split("T")[0];
        const startDate = habitCreatedDate > thirtyDaysAgoStr ? habitCreatedDate : thirtyDaysAgoStr;

        // Count days since start date
        const start = new Date(startDate);
        const end = new Date(today);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // inclusive

        possibleLogs += diffDays;

        const doneInPeriod = h.logs.filter(l => l.date >= startDate && l.date <= today && l.status === "done").length;
        actualLogs += doneInPeriod;
    });

    const completionRate = possibleLogs > 0 ? Math.round((actualLogs / possibleLogs) * 100) : 0;

    // Best Day Analysis
    const dayCounts = [0, 0, 0, 0, 0, 0, 0]; // Sun to Sat
    const daySuccess = [0, 0, 0, 0, 0, 0, 0];

    habits.forEach(h => {
        h.logs.forEach(l => {
            if (l.date >= thirtyDaysAgoStr) {
                const dayOfWeek = new Date(l.date).getDay();
                dayCounts[dayOfWeek]++;
                if (l.status === "done") {
                    daySuccess[dayOfWeek]++;
                }
            }
        });
    });

    const dayRates = dayCounts.map((count, i) => count > 0 ? (daySuccess[i] / count) * 100 : 0);
    const bestDayIndex = dayRates.indexOf(Math.max(...dayRates));
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const bestDay = dayRates[bestDayIndex] > 0 ? dayNames[bestDayIndex] : "N/A";

    return (
        <div className="animate-fade-in space-y-6 pb-10">
            <h3 className="text-lg font-bold">Overview</h3>

            <div className="grid grid-cols-2 gap-4">
                <div className="bg-surface-100 p-4 rounded-2xl border border-white/5">
                    <div className="text-white/50 text-xs font-bold uppercase tracking-wider mb-2">Completion Rate (30d)</div>
                    <div className="text-3xl font-bold text-accent-emerald">{completionRate}%</div>
                </div>
                <div className="bg-surface-100 p-4 rounded-2xl border border-white/5">
                    <div className="text-white/50 text-xs font-bold uppercase tracking-wider mb-2">Longest Streak</div>
                    <div className="text-3xl font-bold text-accent-amber flex items-center gap-1">
                        <Flame className="w-6 h-6" /> {longestStreakOverall}
                    </div>
                </div>
                <div className="bg-surface-100 p-4 rounded-2xl border border-white/5 col-span-2">
                    <div className="text-white/50 text-xs font-bold uppercase tracking-wider mb-2">Best Performing Day</div>
                    <div className="text-2xl font-bold text-brand-400">{bestDay}</div>
                    <div className="text-xs text-white/40 mt-1">Based on last 30 days</div>
                </div>
            </div>

            <h3 className="text-lg font-bold mt-8 mb-4">Habit Consistency & Heatmaps</h3>
            <div className="space-y-6">
                {habits.map(habit => {
                    const rate = habit.logs.length > 0
                        ? Math.round((habit.logs.filter(l => l.status === "done").length / habit.logs.length) * 100)
                        : 0;

                    // Generate last 28 days for heatmap (4 weeks x 7 days)
                    const heatmapDays = Array.from({ length: 28 }).map((_, i) => {
                        const d = new Date();
                        d.setDate(d.getDate() - (27 - i));
                        const dateStr = d.toISOString().split("T")[0];
                        const log = habit.logs.find(l => l.date === dateStr);
                        return { date: dateStr, status: log?.status };
                    });

                    return (
                        <div key={habit.id} className="bg-surface-100 p-4 rounded-2xl border border-white/5">
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="font-semibold">{habit.name}</h4>
                                <span className="text-sm font-bold text-brand-400">{rate}%</span>
                            </div>
                            <div className="w-full bg-surface-200 rounded-full h-2 overflow-hidden mb-4">
                                <div
                                    className="bg-brand-500 h-2 rounded-full transition-all duration-1000"
                                    style={{ width: `${rate}%` }}
                                ></div>
                            </div>

                            <div className="grid grid-cols-7 gap-1">
                                {heatmapDays.map((day) => (
                                    <div
                                        key={day.date}
                                        className={`h-6 rounded flex items-center justify-center border border-white/5 ${
                                            day.status === "done" ? 'bg-accent-emerald' :
                                            day.status === "skipped" ? 'bg-white/20' :
                                            day.status === "paused" ? 'bg-accent-amber/50' :
                                            day.status === "missed" ? 'bg-accent-rose/20' :
                                            'bg-surface-200'
                                        }`}
                                        title={`${day.date}: ${day.status || 'No entry'}`}
                                    />
                                ))}
                            </div>

                            <div className="flex items-center justify-between mt-4 text-xs text-white/50">
                                <span className="flex items-center gap-1">
                                    <Flame className="w-3 h-3 text-accent-amber" /> Current: {habit.streak}
                                </span>
                                <span>Best streak: {habit.longestStreak || 0}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
