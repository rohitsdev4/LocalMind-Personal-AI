"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Plus, Check, Trash2, Clock, AlertCircle, ChevronDown } from "lucide-react";
import { Task, TaskStatus } from "@/lib/types";
import * as db from "@/lib/db";

interface TasksViewProps {
    onBack: () => void;
}

const PRIORITY_COLORS: Record<string, string> = {
    urgent: "bg-red-500/20 text-red-400 border-red-500/30",
    high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    low: "bg-green-500/20 text-green-400 border-green-500/30",
};

const STATUS_LABELS: Record<TaskStatus, string> = {
    pending: "Pending",
    "in-progress": "In Progress",
    done: "Done",
    cancelled: "Cancelled",
};

export function TasksView({ onBack }: TasksViewProps) {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [filter, setFilter] = useState<TaskStatus | "all">("all");
    const [loading, setLoading] = useState(true);
    const [showFilter, setShowFilter] = useState(false);

    const loadTasks = useCallback(async () => {
        setLoading(true);
        const allTasks = await db.getAllTasks();
        setTasks(allTasks);
        setLoading(false);
    }, []);

    useEffect(() => {
        loadTasks();
    }, [loadTasks]);

    const handleToggleStatus = async (task: Task) => {
        const nextStatus: Record<TaskStatus, TaskStatus> = {
            pending: "in-progress",
            "in-progress": "done",
            done: "pending",
            cancelled: "pending",
        };
        await db.updateTask(task.id, { status: nextStatus[task.status] });
        loadTasks();
    };

    const handleDelete = async (taskId: string) => {
        await db.deleteTask(taskId);
        loadTasks();
    };

    const filtered = filter === "all" ? tasks : tasks.filter((t) => t.status === filter);
    const grouped = {
        pending: filtered.filter((t) => t.status === "pending"),
        "in-progress": filtered.filter((t) => t.status === "in-progress"),
        done: filtered.filter((t) => t.status === "done"),
        cancelled: filtered.filter((t) => t.status === "cancelled"),
    };

    return (
        <div className="flex flex-col h-full bg-surface-400">
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-white/5">
                <button onClick={onBack} className="p-2 rounded-xl hover:bg-white/5 transition-colors">
                    <ArrowLeft size={20} className="text-gray-400" />
                </button>
                <h1 className="text-lg font-semibold text-white">Tasks</h1>
                <div className="ml-auto relative">
                    <button
                        onClick={() => setShowFilter(!showFilter)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 text-sm text-gray-400 hover:bg-white/10 transition-colors"
                    >
                        {filter === "all" ? "All" : STATUS_LABELS[filter]}
                        <ChevronDown size={14} />
                    </button>
                    {showFilter && (
                        <div className="absolute right-0 mt-1 w-36 bg-surface-200 rounded-xl border border-white/10 shadow-xl z-10 overflow-hidden">
                            {(["all", "pending", "in-progress", "done", "cancelled"] as const).map((s) => (
                                <button
                                    key={s}
                                    onClick={() => { setFilter(s); setShowFilter(false); }}
                                    className={`w-full text-left px-3 py-2 text-sm hover:bg-white/5 transition-colors ${
                                        filter === s ? "text-brand-400" : "text-gray-400"
                                    }`}
                                >
                                    {s === "all" ? "All" : STATUS_LABELS[s]}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {loading ? (
                    <div className="text-center text-gray-500 py-12">Loading tasks...</div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16">
                        <Plus size={48} className="mx-auto text-gray-600 mb-4" />
                        <p className="text-gray-400 text-lg font-medium">No tasks yet</p>
                        <p className="text-gray-600 text-sm mt-1">Ask LocalMind to create tasks for you in chat!</p>
                    </div>
                ) : (
                    Object.entries(grouped).map(([status, statusTasks]) => {
                        if (statusTasks.length === 0) return null;
                        return (
                            <div key={status}>
                                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                                    {STATUS_LABELS[status as TaskStatus]} ({statusTasks.length})
                                </h2>
                                <div className="space-y-2">
                                    {statusTasks.map((task) => (
                                        <div
                                            key={task.id}
                                            className={`group flex items-start gap-3 p-3 rounded-xl border transition-all ${
                                                task.status === "done"
                                                    ? "bg-white/2 border-white/5 opacity-60"
                                                    : "bg-surface-200 border-white/5 hover:border-white/10"
                                            }`}
                                        >
                                            <button
                                                onClick={() => handleToggleStatus(task)}
                                                className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                                                    task.status === "done"
                                                        ? "bg-brand-500 border-brand-500"
                                                        : task.status === "in-progress"
                                                        ? "border-brand-400 bg-brand-500/20"
                                                        : "border-gray-600 hover:border-gray-400"
                                                }`}
                                            >
                                                {task.status === "done" && <Check size={12} className="text-white" />}
                                                {task.status === "in-progress" && (
                                                    <Clock size={10} className="text-brand-400" />
                                                )}
                                            </button>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-medium ${
                                                    task.status === "done" ? "text-gray-500 line-through" : "text-white"
                                                }`}>
                                                    {task.name}
                                                </p>
                                                {task.description && (
                                                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{task.description}</p>
                                                )}
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    <span className={`text-xs px-1.5 py-0.5 rounded border ${PRIORITY_COLORS[task.priority]}`}>
                                                        {task.priority}
                                                    </span>
                                                    {task.dueDate && (
                                                        <span className="text-xs text-gray-500 flex items-center gap-1">
                                                            <AlertCircle size={10} />
                                                            {new Date(task.dueDate).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleDelete(task.id)}
                                                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 text-gray-600 hover:text-red-400 transition-all"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
