"use client";

import React, { useState, useEffect } from "react";
import { Plus, Search, ListTodo, BrainCircuit } from "lucide-react";
import db from "@/lib/db";
import type { Task, TaskPriority } from "@/lib/types";

// We will implement these components next
import TaskList from "./TaskList";
import TaskModal from "./TaskModal";
import TaskAI from "./TaskAI";

import { Sidebar } from "../Sidebar";
import { Menu } from "lucide-react";

type ViewMode = "today" | "upcoming" | "all" | "completed" | "calendar";

interface TasksViewProps {
    onSelectView: (view: "chat" | "tasks") => void;
}

export function TasksView({ onSelectView }: TasksViewProps) {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [viewMode, setViewMode] = useState<ViewMode>("today");
    const [searchQuery, setSearchQuery] = useState("");
    const [filterPriority, setFilterPriority] = useState<TaskPriority | "ALL">("ALL");

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [isAIOpen, setIsAIOpen] = useState(false);
    const [showSidebar, setShowSidebar] = useState(false);

    // Initial load
    useEffect(() => {
        loadTasks();
    }, []);

    const loadTasks = async () => {
        const loadedTasks = await db.getAllTasks();
        setTasks(loadedTasks);
    };

    const handleSaveTask = async (task: Task) => {
        await db.saveTask(task);
        await loadTasks();
        setIsModalOpen(false);
        setEditingTask(null);
    };

    const handleDeleteTask = async (id: string) => {
        await db.deleteTask(id);
        await loadTasks();
    };

    const handleReorderTasks = async (reorderedTasks: Task[]) => {
        setTasks(reorderedTasks); // Optimistic UI update
        await db.saveTasks(reorderedTasks);
        await loadTasks(); // Re-sync to ensure consistency
    };

    const handleToggleTaskStatus = async (task: Task) => {
        const updatedTask: Task = {
            ...task,
            status: task.status === "done" ? "pending" : "done",
            updatedAt: new Date().toISOString()
        };
        await db.saveTask(updatedTask);
        await loadTasks();
    };

    // Derived states
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const filteredTasks = tasks.filter((task) => {
        // Search
        if (searchQuery && !task.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
            !(task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase()))) {
            return false;
        }

        // Priority Filter
        if (filterPriority !== "ALL" && task.priority !== filterPriority) {
            return false;
        }

        // View Mode Filter
        const taskDate = task.dueDate ? new Date(task.dueDate) : null;
        if (taskDate) taskDate.setHours(0, 0, 0, 0);

        if (viewMode === "completed") {
            return task.status === "done";
        }

        // Hide completed tasks in other views
        if (task.status === "done") return false;

        if (viewMode === "today") {
            // Include overdue and today
            return taskDate ? taskDate.getTime() <= today.getTime() : false;
        } else if (viewMode === "upcoming") {
            // Future tasks
            return taskDate ? taskDate.getTime() > today.getTime() : false;
        } else if (viewMode === "all") {
            return true;
        }

        return true;
    });

    const completionRate = tasks.length > 0
        ? Math.round((tasks.filter(t => t.status === "done").length / tasks.length) * 100)
        : 0;

    return (
        <div className="flex flex-col h-full bg-surface">
            {/* Header Area */}
            <div className="flex-shrink-0 px-6 py-5 bg-surface-100/50 border-b border-white/5 backdrop-blur-xl z-20">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setShowSidebar(true)}
                            className="p-2 -ml-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all"
                        >
                            <Menu className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                                <ListTodo className="w-6 h-6 text-accent-teal" />
                                Tasks
                            </h1>
                            <p className="text-sm text-white/40 mt-1">
                                {tasks.filter(t => t.status !== "done").length} active tasks • {completionRate}% completed
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setIsAIOpen(true)}
                            className="p-2.5 rounded-xl bg-gradient-to-r from-brand-500/20 to-accent-purple/20 text-brand-400 hover:text-white hover:bg-brand-500/40 transition-all shadow-lg shadow-brand-500/10 flex items-center gap-2"
                        >
                            <BrainCircuit className="w-5 h-5" />
                            <span className="text-sm font-semibold hidden sm:inline">AI Assistant</span>
                        </button>
                        <button
                            onClick={() => {
                                setEditingTask(null);
                                setIsModalOpen(true);
                            }}
                            className="p-2.5 rounded-xl bg-accent-teal text-surface-900 hover:bg-accent-teal/90 transition-all shadow-lg shadow-accent-teal/20 flex items-center gap-2"
                        >
                            <Plus className="w-5 h-5" />
                            <span className="text-sm font-bold hidden sm:inline">New Task</span>
                        </button>
                    </div>
                </div>

                {/* Toolbar: Search & Views */}
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                    <div className="flex bg-surface-200 p-1 rounded-xl w-full sm:w-auto overflow-x-auto no-scrollbar">
                        {(["today", "upcoming", "all", "completed", "calendar"] as ViewMode[]).map((mode) => (
                            <button
                                key={mode}
                                onClick={() => setViewMode(mode)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                                    viewMode === mode
                                    ? "bg-surface-300 text-white shadow-sm"
                                    : "text-white/50 hover:text-white hover:bg-surface-300/50"
                                }`}
                            >
                                {mode.charAt(0).toUpperCase() + mode.slice(1)}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="relative flex-1 sm:flex-none">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full sm:w-48 pl-9 pr-4 py-2 rounded-xl bg-surface-200 border border-white/5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-accent-teal/50 transition-all"
                            />
                        </div>

                        <select
                            value={filterPriority}
                            onChange={(e) => setFilterPriority(e.target.value as TaskPriority | "ALL")}
                            className="px-3 py-2 rounded-xl bg-surface-200 border border-white/5 text-sm text-white focus:outline-none focus:border-accent-teal/50 transition-all outline-none appearance-none"
                        >
                            <option value="ALL">All Prio</option>
                            <option value="P1">P1 (Urgent)</option>
                            <option value="P2">P2 (High)</option>
                            <option value="P3">P3 (Med)</option>
                            <option value="P4">P4 (Low)</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
                {viewMode === "calendar" ? (
                    <div className="flex flex-col gap-4">
                        <div className="grid grid-cols-7 gap-2">
                            {Array.from({ length: 7 }).map((_, i) => {
                                const dayDate = new Date();
                                // Set to start of week (Sunday)
                                dayDate.setDate(dayDate.getDate() - dayDate.getDay() + i);
                                dayDate.setHours(0, 0, 0, 0);

                                const dayTasks = tasks.filter(t => {
                                    if (!t.dueDate) return false;
                                    const d = new Date(t.dueDate);
                                    d.setHours(0, 0, 0, 0);
                                    return d.getTime() === dayDate.getTime();
                                });

                                const isToday = dayDate.getTime() === today.getTime();

                                return (
                                    <div key={i} className={`flex flex-col bg-surface-200 border ${isToday ? 'border-accent-teal/50' : 'border-white/5'} rounded-xl p-3 min-h-[150px]`}>
                                        <div className="text-center border-b border-white/10 pb-2 mb-2">
                                            <div className="text-xs text-white/40 font-medium uppercase tracking-wider">
                                                {dayDate.toLocaleDateString('en-US', { weekday: 'short' })}
                                            </div>
                                            <div className={`text-lg font-bold ${isToday ? 'text-accent-teal' : 'text-white'}`}>
                                                {dayDate.getDate()}
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-1.5 overflow-y-auto flex-1 no-scrollbar">
                                            {dayTasks.map(task => (
                                                <div
                                                    key={task.id}
                                                    onClick={() => {
                                                        setEditingTask(task);
                                                        setIsModalOpen(true);
                                                    }}
                                                    className={`text-xs px-2 py-1.5 rounded-md cursor-pointer truncate ${
                                                        task.status === 'done' ? 'bg-white/5 text-white/30 line-through' :
                                                        task.priority === 'P1' ? 'bg-accent-rose/20 text-accent-rose' :
                                                        task.priority === 'P2' ? 'bg-accent-amber/20 text-accent-amber' :
                                                        task.priority === 'P3' ? 'bg-brand-500/20 text-brand-400' :
                                                        'bg-surface-300 text-white/70'
                                                    }`}
                                                >
                                                    {task.name}
                                                </div>
                                            ))}
                                            {dayTasks.length === 0 && (
                                                <div className="text-white/20 text-[10px] text-center mt-2 italic">No tasks</div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <TaskList
                        tasks={filteredTasks}
                        onTaskClick={(task) => {
                            setEditingTask(task);
                            setIsModalOpen(true);
                        }}
                        onToggleStatus={handleToggleTaskStatus}
                        onReorder={handleReorderTasks}
                        viewMode={viewMode}
                    />
                )}
            </div>

            {/* Modals */}
            {isModalOpen && (
                <TaskModal
                    task={editingTask}
                    isOpen={isModalOpen}
                    onClose={() => {
                        setIsModalOpen(false);
                        setEditingTask(null);
                    }}
                    onSave={handleSaveTask}
                    onDelete={handleDeleteTask}
                />
            )}

            {isAIOpen && (
                <TaskAI
                    isOpen={isAIOpen}
                    onClose={() => setIsAIOpen(false)}
                    onTaskCreated={loadTasks}
                    tasks={tasks}
                />
            )}

            <Sidebar
                isOpen={showSidebar}
                onClose={() => setShowSidebar(false)}
                onSelectView={onSelectView}
            />
        </div>
    );
}

export default TasksView;
