import React, { useState } from "react";
import { useReminders } from "@/hooks/useReminders";
import { Bell, Trash2, CheckCircle, Clock } from "lucide-react";

import type { Reminder } from "@/lib/types";

export function RemindersInterface() {
    const { reminders, dismissReminder, deleteReminder, snoozeReminder } = useReminders();
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Smart grouping
    const groupedReminders = reminders.reduce((acc, r) => {
        const date = new Date(r.triggerTime);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        let groupKey = "Upcoming";

        if (r.status === "dismissed" || r.status === "fired") {
            groupKey = "Past/Done";
        } else if (date.toDateString() === today.toDateString()) {
            groupKey = "Today";
        } else if (date.toDateString() === tomorrow.toDateString()) {
            groupKey = "Tomorrow";
        } else if (date < today) {
            groupKey = "Overdue";
        }

        if (!acc[groupKey]) acc[groupKey] = [];
        acc[groupKey].push(r);
        return acc;
    }, {} as Record<string, Reminder[]>);

    const groupOrder = ["Overdue", "Today", "Tomorrow", "Upcoming", "Past/Done"];

    const handleSelectAll = () => {
        if (selectedIds.size === reminders.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(reminders.map(r => r.id)));
        }
    };

    const handleSelect = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const handleBulkDelete = async () => {
        for (const id of Array.from(selectedIds)) {
            await deleteReminder(id);
        }
        setSelectedIds(new Set());
    };

    const handleBulkDismiss = async () => {
        for (const id of Array.from(selectedIds)) {
            await dismissReminder(id);
        }
        setSelectedIds(new Set());
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-surface relative z-10 text-white animate-fade-in">
            {/* Header */}
            <header className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-surface-100/50 backdrop-blur-xl">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-purple to-brand-500 flex items-center justify-center shadow-lg shadow-accent-purple/20">
                        <Bell className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold tracking-tight">Reminders</h2>
                        <p className="text-xs text-white/40">Manage alerts and notifications</p>
                    </div>
                </div>
                {reminders.length > 0 && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleSelectAll}
                            className="text-xs text-white/60 hover:text-white px-2 py-1 rounded hover:bg-white/10 transition-colors"
                        >
                            {selectedIds.size === reminders.length ? "Deselect All" : "Select All"}
                        </button>
                    </div>
                )}
            </header>

            {/* Bulk Actions Bar */}
            {selectedIds.size > 0 && (
                <div className="bg-brand-500/20 border-b border-brand-500/30 px-6 py-2 flex items-center justify-between animate-fade-in">
                    <span className="text-sm text-brand-200">{selectedIds.size} selected</span>
                    <div className="flex gap-2">
                        <button onClick={handleBulkDismiss} className="px-3 py-1 text-sm bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" /> Dismiss
                        </button>
                        <button onClick={handleBulkDelete} className="px-3 py-1 text-sm bg-accent-rose/20 text-accent-rose hover:bg-accent-rose/30 rounded-lg transition-colors flex items-center gap-1">
                            <Trash2 className="w-4 h-4" /> Delete
                        </button>
                    </div>
                </div>
            )}

            {/* List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {reminders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-white/40">
                        <Bell className="w-12 h-12 mb-4 opacity-20" />
                        <p>No reminders yet</p>
                        <p className="text-sm mt-2">Ask LocalMind to &quot;remind me to...&quot;</p>
                    </div>
                ) : (
                    groupOrder.map((group) => {
                        const groupItems = groupedReminders[group];
                        if (!groupItems || groupItems.length === 0) return null;

                        return (
                            <div key={group} className="space-y-3">
                                <h3 className="text-sm font-semibold text-white/60 tracking-wider uppercase">{group} ({groupItems.length})</h3>
                                {groupItems.map((r) => (
                                    <div key={r.id} className={`flex items-center justify-between p-4 rounded-xl bg-surface-200 border ${selectedIds.has(r.id) ? 'border-brand-500 bg-brand-500/10' : 'border-white/5 hover:border-white/10'} transition-colors cursor-pointer`} onClick={() => handleSelect(r.id)}>
                                        <div className="flex items-center gap-4">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(r.id)}
                                                readOnly
                                                className="w-4 h-4 rounded border-white/20 bg-transparent text-brand-500 focus:ring-brand-500"
                                            />
                                            <div>
                                                <h3 className={`font-medium ${r.status === 'dismissed' || r.status === 'fired' ? 'text-white/50 line-through' : 'text-white'}`}>{r.message}</h3>
                                                <div className="text-xs text-white/40 flex gap-2 mt-1">
                                                <span>{new Date(r.triggerTime).toLocaleString()}</span>
                                                {r.repeat && r.repeat !== 'none' && <span className="text-accent-purple bg-accent-purple/10 px-1.5 rounded">{r.repeat}</span>}
                                                {r.priority && <span className="text-brand-400 bg-brand-400/10 px-1.5 rounded">{r.priority}</span>}
                                                <span className="capitalize">{r.status || (r.fired ? 'fired' : 'active')}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                            {(r.status === 'active' || r.status === 'snoozed') && (
                                                <button onClick={() => dismissReminder(r.id)} className="p-2 rounded-lg text-white/40 hover:text-accent-emerald hover:bg-white/5 transition-colors" title="Mark as done/dismiss">
                                                    <CheckCircle className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button onClick={() => snoozeReminder(r.id, 60)} className="p-2 rounded-lg text-white/40 hover:text-accent-amber hover:bg-white/5 transition-colors" title="Snooze 1 hour">
                                                <Clock className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => deleteReminder(r.id)} className="p-2 rounded-lg text-white/40 hover:text-accent-rose hover:bg-white/5 transition-colors" title="Delete">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
