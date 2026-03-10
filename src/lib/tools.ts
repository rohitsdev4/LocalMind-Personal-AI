// ============================================================
// LocalMind — Tool Implementations
// Actual functions that execute when the AI calls a tool
// ============================================================

import { v4 as uuidv4 } from "uuid";
import db from "./db";
import { searchMemory } from "./memory";
import type {
    ToolCall,
    ToolResult,
    ToolDefinition,
    Task,
    TaskPriority,
    Habit,
    JournalEntry,
    Mood,
    Reminder,
} from "./types";

// ============================================================
// Tool Definitions (for the system prompt)
// ============================================================

export const TOOL_DEFINITIONS: ToolDefinition[] = [
    {
        name: "create_task",
        description:
            "Creates a new task and saves it. Use when the user asks you to add, create, or remember a task.",
        parameters: {
            name: { type: "string", description: "The task name/title", required: true },
            due_date: {
                type: "string",
                description: "Due date in ISO format (YYYY-MM-DD). Optional.",
            },
            priority: {
                type: "string",
                description: "Priority level: low, medium, high, or urgent. Defaults to medium.",
            },
        },
    },
    {
        name: "log_habit",
        description:
            "Logs a habit completion or updates its status. Use when the user mentions doing, skipping, or pausing a habit.",
        parameters: {
            name: { type: "string", description: "The habit name", required: true },
            status: {
                type: "string",
                description: "Status: done, skipped, missed, or paused",
                required: true,
            },
            note: {
                type: "string",
                description: "Optional note or observation about the habit.",
            },
        },
    },
    {
        name: "create_habit",
        description: "Creates a new habit to track. Use when the user explicitly asks to start tracking a new habit.",
        parameters: {
            name: { type: "string", description: "The habit name", required: true },
            category: { type: "string", description: "Category: Health, Learning, Productivity, Mindfulness, or Other." },
            timeOfDay: { type: "string", description: "Time to do it: morning, afternoon, evening, or any." },
            frequencyType: { type: "string", description: "Frequency: daily, weekly, monthly, or x_per_week." },
            frequencyTimes: { type: "string", description: "If x_per_week, how many times." },
        },
    },
    {
        name: "write_journal",
        description:
            "Saves a journal entry. Use when the user wants to write down thoughts or reflect.",
        parameters: {
            entry: {
                type: "string",
                description: "The journal entry text",
                required: true,
            },
            mood: {
                type: "string",
                description: "Mood: great, good, okay, bad, or terrible",
                required: true,
            },
        },
    },
    {
        name: "search_memory",
        description:
            "Searches past conversations, tasks, habits, and journal entries. Use when the user asks about something from the past.",
        parameters: {
            query: {
                type: "string",
                description: "Search query to find relevant past context",
                required: true,
            },
        },
    },
    {
        name: "set_reminder",
        description:
            "Sets a browser notification reminder. Use when the user asks to be reminded about something.",
        parameters: {
            message: {
                type: "string",
                description: "The reminder message",
                required: true,
            },
            time: {
                type: "string",
                description:
                    "When to trigger the reminder. Either a duration like '30m', '2h' or an ISO datetime string.",
                required: true,
            },
        },
    },
    {
        name: "get_current_date",
        description:
            "Returns the current date and time. Use when you need to know today's date or the current time.",
        parameters: {},
    },
    {
        name: "get_tasks",
        description:
            "Returns a list of all your current tasks. Use when the user asks what tasks they have, or asks you to list their tasks.",
        parameters: {},
    },
    {
        name: "get_habits",
        description:
            "Returns a list of all your habits and their streaks. Use when the user asks what habits they are tracking.",
        parameters: {},
    },
];

// ============================================================
// Tool Executor — Routes tool calls to implementations
// ============================================================

export async function executeTool(toolCall: ToolCall): Promise<ToolResult> {
    try {
        switch (toolCall.name) {
            case "create_task":
                return await executeCreateTask(toolCall.args);
            case "log_habit":
                return await executeLogHabit(toolCall.args);
            case "create_habit":
                return await executeCreateHabit(toolCall.args);
            case "write_journal":
                return await executeWriteJournal(toolCall.args);
            case "search_memory":
                return await executeSearchMemory(toolCall.args);
            case "set_reminder":
                return await executeSetReminder(toolCall.args);
            case "get_current_date":
                return executeGetCurrentDate();
            case "get_tasks":
                return await executeGetTasks();
            case "get_habits":
                return await executeGetHabits();
            default:
                return {
                    success: false,
                    error: `Unknown tool: ${toolCall.name}`,
                    displayMessage: `⚠️ Unknown tool "${toolCall.name}"`,
                };
        }
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        return {
            success: false,
            error: errMsg,
            displayMessage: `❌ Error executing ${toolCall.name}: ${errMsg}`,
        };
    }
}

// ============================================================
// Individual Tool Implementations
// ============================================================

async function executeCreateTask(
    args: Record<string, unknown>
): Promise<ToolResult> {
    const name = String(args.name || args.title || "Untitled Task");
    const dueDate = args.due_date ? String(args.due_date) : undefined;
    const priority = validatePriority(String(args.priority || "medium"));

    const task: Task = {
        id: uuidv4(),
        name,
        priority,
        status: "pending",
        dueDate: dueDate || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    await db.saveTask(task);

    return {
        success: true,
        data: task,
        displayMessage: `✅ Task created: "${name}" (${priority} priority)${dueDate ? ` — Due: ${dueDate}` : ""}`,
    };
}

async function executeCreateHabit(
    args: Record<string, unknown>
): Promise<ToolResult> {
    const name = String(args.name || "Untitled Habit");
    const category = String(args.category || "Health");
    const timeOfDay = validateTimeOfDay(String(args.timeOfDay || "any"));
    const frequencyType = validateFrequencyType(String(args.frequencyType || "daily"));
    const frequencyTimes = parseInt(String(args.frequencyTimes || "3"), 10);

    let frequency: "daily" | "weekly" | "monthly" | { type: "x_per_week", times: number } = frequencyType as "daily" | "weekly" | "monthly";
    if (frequencyType === "x_per_week") {
        frequency = { type: "x_per_week", times: isNaN(frequencyTimes) ? 3 : frequencyTimes };
    }

    const habit: Habit = {
        id: uuidv4(),
        name,
        category,
        timeOfDay,
        frequency,
        logs: [],
        streak: 0,
        longestStreak: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    await db.saveHabit(habit);

    return {
        success: true,
        data: habit,
        displayMessage: `✅ Created habit: "${name}" (${category}, ${timeOfDay})`,
    };
}

async function executeLogHabit(
    args: Record<string, unknown>
): Promise<ToolResult> {
    const name = String(args.name || "Unnamed Habit");
    const status = validateHabitStatus(String(args.status || "done"));
    const note = args.note ? String(args.note) : undefined;

    // Check if habit already exists
    const allHabits = await db.getAllHabits();
    let habit = allHabits.find(
        (h) => h.name.toLowerCase() === name.toLowerCase()
    );

    const today = new Date().toISOString().split("T")[0];

    if (habit) {
        // Update existing habit
        const logIndex = habit.logs.findIndex((l) => l.date === today);
        let newStreak = habit.streak;

        if (logIndex >= 0) {
            const oldStatus = habit.logs[logIndex].status;
            habit.logs[logIndex] = { date: today, status, note };

            if (oldStatus !== "done" && status === "done") {
                newStreak += 1;
            } else if (oldStatus === "done" && status !== "done") {
                newStreak = Math.max(0, newStreak - 1);
            }
        } else {
            habit.logs.push({ date: today, status, note });
            if (status === "done") {
                newStreak += 1;
            } else if (status === "skipped" || status === "missed") {
                newStreak = 0;
            }
        }

        habit.streak = newStreak;
        if (newStreak > (habit.longestStreak || 0)) {
            habit.longestStreak = newStreak;
        }

        habit.updatedAt = new Date().toISOString();
    } else {
        // Create new habit if it doesn't exist
        habit = {
            id: uuidv4(),
            name,
            category: "Other",
            timeOfDay: "any",
            frequency: "daily",
            logs: [{ date: today, status, note }],
            streak: status === "done" ? 1 : 0,
            longestStreak: status === "done" ? 1 : 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
    }

    await db.saveHabit(habit);

    const emoji = status === "done" ? "🔥" : status === "skipped" ? "⏭️" : status === "paused" ? "⏸️" : "❌";
    return {
        success: true,
        data: habit,
        displayMessage: `${emoji} Habit "${name}" — ${status} (${habit.streak} day streak)${note ? `\n📝 Note: ${note}` : ""}`,
    };
}

async function executeWriteJournal(
    args: Record<string, unknown>
): Promise<ToolResult> {
    const entry = String(args.entry || args.text || "");
    const mood = validateMood(String(args.mood || "okay"));

    if (!entry.trim()) {
        return {
            success: false,
            error: "Journal entry cannot be empty",
            displayMessage: "⚠️ Cannot save an empty journal entry.",
        };
    }

    const journalEntry: JournalEntry = {
        id: uuidv4(),
        entry,
        mood,
        createdAt: new Date().toISOString(),
    };

    await db.saveJournalEntry(journalEntry);

    const moodEmoji: Record<Mood, string> = {
        great: "😄",
        good: "🙂",
        okay: "😐",
        bad: "😟",
        terrible: "😢",
    };

    return {
        success: true,
        data: journalEntry,
        displayMessage: `📝 Journal entry saved ${moodEmoji[mood]} (${mood})`,
    };
}

async function executeSearchMemory(
    args: Record<string, unknown>
): Promise<ToolResult> {
    const query = String(args.query || "");

    if (!query.trim()) {
        return {
            success: false,
            error: "Search query cannot be empty",
            displayMessage: "⚠️ Please provide a search query.",
        };
    }

    const results = await searchMemory(query);

    if (results.length === 0) {
        return {
            success: true,
            data: [],
            displayMessage: `🔍 No memories found for "${query}"`,
        };
    }

    // Format results for the AI to read
    const formattedResults = results
        .map(
            (r, i) =>
                `${i + 1}. [${r.source.toUpperCase()}] (${new Date(r.timestamp).toLocaleDateString()}) ${r.content}`
        )
        .join("\n");

    return {
        success: true,
        data: results,
        displayMessage: `🔍 Found ${results.length} relevant memories:\n${formattedResults}`,
    };
}

async function executeSetReminder(
    args: Record<string, unknown>
): Promise<ToolResult> {
    const message = String(args.message || "Reminder");
    const timeStr = String(args.time || "30m");

    // Parse the time
    let triggerTime: Date;

    // Check if it's a duration string (e.g., "30m", "2h")
    const durationMatch = timeStr.match(/^(\d+)\s*(m|min|h|hr|hour|s|sec)$/i);
    if (durationMatch) {
        const amount = parseInt(durationMatch[1]);
        const unit = durationMatch[2].toLowerCase();
        const now = new Date();

        if (unit.startsWith("h")) {
            triggerTime = new Date(now.getTime() + amount * 60 * 60 * 1000);
        } else if (unit.startsWith("m")) {
            triggerTime = new Date(now.getTime() + amount * 60 * 1000);
        } else {
            triggerTime = new Date(now.getTime() + amount * 1000);
        }
    } else {
        // Try to parse as ISO date
        triggerTime = new Date(timeStr);
        if (isNaN(triggerTime.getTime())) {
            // Default to 30 minutes from now
            triggerTime = new Date(Date.now() + 30 * 60 * 1000);
        }
    }

    const reminder: Reminder = {
        id: uuidv4(),
        message,
        triggerTime: triggerTime.toISOString(),
        fired: false,
        createdAt: new Date().toISOString(),
    };

    await db.saveReminder(reminder);

    // Schedule the browser notification
    scheduleNotification(reminder);

    const timeUntil = Math.round(
        (triggerTime.getTime() - Date.now()) / 60000
    );

    return {
        success: true,
        data: reminder,
        displayMessage: `⏰ Reminder set: "${message}" — in ~${timeUntil} minutes`,
    };
}

function executeGetCurrentDate(): ToolResult {
    const now = new Date();
    const formatted = now.toLocaleString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
    });

    return {
        success: true,
        data: { iso: now.toISOString(), formatted },
        displayMessage: `📅 Current date & time: ${formatted}`,
    };
}

async function executeGetTasks(): Promise<ToolResult> {
    const tasks = await db.getAllTasks();
    if (tasks.length === 0) {
        return {
            success: true,
            data: [],
            displayMessage: `📝 You have no tasks.`,
        };
    }

    const formattedTasks = tasks.map((t, i) => `${i + 1}. [${t.status}] ${t.name} (Priority: ${t.priority})`).join("\n");
    return {
        success: true,
        data: tasks,
        displayMessage: `📝 Here are your tasks:\n${formattedTasks}`,
    };
}

async function executeGetHabits(): Promise<ToolResult> {
    const habits = await db.getAllHabits();
    if (habits.length === 0) {
        return {
            success: true,
            data: [],
            displayMessage: `🔥 You have no habits tracking.`,
        };
    }

    const formattedHabits = habits.map((h, i) => `${i + 1}. ${h.name} (Streak: ${h.streak} days, Frequency: ${h.frequency})`).join("\n");
    return {
        success: true,
        data: habits,
        displayMessage: `🔥 Here are your habits:\n${formattedHabits}`,
    };
}

// ============================================================
// Helpers
// ============================================================

function validatePriority(priority: string): TaskPriority {
    const valid: TaskPriority[] = ["low", "medium", "high", "urgent"];
    const p = priority.toLowerCase() as TaskPriority;
    return valid.includes(p) ? p : "medium";
}

function validateHabitStatus(status: string): "done" | "skipped" | "missed" | "paused" {
    const valid = ["done", "skipped", "missed", "paused"] as const;
    const s = status.toLowerCase() as (typeof valid)[number];
    return valid.includes(s) ? s : "done";
}

function validateTimeOfDay(time: string): "morning" | "afternoon" | "evening" | "any" {
    const valid = ["morning", "afternoon", "evening", "any"] as const;
    const t = time.toLowerCase() as (typeof valid)[number];
    return valid.includes(t) ? t : "any";
}

function validateFrequencyType(type: string): "daily" | "weekly" | "monthly" | "x_per_week" {
    const valid = ["daily", "weekly", "monthly", "x_per_week"] as const;
    const t = type.toLowerCase() as (typeof valid)[number];
    return valid.includes(t) ? t : "daily";
}

function validateMood(mood: string): Mood {
    const valid: Mood[] = ["great", "good", "okay", "bad", "terrible"];
    const m = mood.toLowerCase() as Mood;
    return valid.includes(m) ? m : "okay";
}

/**
 * Schedules a browser notification using the Notification API.
 * Falls back gracefully if permissions aren't granted.
 */
function scheduleNotification(reminder: Reminder): void {
    if (typeof window === "undefined") return;

    const delay = new Date(reminder.triggerTime).getTime() - Date.now();
    if (delay <= 0) return;

    // Request permission if needed
    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }

    setTimeout(() => {
        if ("Notification" in window && Notification.permission === "granted") {
            new Notification("🧠 LocalMind Reminder", {
                body: reminder.message,
                icon: "/icons/icon-192.png",
                badge: "/icons/icon-192.png",
                tag: reminder.id,
            });
        }

        // Mark as fired in DB
        reminder.fired = true;
        db.saveReminder(reminder);
    }, delay);
}

/**
 * Generates COMPACT tool definitions for the system prompt.
 * Shorter = less prefill = faster first token.
 */
export function getToolDefinitionsForPrompt(): string {
    return [
        "- create_task(name, due_date?, priority?): Create a task",
        "- log_habit(name, status, note?): Log habit status (done/skipped/missed/paused)",
        "- create_habit(name, category?, timeOfDay?, frequencyType?, frequencyTimes?): Create a habit to track",
        "- write_journal(entry, mood): Save journal entry with mood",
        "- search_memory(query): Search past tasks/chats/habits/journal",
        "- set_reminder(message, time): Set browser notification (e.g. '30m', '2h')",
        "- get_current_date(): Get current date and time",
        "- get_tasks(): List all tasks",
        "- get_habits(): List all habits",
    ].join("\n");
}
