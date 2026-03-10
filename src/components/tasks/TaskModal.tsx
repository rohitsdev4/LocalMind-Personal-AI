"use client";

import React, { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { X, Trash2, Calendar as CalendarIcon, Clock, Tag as TagIcon, LayoutList, Plus, CheckSquare, Square } from "lucide-react";
import type { Task, SubTask, TaskPriority } from "@/lib/types";

interface TaskModalProps {
    task: Task | null;
    isOpen: boolean;
    onClose: () => void;
    onSave: (task: Task) => void;
    onDelete: (id: string) => void;
}

export function TaskModal({ task, isOpen, onClose, onSave, onDelete }: TaskModalProps) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [priority, setPriority] = useState<TaskPriority>("P3");

    // Combining date and time for dueDate
    const [dueDate, setDueDate] = useState("");
    const [dueTime, setDueTime] = useState("");

    const [tagsInput, setTagsInput] = useState("");
    const [tags, setTags] = useState<string[]>([]);

    const [recurrence, setRecurrence] = useState<Task["recurrence"]>(null);

    const [subTasks, setSubTasks] = useState<SubTask[]>([]);
    const [newSubTaskName, setNewSubTaskName] = useState("");

    useEffect(() => {
        if (task) {
            setName(task.name);
            setDescription(task.description || "");
            setPriority(task.priority);

            if (task.dueDate) {
                const dateObj = new Date(task.dueDate);
                // Adjust for local timezone offset when setting date input
                const tzOffset = dateObj.getTimezoneOffset() * 60000;
                const localISOTime = (new Date(dateObj.getTime() - tzOffset)).toISOString();
                setDueDate(localISOTime.split("T")[0]);

                // Set time part if it's not midnight (00:00:00)
                const hours = dateObj.getHours().toString().padStart(2, '0');
                const minutes = dateObj.getMinutes().toString().padStart(2, '0');
                if (hours !== "00" || minutes !== "00") {
                    setDueTime(`${hours}:${minutes}`);
                } else {
                    setDueTime("");
                }
            } else {
                setDueDate("");
                setDueTime("");
            }

            setTags(task.tags || []);
            setTagsInput("");
            setRecurrence(task.recurrence || null);
            setSubTasks(task.subTasks || []);
        } else {
            // Defaults for new task
            setName("");
            setDescription("");
            setPriority("P3");
            setDueDate("");
            setDueTime("");
            setTags([]);
            setTagsInput("");
            setRecurrence(null);
            setSubTasks([]);
            setNewSubTaskName("");
        }
    }, [task, isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        if (!name.trim()) return;

        let finalDueDateStr: string | undefined = undefined;

        if (dueDate) {
            const [year, month, day] = dueDate.split("-").map(Number);
            const dateObj = new Date(year, month - 1, day);
            if (dueTime) {
                const [hours, mins] = dueTime.split(":");
                dateObj.setHours(parseInt(hours, 10), parseInt(mins, 10));
            } else {
                dateObj.setHours(23, 59, 59); // End of day default
            }
            finalDueDateStr = dateObj.toISOString();
        }

        const taskToSave: Task = {
            id: task ? task.id : uuidv4(),
            name: name.trim(),
            description: description.trim() || undefined,
            priority,
            status: task ? task.status : "pending",
            dueDate: finalDueDateStr,
            createdAt: task ? task.createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            tags: tags.length > 0 ? tags : undefined,
            subTasks: subTasks.length > 0 ? subTasks : undefined,
            recurrence,
            order: task?.order,
        };

        onSave(taskToSave);
    };

    const handleAddTag = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && tagsInput.trim()) {
            e.preventDefault();
            if (!tags.includes(tagsInput.trim())) {
                setTags([...tags, tagsInput.trim()]);
            }
            setTagsInput("");
        }
    };

    const removeTag = (tagToRemove: string) => {
        setTags(tags.filter(t => t !== tagToRemove));
    };

    const handleAddSubTask = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && newSubTaskName.trim()) {
            e.preventDefault();
            setSubTasks([...subTasks, { id: uuidv4(), name: newSubTaskName.trim(), status: "pending" }]);
            setNewSubTaskName("");
        }
    };

    const toggleSubTask = (id: string) => {
        setSubTasks(subTasks.map(st =>
            st.id === id ? { ...st, status: st.status === "done" ? "pending" : "done" } : st
        ));
    };

    const removeSubTask = (id: string) => {
        setSubTasks(subTasks.filter(st => st.id !== id));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-lg max-h-[90vh] bg-surface border border-white/10 rounded-2xl shadow-2xl flex flex-col animate-fade-in">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/5">
                    <h2 className="text-lg font-bold text-white tracking-tight">
                        {task ? "Edit Task" : "New Task"}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-all"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-5">

                    {/* Name */}
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-white/50 px-1">Task Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="What needs to be done?"
                            className="w-full px-4 py-3 rounded-xl bg-surface-100 border border-white/5 text-white placeholder-white/20 focus:outline-none focus:border-accent-teal/50 focus:bg-surface-200 transition-all text-sm font-medium"
                            autoFocus
                        />
                    </div>

                    {/* Priority & Recurrence Row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-white/50 px-1">Priority</label>
                            <select
                                value={priority}
                                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                                className="w-full px-4 py-3 rounded-xl bg-surface-100 border border-white/5 text-white focus:outline-none focus:border-accent-teal/50 focus:bg-surface-200 transition-all text-sm outline-none appearance-none"
                            >
                                <option value="P1">P1 - Urgent</option>
                                <option value="P2">P2 - High</option>
                                <option value="P3">P3 - Medium</option>
                                <option value="P4">P4 - Low</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-white/50 px-1">Recurrence</label>
                            <select
                                value={recurrence || ""}
                                onChange={(e) => setRecurrence(e.target.value ? e.target.value as Task["recurrence"] : null)}
                                className="w-full px-4 py-3 rounded-xl bg-surface-100 border border-white/5 text-white focus:outline-none focus:border-accent-teal/50 focus:bg-surface-200 transition-all text-sm outline-none appearance-none"
                            >
                                <option value="">None</option>
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                            </select>
                        </div>
                    </div>

                    {/* Due Date & Time Row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-white/50 px-1 flex items-center gap-1">
                                <CalendarIcon className="w-3.5 h-3.5" /> Due Date
                            </label>
                            <input
                                type="date"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-surface-100 border border-white/5 text-white focus:outline-none focus:border-accent-teal/50 focus:bg-surface-200 transition-all text-sm"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-white/50 px-1 flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" /> Time (Optional)
                            </label>
                            <input
                                type="time"
                                value={dueTime}
                                onChange={(e) => setDueTime(e.target.value)}
                                disabled={!dueDate}
                                className="w-full px-4 py-3 rounded-xl bg-surface-100 border border-white/5 text-white disabled:opacity-50 focus:outline-none focus:border-accent-teal/50 focus:bg-surface-200 transition-all text-sm"
                            />
                        </div>
                    </div>

                    {/* Tags */}
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-white/50 px-1 flex items-center gap-1">
                            <TagIcon className="w-3.5 h-3.5" /> Tags
                        </label>
                        <div className="p-2 min-h-[50px] rounded-xl bg-surface-100 border border-white/5 focus-within:border-accent-teal/50 focus-within:bg-surface-200 transition-all flex flex-wrap gap-2 items-center">
                            {tags.map((tag) => (
                                <span key={tag} className="flex items-center gap-1 bg-white/10 text-white/70 px-2 py-1 rounded-md text-xs">
                                    {tag}
                                    <button onClick={() => removeTag(tag)} className="hover:text-accent-rose">
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            ))}
                            <input
                                type="text"
                                value={tagsInput}
                                onChange={(e) => setTagsInput(e.target.value)}
                                onKeyDown={handleAddTag}
                                placeholder="Type and press Enter..."
                                className="flex-1 min-w-[120px] bg-transparent border-none text-white text-sm outline-none placeholder-white/20"
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-white/50 px-1">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Add more details..."
                            rows={3}
                            className="w-full px-4 py-3 rounded-xl bg-surface-100 border border-white/5 text-white placeholder-white/20 focus:outline-none focus:border-accent-teal/50 focus:bg-surface-200 transition-all text-sm resize-none"
                        />
                    </div>

                    {/* Subtasks */}
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-white/50 px-1 flex items-center gap-1">
                            <LayoutList className="w-3.5 h-3.5" /> Sub-tasks
                        </label>
                        <div className="space-y-2">
                            {subTasks.map((st) => (
                                <div key={st.id} className="flex items-center gap-2 group">
                                    <button
                                        onClick={() => toggleSubTask(st.id)}
                                        className={`text-white/30 hover:text-accent-teal ${st.status === 'done' ? 'text-accent-teal' : ''}`}
                                    >
                                        {st.status === 'done' ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                                    </button>
                                    <span className={`flex-1 text-sm ${st.status === 'done' ? 'line-through text-white/40' : 'text-white'}`}>
                                        {st.name}
                                    </span>
                                    <button
                                        onClick={() => removeSubTask(st.id)}
                                        className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-accent-rose p-1 transition-all"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            <div className="flex items-center gap-2 pt-1">
                                <Plus className="w-4 h-4 text-white/30" />
                                <input
                                    type="text"
                                    value={newSubTaskName}
                                    onChange={(e) => setNewSubTaskName(e.target.value)}
                                    onKeyDown={handleAddSubTask}
                                    placeholder="Add sub-task..."
                                    className="flex-1 bg-transparent border-none text-white text-sm outline-none placeholder-white/20"
                                />
                            </div>
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/5 flex items-center justify-between bg-surface-100/30 rounded-b-2xl">
                    {task ? (
                        <button
                            onClick={() => onDelete(task.id)}
                            className="p-2.5 rounded-xl text-accent-rose/70 hover:text-accent-rose hover:bg-accent-rose/10 transition-all"
                            title="Delete Task"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    ) : (
                        <div></div>
                    )}

                    <div className="flex items-center gap-2">
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!name.trim()}
                            className="px-5 py-2.5 rounded-xl text-sm font-bold bg-accent-teal text-surface-900 hover:bg-accent-teal/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-accent-teal/20"
                        >
                            Save Task
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default TaskModal;
