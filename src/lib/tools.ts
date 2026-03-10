// ================================================================
// LocalMind -- Tool Implementations
// All AI-callable tools for task, habit, journal, and reminder management
// ================================================================

import {
    ToolCall,
    ToolResult,
    ToolDefinition,
    TaskPriority,
    Task,
    Habit,
    Reminder,
} from "./types";
import * as db from "./db";

// ================================================================
// Tool Definitions (for system prompt)
// ================================================================

export const TOOL_DEFINITIONS: ToolDefinition[] = [
    // --- Tasks ---
    {
        name: "create_task",
        description: "Create a new task/todo item",
        parameters: {
            name: { type: "string", description: "Task name", required: true },
            priority: { type: "string", description: "Priority: low, medium, high, urgent. Default: medium" },
            description: { type: "string", description: "Optional task description" },
            due_date: { type: "string", description: "Optional due date (YYYY-MM-DD)" },
        },
    },
    {
        name: "complete_task",
        description: "Mark a task as done by name",
        parameters: {
            name: { type: "string", description: "Task name (partial match OK)", required: true },
        },
    },
    {
        name: "update_task",
        description: "Update a task's properties",
        parameters: {
            name: { type: "string", description: "Current task name to find (partial match OK)", required: true },
            new_name: { type: "string", description: "New name for the task" },
            priority: { type: "string", description: "New priority: low, medium, high, urgent" },
            due_date: { type: "string", description: "New due date (YYYY-MM-DD)" },
            description: { type: "string", description: "New description" },
            status: { type: "string", description: "New status: pending, in-progress, done, cancelled" },
        },
    },
    {
        name: "delete_task",
        description: "Delete a task by name",
        parameters: {
            name: { type: "string", description: "Task name to delete (partial match OK)", required: true },
        },
    },
    {
        name: "get_tasks",
        description: "List all tasks, optionally filtered by status",
        parameters: {
            status: { type: "string", description: "Filter by status: pending, in-progress, done, cancelled" },
        },
    },
    // --- Habits ---
    {
        name: "create_habit",
        description: "Create a new habit to track",
        parameters: {
            name: { type: "string", description: "Habit name", required: true },
            frequency: { type: "string", description: "Frequency: daily, weekly, monthly. Default: daily" },
            description: { type: "string", description: "Optional description" },
            category: { type: "string", description: "Optional category (health, productivity, learning, etc.)" },
            time_of_day: { type: "string", description: "Preferred time: morning, afternoon, evening, any" },
        },
    },
    {
        name: "log_habit",
        description: "Log a habit completion for today",
        parameters: {
            name: { type: "string", description: "Habit name (partial match OK)", required: true },
            status: { type: "string", description: "Status: done, skipped, missed. Default: done" },
            note: { type: "string", description: "Optional note about today's log" },
        },
    },
    {
        name: "delete_habit",
        description: "Delete a habit by name",
        parameters: {
            name: { type: "string", description: "Habit name to delete (partial match OK)", required: true },
        },
    },
    {
        name: "get_habits",
        description: "List all tracked habits with streaks",
        parameters: {},
    },
    // --- Journal ---
    {
        name: "write_journal",
        description: "Write a journal entry",
        parameters: {
            entry: { type: "string", description: "Journal entry text", required: true },
            mood: { type: "string", description: "Mood: great, good, okay, bad, terrible. Default: okay" },
            tags: { type: "string", description: "Comma-separated tags" },
        },
    },
    {
        name: "get_journal_entries",
        description: "List recent journal entries",
        parameters: {
            limit: { type: "number", description: "Number of entries to return. Default: 5" },
            mood: { type: "string", description: "Filter by mood: great, good, okay, bad, terrible" },
        },
    },
    // --- Reminders ---
    {
        name: "set_reminder",
        description: "Set a reminder for a specific time",
        parameters: {
            message: { type: "string", description: "Reminder message", required: true },
            time: { type: "string", description: "Time for reminder (ISO 8601 or natural like '2024-01-15T14:00:00')", required: true },
            repeat: { type: "string", description: "Repeat: none, daily, weekly, monthly. Default: none" },
        },
    },
    {
        name: "get_reminders",
        description: "List all reminders",
        parameters: {
            show_completed: { type: "boolean", description: "Include completed reminders. Default: false" },
        },
    },
    {
        name: "cancel_reminder",
        description: "Cancel/delete a reminder by message",
        parameters: {
            message: { type: "string", description: "Reminder message to find (partial match OK)", required: true },
        },
    },
    // --- Utility ---
    {
        name: "search_memory",
        description: "Search through past conversation summaries",
        parameters: {
            query: { type: "string", description: "Search query", required: true },
        },
    },
    {
        name: "get_current_date",
        description: "Get the current date and time",
        parameters: {},
    },
];

// ================================================================
// Format tool definitions for the system prompt
// ================================================================

export function getToolDefinitionsForPrompt(): string {
    return TOOL_DEFINITIONS.map((tool) => {
        const params = Object.entries(tool.parameters)
            .map(([key, val]) => {
                const req = val.required ? " (required)" : " (optional)";
                return `    - ${key}: ${val.type}${req} -- ${val.description}`;
            })
            .join("\n");
        return `${tool.name}: ${tool.description}${params ? "\n  Parameters:\n" + params : ""}`;
    }).join("\n\n");
}

// ================================================================
// Fuzzy name matching helper
// ================================================================

function fuzzyMatch<T extends { name: string; id: string }>(
    items: T[],
    query: string
): T | null {
    const q = query.toLowerCase().trim();
    if (!q) return null;

    // Exact match first
    const exact = items.find((item) => item.name.toLowerCase() === q);
    if (exact) return exact;

    // Starts with
    const startsWith = items.find((item) => item.name.toLowerCase().startsWith(q));
    if (startsWith) return startsWith;

    // Contains
    const contains = items.find((item) => item.name.toLowerCase().includes(q));
    if (contains) return contains;

    // Reverse contains (query contains item name)
    const reverseContains = items.find((item) => q.includes(item.name.toLowerCase()));
    if (reverseContains) return reverseContains;

    return null;
}

function fuzzyMatchReminder(reminders: Reminder[], query: string): Reminder | null {
    const q = query.toLowerCase().trim();
    if (!q) return null;
    const exact = reminders.find((r) => r.message.toLowerCase() === q);
    if (exact) return exact;
    const contains = reminders.find((r) => r.message.toLowerCase().includes(q));
    if (contains) return contains;
    const reverse = reminders.find((r) => q.includes(r.message.toLowerCase()));
    if (reverse) return reverse;
    return null;
}

// ================================================================
// Notification helper
// ================================================================

function scheduleNotification(reminder: Reminder): void {
    const timeUntil = new Date(reminder.time).getTime() - Date.now();
    if (timeUntil <= 0) return;

    setTimeout(() => {
        if (typeof window !== "undefined" && "Notification" in window) {
            if (Notification.permission === "granted") {
                new Notification("LocalMind Reminder", {
                    body: reminder.message,
                    icon: "/icons/icon-192.png",
                });
            }
        }
        // Mark as completed
        db.updateReminder(reminder.id, { completed: true });
    }, Math.min(timeUntil, 2147483647)); // Cap at max setTimeout value
}

/**
 * Restore all pending reminders on page load
 */
export async function restoreReminders(): Promise<void> {
    const reminders = await db.getAllReminders();
    for (const reminder of reminders) {
        if (!reminder.completed) {
            const timeUntil = new Date(reminder.time).getTime() - Date.now();
            if (timeUntil > 0) {
                scheduleNotification(reminder);
            } else {
                // Overdue -- mark completed and notify
                await db.updateReminder(reminder.id, { completed: true });
                if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
                    new Notification("LocalMind Reminder (overdue)", {
                        body: reminder.message,
                        icon: "/icons/icon-192.png",
                    });
                }
            }
        }
    }
}

// ================================================================
// Tool Execution
// ================================================================

export async function executeTool(toolCall: ToolCall): Promise<ToolResult> {
    const { name, args } = toolCall;

    try {
        switch (name) {
            // ========== Tasks ==========
            case "create_task": {
                const taskName = (args.name as string) || "";
                if (!taskName.trim()) {
                    return { success: false, message: "Task name is required." };
                }
                const priority = (args.priority as TaskPriority) || "medium";
                const task = await db.createTask(
                    taskName.trim(),
                    priority,
                    args.description as string,
                    args.due_date as string,
                    args.tags ? (args.tags as string).split(",").map((t: string) => t.trim()) : undefined
                );
                return {
                    success: true,
                    message: `Task created: "${task.name}" [${task.priority} priority]${task.dueDate ? " due " + task.dueDate : ""}`,
                    data: task,
                };
            }

            case "complete_task": {
                const searchName = (args.name as string) || "";
                if (!searchName.trim()) {
                    return { success: false, message: "Task name is required." };
                }
                const allTasks = await db.getAllTasks();
                const found = fuzzyMatch(allTasks, searchName);
                if (!found) {
                    return { success: false, message: `No task found matching "${searchName}".` };
                }
                await db.updateTask(found.id, { status: "done" });
                return {
                    success: true,
                    message: `Task completed: "${found.name}"`,
                    data: { ...found, status: "done" },
                };
            }

            case "update_task": {
                const searchName = (args.name as string) || "";
                if (!searchName.trim()) {
                    return { success: false, message: "Task name is required." };
                }
                const tasks = await db.getAllTasks();
                const taskToUpdate = fuzzyMatch(tasks, searchName);
                if (!taskToUpdate) {
                    return { success: false, message: `No task found matching "${searchName}".` };
                }
                const updates: Partial<Task> = {};
                if (args.new_name) updates.name = args.new_name as string;
                if (args.priority) updates.priority = args.priority as TaskPriority;
                if (args.due_date) updates.dueDate = args.due_date as string;
                if (args.description) updates.description = args.description as string;
                if (args.status) updates.status = args.status as Task["status"];
                const updated = await db.updateTask(taskToUpdate.id, updates);
                return {
                    success: true,
                    message: `Task updated: "${updated?.name || taskToUpdate.name}"`,
                    data: updated,
                };
            }

            case "delete_task": {
                const searchName = (args.name as string) || "";
                if (!searchName.trim()) {
                    return { success: false, message: "Task name is required." };
                }
                const tasks = await db.getAllTasks();
                const taskToDelete = fuzzyMatch(tasks, searchName);
                if (!taskToDelete) {
                    return { success: false, message: `No task found matching "${searchName}".` };
                }
                await db.deleteTask(taskToDelete.id);
                return {
                    success: true,
                    message: `Task deleted: "${taskToDelete.name}"`,
                };
            }

            case "get_tasks": {
                const tasks = await db.getAllTasks();
                const statusFilter = args.status as string;
                const filtered = statusFilter
                    ? tasks.filter((t) => t.status === statusFilter)
                    : tasks;

                if (filtered.length === 0) {
                    return {
                        success: true,
                        message: statusFilter
                            ? `No ${statusFilter} tasks found.`
                            : "No tasks yet. Create one by telling me what you need to do!",
                    };
                }

                const taskList = filtered
                    .map((t) => {
                        const due = t.dueDate ? ` (due: ${t.dueDate})` : "";
                        return `- [${t.status}] ${t.name} [${t.priority}]${due}`;
                    })
                    .join("\n");
                return {
                    success: true,
                    message: `Found ${filtered.length} task(s):\n${taskList}`,
                    data: filtered,
                };
            }

            // ========== Habits ==========
            case "create_habit": {
                const habitName = (args.name as string) || "";
                if (!habitName.trim()) {
                    return { success: false, message: "Habit name is required." };
                }
                const freq = (args.frequency as Habit["frequency"]) || "daily";
                const habit = await db.createHabit(
                    habitName.trim(),
                    freq,
                    args.description as string,
                    args.category as string,
                    args.time_of_day as Habit["timeOfDay"]
                );
                return {
                    success: true,
                    message: `Habit created: "${habit.name}" (${typeof habit.frequency === 'string' ? habit.frequency : 'custom'})`,
                    data: habit,
                };
            }

            case "log_habit": {
                const searchName = (args.name as string) || "";
                if (!searchName.trim()) {
                    return { success: false, message: "Habit name is required." };
                }
                const habits = await db.getAllHabits();
                const habitToLog = fuzzyMatch(habits, searchName);
                if (!habitToLog) {
                    return { success: false, message: `No habit found matching "${searchName}".` };
                }
                const logStatus = (args.status as "done" | "skipped" | "missed") || "done";
                const logged = await db.logHabit(habitToLog.id, logStatus, args.note as string);
                if (!logged) {
                    return { success: false, message: "Failed to log habit." };
                }
                const streakMsg = logged.streak > 0 ? ` Streak: ${logged.streak} day(s)!` : "";
                return {
                    success: true,
                    message: `Habit logged: "${logged.name}" -- ${logStatus}.${streakMsg}`,
                    data: logged,
                };
            }

            case "delete_habit": {
                const searchName = (args.name as string) || "";
                if (!searchName.trim()) {
                    return { success: false, message: "Habit name is required." };
                }
                const habits = await db.getAllHabits();
                const habitToDelete = fuzzyMatch(habits, searchName);
                if (!habitToDelete) {
                    return { success: false, message: `No habit found matching "${searchName}".` };
                }
                await db.deleteHabit(habitToDelete.id);
                return {
                    success: true,
                    message: `Habit deleted: "${habitToDelete.name}"`,
                };
            }

            case "get_habits": {
                const habits = await db.getAllHabits();
                if (habits.length === 0) {
                    return {
                        success: true,
                        message: "No habits tracked yet. Tell me a habit you'd like to build!",
                    };
                }
                const today = new Date().toISOString().split("T")[0];
                const habitList = habits
                    .map((h) => {
                        const todayLog = h.logs.find((l) => l.date === today);
                        const todayStatus = todayLog ? todayLog.status : "not logged";
                        const freq = typeof h.frequency === 'string' ? h.frequency : 'custom';
                        return `- ${h.name} (${freq}) -- Today: ${todayStatus}, Streak: ${h.streak}, Best: ${h.longestStreak}`;
                    })
                    .join("\n");
                return {
                    success: true,
                    message: `${habits.length} habit(s):\n${habitList}`,
                    data: habits,
                };
            }

            // ========== Journal ==========
            case "write_journal": {
                const entryText = (args.entry as string) || "";
                if (!entryText.trim()) {
                    return { success: false, message: "Journal entry text is required." };
                }
                const mood = (args.mood as "great" | "good" | "okay" | "bad" | "terrible") || "okay";
                const tags = args.tags
                    ? (args.tags as string).split(",").map((t: string) => t.trim())
                    : undefined;
                const entry = await db.createJournalEntry(entryText.trim(), mood, tags);
                return {
                    success: true,
                    message: `Journal entry saved. Mood: ${mood}.${tags ? " Tags: " + tags.join(", ") : ""}`,
                    data: entry,
                };
            }

            case "get_journal_entries": {
                const limit = (args.limit as number) || 5;
                const moodFilter = args.mood as string;
                let entries = await db.getAllJournalEntries();
                if (moodFilter) {
                    entries = entries.filter((e) => e.mood === moodFilter);
                }
                entries = entries.slice(0, limit);
                if (entries.length === 0) {
                    return {
                        success: true,
                        message: moodFilter
                            ? `No journal entries with mood "${moodFilter}".`
                            : "No journal entries yet. Share your thoughts and I'll save them!",
                    };
                }
                const entryList = entries
                    .map((e) => {
                        const date = new Date(e.createdAt).toLocaleDateString();
                        const preview = e.entry.length > 80 ? e.entry.substring(0, 80) + "..." : e.entry;
                        return `- [${date}] (${e.mood}) ${preview}`;
                    })
                    .join("\n");
                return {
                    success: true,
                    message: `${entries.length} journal entry/entries:\n${entryList}`,
                    data: entries,
                };
            }

            // ========== Reminders ==========
            case "set_reminder": {
                const message = (args.message as string) || "";
                const time = (args.time as string) || "";
                if (!message.trim() || !time.trim()) {
                    return { success: false, message: "Reminder message and time are required." };
                }
                const repeat = (args.repeat as Reminder["repeat"]) || "none";
                const reminder = await db.createReminder(message.trim(), time, repeat);
                scheduleNotification(reminder);

                const reminderTime = new Date(time);
                const timeStr = reminderTime.toLocaleString();
                return {
                    success: true,
                    message: `Reminder set: "${reminder.message}" at ${timeStr}${repeat !== "none" ? " (repeats " + repeat + ")" : ""}`,
                    data: reminder,
                };
            }

            case "get_reminders": {
                const showCompleted = args.show_completed as boolean || false;
                let reminders = await db.getAllReminders();
                if (!showCompleted) {
                    reminders = reminders.filter((r) => !r.completed);
                }
                if (reminders.length === 0) {
                    return {
                        success: true,
                        message: showCompleted
                            ? "No reminders found."
                            : "No active reminders. Tell me when you need to be reminded about something!",
                    };
                }
                const now = Date.now();
                const reminderList = reminders
                    .map((r) => {
                        const time = new Date(r.time);
                        const isPast = time.getTime() < now;
                        const status = r.completed ? "done" : isPast ? "OVERDUE" : "pending";
                        return `- [${status}] "${r.message}" at ${time.toLocaleString()}${r.repeat !== "none" ? " (repeats " + r.repeat + ")" : ""}`;
                    })
                    .join("\n");
                return {
                    success: true,
                    message: `${reminders.length} reminder(s):\n${reminderList}`,
                    data: reminders,
                };
            }

            case "cancel_reminder": {
                const searchMsg = (args.message as string) || "";
                if (!searchMsg.trim()) {
                    return { success: false, message: "Reminder message is required to find it." };
                }
                const reminders = await db.getAllReminders();
                const active = reminders.filter((r) => !r.completed);
                const found = fuzzyMatchReminder(active, searchMsg);
                if (!found) {
                    return { success: false, message: `No active reminder found matching "${searchMsg}".` };
                }
                await db.deleteReminder(found.id);
                return {
                    success: true,
                    message: `Reminder cancelled: "${found.message}"`,
                };
            }

            // ========== Utility ==========
            case "search_memory": {
                const query = (args.query as string) || "";
                if (!query.trim()) {
                    return { success: false, message: "Search query is required." };
                }
                const { searchMemory } = await import("./memory");
                const results = await searchMemory(query);
                if (results.length === 0) {
                    return {
                        success: true,
                        message: `No memories found for "${query}".`,
                    };
                }
                const memList = results
                    .slice(0, 5)
                    .map((r) => `- [${r.timestamp}] (relevance: ${Math.round(r.relevance * 100)}%) ${r.content}`)
                    .join("\n");
                return {
                    success: true,
                    message: `Found ${results.length} memory/memories:\n${memList}`,
                    data: results,
                };
            }

            case "get_current_date": {
                const now = new Date();
                return {
                    success: true,
                    message: `Current date and time: ${now.toLocaleDateString("en-US", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                    })} at ${now.toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                    })}`,
                };
            }

            default:
                return { success: false, message: `Unknown tool: ${name}` };
        }
    } catch (error) {
        console.error(`[Tools] Error executing ${name}:`, error);
        return {
            success: false,
            message: `Error executing ${name}: ${error instanceof Error ? error.message : "Unknown error"}`,
        };
    }
}
