"use client";

import React, { useState } from "react";
import { X, BrainCircuit, Loader2, ArrowRight, Wand2, CalendarClock, SplitSquareHorizontal } from "lucide-react";
import db from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import type { Task, TaskPriority } from "@/lib/types";

interface TaskAIProps {
    isOpen: boolean;
    onClose: () => void;
    onTaskCreated: () => void;
    tasks: Task[]; // Need existing tasks for context (e.g., prioritization)
}

export function TaskAI({ isOpen, onClose, onTaskCreated, tasks }: TaskAIProps) {
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<string | null>(null);

    if (!isOpen) return null;

    const getAiSuggestion = async (prompt: string) => {
        const settings = await db.getSettings();
        if (!settings.openRouterApiKey) {
            throw new Error("OpenRouter API key is missing. Please add it in Settings.");
        }

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${settings.openRouterApiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: settings.selectedModel || "meta-llama/llama-3.3-70b-instruct:free",
                messages: [{ role: "user", content: prompt }]
            }),
        });

        if (!response.ok) throw new Error("API request failed");

        const data = await response.json();
        return data.choices[0].message.content.trim();
    };

    const parseNaturalLanguageTask = async () => {
        if (!input.trim()) return;
        setIsLoading(true);
        setError(null);
        setResult(null);

        try {
            const settings = await db.getSettings();
            if (!settings.openRouterApiKey) {
                throw new Error("OpenRouter API key is missing. Please add it in Settings.");
            }

            const prompt = `
            You are a smart GTD task parser. Today's date is ${new Date().toISOString()}.
            Parse the following user request into a JSON task object.

            Return ONLY a raw JSON object with no markdown formatting or explanation.
            Format:
            {
                "name": "string",
                "description": "string or null",
                "priority": "P1" | "P2" | "P3" | "P4", (default P3)
                "dueDate": "ISO 8601 string or null",
                "tags": ["string"] or []
            }

            User request: "${input}"
            `;

            const textContent = await getAiSuggestion(prompt);

            // Try to extract JSON if the model added markdown blocks
            const jsonMatch = textContent.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error("Could not parse AI response as JSON");

            const parsedData = JSON.parse(jsonMatch[0]);

            const newTask: Task = {
                id: uuidv4(),
                name: parsedData.name || "Untitled Task",
                description: parsedData.description || undefined,
                priority: ["P1", "P2", "P3", "P4"].includes(parsedData.priority) ? parsedData.priority : "P3",
                status: "pending",
                dueDate: parsedData.dueDate || undefined,
                tags: parsedData.tags || [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            await db.saveTask(newTask);
            setResult(`Task created: ${newTask.name}`);
            onTaskCreated();
            setInput("");

        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setIsLoading(false);
        }
    };

    const suggestSchedule = async () => {
        setIsLoading(true);
        setError(null);
        setResult(null);

        try {
            const unscheduledTasks = tasks.filter(t => t.status !== "done" && !t.dueDate).map(t => ({ id: t.id, name: t.name, priority: t.priority }));

            if (unscheduledTasks.length === 0) {
                setResult("All pending tasks are already scheduled.");
                return;
            }

            const prompt = `
            You are a smart GTD productivity assistant. Today's date is ${new Date().toISOString()}.
            Analyze the following list of unscheduled tasks and suggest a due date for each based on its priority and name.
            Return ONLY a JSON object mapping task IDs to suggested ISO 8601 date strings.

            Format:
            {
                "task-id-1": "2024-05-20T10:00:00.000Z",
                "task-id-2": "2024-05-21T14:00:00.000Z"
            }

            Tasks:
            ${JSON.stringify(unscheduledTasks, null, 2)}
            `;

            const textContent = await getAiSuggestion(prompt);

            const jsonMatch = textContent.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error("Could not parse AI response as JSON");

            const scheduleMap = JSON.parse(jsonMatch[0]);

            // Apply updates
            const updatedTasks = tasks.map(t => {
                if (scheduleMap[t.id]) {
                    return { ...t, dueDate: scheduleMap[t.id] };
                }
                return t;
            });

            await db.saveTasks(updatedTasks);
            setResult(`Successfully scheduled ${Object.keys(scheduleMap).length} tasks.`);
            onTaskCreated(); // triggers reload

        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to schedule tasks.");
        } finally {
            setIsLoading(false);
        }
    };

    const suggestBreakdown = async () => {
        setIsLoading(true);
        setError(null);
        setResult(null);

        try {
            // Find a task that is "complex" (e.g., has no subtasks, but maybe is P1/P2 or long name)
            // Or just allow user to pick one. For this simple AI assistant, let's break down the most urgent task that lacks subtasks.
            const candidates = tasks.filter(t => t.status !== "done" && (!t.subTasks || t.subTasks.length === 0));

            if (candidates.length === 0) {
                setResult("No suitable tasks found to break down.");
                return;
            }

            // Pick the highest priority one
            candidates.sort((a, b) => a.priority.localeCompare(b.priority));
            const targetTask = candidates[0];

            const prompt = `
            You are a smart GTD productivity assistant. Break down the following task into 3-5 actionable subtasks.
            Return ONLY a JSON array of string names for the subtasks.

            Format:
            [
                "Research topic",
                "Draft outline",
                "Write first draft"
            ]

            Task to break down: "${targetTask.name}"
            Description (if any): "${targetTask.description || ''}"
            `;

            const textContent = await getAiSuggestion(prompt);

            const jsonMatch = textContent.match(/\[[\s\S]*\]/);
            if (!jsonMatch) throw new Error("Could not parse AI response as JSON Array");

            const subTaskNames: string[] = JSON.parse(jsonMatch[0]);

            const updatedTask = {
                ...targetTask,
                subTasks: subTaskNames.map(name => ({
                    id: uuidv4(),
                    name,
                    status: "pending" as const
                }))
            };

            await db.saveTask(updatedTask);
            setResult(`Broke down "${targetTask.name}" into ${subTaskNames.length} subtasks.`);
            onTaskCreated(); // triggers reload

        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to break down task.");
        } finally {
            setIsLoading(false);
        }
    };

    const suggestPriorities = async () => {
        setIsLoading(true);
        setError(null);
        setResult(null);

        try {
            const pendingTasks = tasks.filter(t => t.status !== "done").map(t => ({ id: t.id, name: t.name, currentPriority: t.priority }));

            if (pendingTasks.length === 0) {
                setResult("No pending tasks to prioritize.");
                return;
            }

            const prompt = `
            You are a smart GTD productivity assistant. Analyze the following list of pending tasks and suggest the optimal P1, P2, P3, P4 priority levels for each.
            Focus on urgency and importance. Return ONLY a JSON object mapping task IDs to suggested priorities.

            Format:
            {
                "task-id-1": "P1",
                "task-id-2": "P3"
            }

            Tasks:
            ${JSON.stringify(pendingTasks, null, 2)}
            `;

            const textContent = await getAiSuggestion(prompt);

            const jsonMatch = textContent.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error("Could not parse AI response as JSON");

            const priorityMap = JSON.parse(jsonMatch[0]);

            // Apply updates
            const updatedTasks = tasks.map(t => {
                if (priorityMap[t.id] && ["P1", "P2", "P3", "P4"].includes(priorityMap[t.id])) {
                    return { ...t, priority: priorityMap[t.id] as TaskPriority };
                }
                return t;
            });

            await db.saveTasks(updatedTasks);
            setResult(`Successfully re-prioritized ${Object.keys(priorityMap).length} tasks.`);
            onTaskCreated(); // triggers reload

        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to prioritize tasks.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-lg bg-surface border border-brand-500/20 rounded-2xl shadow-2xl shadow-brand-500/10 flex flex-col animate-fade-in overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-500 via-accent-purple to-brand-500" />

                <div className="flex items-center justify-between p-4 border-b border-white/5">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <BrainCircuit className="w-5 h-5 text-brand-400" />
                        Task AI Assistant
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    <p className="text-sm text-white/60">
                        Ask the AI to create tasks naturally, suggest priorities, schedule, or break down large projects.
                    </p>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pb-2">
                        <button
                            onClick={suggestPriorities}
                            disabled={isLoading}
                            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-surface-200 hover:bg-surface-300 text-white/80 hover:text-white transition-colors border border-white/5 disabled:opacity-50"
                        >
                            <Wand2 className="w-4 h-4 text-accent-amber" />
                            <span className="text-sm font-medium">Prioritize</span>
                        </button>

                        <button
                            onClick={suggestSchedule}
                            disabled={isLoading}
                            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-surface-200 hover:bg-surface-300 text-white/80 hover:text-white transition-colors border border-white/5 disabled:opacity-50"
                        >
                            <CalendarClock className="w-4 h-4 text-accent-teal" />
                            <span className="text-sm font-medium">Schedule</span>
                        </button>

                        <button
                            onClick={suggestBreakdown}
                            disabled={isLoading}
                            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-surface-200 hover:bg-surface-300 text-white/80 hover:text-white transition-colors border border-white/5 disabled:opacity-50"
                        >
                            <SplitSquareHorizontal className="w-4 h-4 text-brand-400" />
                            <span className="text-sm font-medium">Breakdown</span>
                        </button>
                    </div>

                    {/* Parser Action */}
                    <div className="space-y-2 pt-2 border-t border-white/10">
                        <label className="text-xs text-white/40 px-1">Quick Add</label>
                        <div className="relative flex items-center">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && parseNaturalLanguageTask()}
                                placeholder='e.g., "Buy groceries tomorrow at 5pm Priority P2"'
                                className="w-full pl-4 pr-12 py-3 rounded-xl bg-surface-100 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-brand-500/50 transition-all"
                            />
                            <button
                                onClick={parseNaturalLanguageTask}
                                disabled={isLoading || !input.trim()}
                                className="absolute right-2 p-2 rounded-lg bg-brand-500 text-white disabled:opacity-50 hover:bg-brand-600 transition-colors"
                            >
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {/* Error / Result Feedback */}
                    {error && <div className="p-3 rounded-xl bg-accent-rose/10 border border-accent-rose/20 text-accent-rose text-sm">{error}</div>}
                    {result && <div className="p-3 rounded-xl bg-accent-teal/10 border border-accent-teal/20 text-accent-teal text-sm">{result}</div>}
                </div>
            </div>
        </div>
    );
}

export default TaskAI;
