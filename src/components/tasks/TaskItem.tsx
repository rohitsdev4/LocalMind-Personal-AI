"use client";

import React from "react";
import { CheckSquare, Square, Clock, ArrowRight, Tag as TagIcon, LayoutList, Calendar as CalendarIcon, GripVertical } from "lucide-react";
import type { Task, TaskPriority } from "@/lib/types";

interface TaskItemProps {
    task: Task;
    onClick: () => void;
    onToggle: () => void;
}

export function TaskItem({ task, onClick, onToggle }: TaskItemProps) {
    const isCompleted = task.status === "done";

    const getPriorityColor = (priority: TaskPriority) => {
        switch (priority) {
            case "P1": return "text-accent-rose bg-accent-rose/10 border-accent-rose/20";
            case "P2": return "text-accent-amber bg-accent-amber/10 border-accent-amber/20";
            case "P3": return "text-brand-400 bg-brand-500/10 border-brand-500/20";
            case "P4": return "text-white/60 bg-white/5 border-white/10";
            default: return "text-white/60 bg-white/5 border-white/10";
        }
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return null;
        const date = new Date(dateString);

        // Return relative dates for today/tomorrow if needed, or simple format
        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            hour: date.getHours() > 0 ? "numeric" : undefined,
            minute: date.getMinutes() > 0 ? "2-digit" : undefined
        });
    };

    const getRecurrenceIcon = () => {
        if (!task.recurrence) return null;
        return (
            <span className="flex items-center gap-1 text-[10px] bg-white/5 px-2 py-0.5 rounded-md text-white/50 border border-white/5">
                <Clock className="w-3 h-3" />
                {task.recurrence}
            </span>
        );
    };

    return (
        <div
            className={`group relative flex items-center gap-3 p-3 rounded-xl bg-surface-100 border transition-all ${
                isCompleted
                ? "border-white/5 opacity-60"
                : "border-white/5 hover:border-white/10 hover:bg-surface-200"
            }`}
        >
            {/* Drag Handle */}
            <div className="text-white/20 cursor-grab active:cursor-grabbing hover:text-white/60 transition-colors shrink-0">
                <GripVertical className="w-4 h-4" />
            </div>

            {/* Checkbox */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onToggle();
                }}
                className={`shrink-0 transition-colors ${
                    isCompleted ? "text-accent-teal hover:text-accent-teal/80" : "text-white/30 hover:text-accent-teal"
                }`}
            >
                {isCompleted ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
            </button>

            {/* Content Area */}
            <div
                className="flex-1 min-w-0 cursor-pointer"
                onClick={onClick}
            >
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                    <span className={`text-sm font-medium truncate ${isCompleted ? "line-through text-white/40" : "text-white"}`}>
                        {task.name}
                    </span>

                    <div className="flex flex-wrap items-center gap-2 mt-1 sm:mt-0">
                        {/* Priority Badge */}
                        {!isCompleted && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getPriorityColor(task.priority)}`}>
                                {task.priority}
                            </span>
                        )}

                        {/* Due Date */}
                        {task.dueDate && (
                            <span className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md border ${
                                isCompleted
                                ? "bg-white/5 text-white/40 border-white/5"
                                : new Date(task.dueDate) < new Date()
                                    ? "bg-accent-rose/10 text-accent-rose border-accent-rose/20"
                                    : "bg-surface-300 text-white/60 border-white/10"
                            }`}>
                                <CalendarIcon className="w-3 h-3" />
                                {formatDate(task.dueDate)}
                            </span>
                        )}

                        {/* Recurrence */}
                        {getRecurrenceIcon()}

                        {/* Subtasks progress */}
                        {task.subTasks && task.subTasks.length > 0 && (
                            <span className="flex items-center gap-1 text-[10px] bg-white/5 px-2 py-0.5 rounded-md text-white/50 border border-white/5">
                                <LayoutList className="w-3 h-3" />
                                {task.subTasks.filter(st => st.status === "done").length}/{task.subTasks.length}
                            </span>
                        )}

                        {/* Tags */}
                        {task.tags && task.tags.length > 0 && (
                            <div className="flex items-center gap-1 hidden sm:flex">
                                {task.tags.map((tag, i) => (
                                    <span key={i} className="flex items-center gap-1 text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-white/40 border border-white/5">
                                        <TagIcon className="w-2.5 h-2.5" />
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Description Snippet */}
                {task.description && !isCompleted && (
                    <p className="text-xs text-white/40 mt-1 truncate max-w-full">
                        {task.description}
                    </p>
                )}
            </div>

            {/* Quick Action arrow */}
            <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onClick();
                    }}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white"
                >
                    <ArrowRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}

export default TaskItem;
