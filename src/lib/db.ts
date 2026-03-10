// ================================================================
// LocalMind -- Database Layer (IndexedDB via localforage)
// All persistent storage operations
// ================================================================

import localforage from "localforage";
import { v4 as uuidv4 } from "uuid";
import {
    ChatSession,
    ChatMessage,
    Task,
    TaskPriority,
    TaskStatus,
    Habit,
    HabitLog,
    JournalEntry,
    Mood,
    UserSettings,
    Reminder,
} from "./types";

// ================================================================
// Store Initialization
// ================================================================

const chatStore = localforage.createInstance({ name: "localmind", storeName: "chats" });
const taskStore = localforage.createInstance({ name: "localmind", storeName: "tasks" });
const habitStore = localforage.createInstance({ name: "localmind", storeName: "habits" });
const journalStore = localforage.createInstance({ name: "localmind", storeName: "journal" });
const settingsStore = localforage.createInstance({ name: "localmind", storeName: "settings" });
const reminderStore = localforage.createInstance({ name: "localmind", storeName: "reminders" });
const memoryStore = localforage.createInstance({ name: "localmind", storeName: "memory" });

// ================================================================
// Default Settings
// ================================================================

const DEFAULT_SETTINGS: UserSettings = {
    selectedModel: "meta-llama/llama-3.3-70b-instruct:free",
    theme: "dark",
    notificationsEnabled: true,
    maxContextMessages: 50,
    openRouterApiKey: "",
};

// ================================================================
// Settings
// ================================================================

export async function getSettings(): Promise<UserSettings> {
    const stored = await settingsStore.getItem<UserSettings>("user_settings");
    return { ...DEFAULT_SETTINGS, ...stored };
}

export async function updateSettings(partial: Partial<UserSettings>): Promise<UserSettings> {
    const current = await getSettings();
    const updated = { ...current, ...partial };
    await settingsStore.setItem("user_settings", updated);
    return updated;
}

// ================================================================
// Chat Sessions
// ================================================================

export async function getChatSession(id: string = "current_session"): Promise<ChatSession> {
    const session = await chatStore.getItem<ChatSession>(id);
    if (session) return session;
    const newSession: ChatSession = {
        id,
        title: "New Chat",
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        summaries: [],
    };
    await chatStore.setItem(id, newSession);
    return newSession;
}

export async function saveChatSession(session: ChatSession): Promise<void> {
    session.updatedAt = new Date().toISOString();
    await chatStore.setItem(session.id, session);
}

export async function clearChatSession(id: string = "current_session"): Promise<void> {
    await chatStore.removeItem(id);
}

// ================================================================
// Tasks
// ================================================================

export async function getAllTasks(): Promise<Task[]> {
    const tasks: Task[] = [];
    await taskStore.iterate<Task, void>((value) => {
        tasks.push(value);
    });
    return tasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function createTask(
    name: string,
    priority: TaskPriority = "medium",
    description?: string,
    dueDate?: string,
    tags?: string[]
): Promise<Task> {
    const task: Task = {
        id: uuidv4(),
        name,
        description,
        dueDate,
        priority,
        status: "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags,
    };
    await taskStore.setItem(task.id, task);
    return task;
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<Task | null> {
    const task = await taskStore.getItem<Task>(id);
    if (!task) return null;
    const updated = { ...task, ...updates, updatedAt: new Date().toISOString() };
    await taskStore.setItem(id, updated);
    return updated;
}

export async function deleteTask(id: string): Promise<boolean> {
    const task = await taskStore.getItem<Task>(id);
    if (!task) return false;
    await taskStore.removeItem(id);
    return true;
}

// ================================================================
// Habits
// ================================================================

export async function getAllHabits(): Promise<Habit[]> {
    const habits: Habit[] = [];
    await habitStore.iterate<Habit, void>((value) => {
        habits.push(value);
    });
    return habits.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function createHabit(
    name: string,
    frequency: Habit["frequency"] = "daily",
    description?: string,
    category?: string,
    timeOfDay?: Habit["timeOfDay"]
): Promise<Habit> {
    const habit: Habit = {
        id: uuidv4(),
        name,
        description,
        category,
        timeOfDay,
        frequency,
        logs: [],
        streak: 0,
        longestStreak: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    await habitStore.setItem(habit.id, habit);
    return habit;
}

export async function logHabit(
    id: string,
    status: HabitLog["status"] = "done",
    note?: string
): Promise<Habit | null> {
    const habit = await habitStore.getItem<Habit>(id);
    if (!habit) return null;

    const today = new Date().toISOString().split("T")[0];
    // Remove existing log for today if any
    habit.logs = habit.logs.filter((l) => l.date !== today);
    habit.logs.push({ date: today, status, note });

    // Recalculate streak with gap detection
    habit.streak = calculateStreak(habit.logs);
    if (habit.streak > habit.longestStreak) {
        habit.longestStreak = habit.streak;
    }

    habit.updatedAt = new Date().toISOString();
    await habitStore.setItem(id, habit);
    return habit;
}

function calculateStreak(logs: HabitLog[]): number {
    const doneLogs = logs
        .filter((l) => l.status === "done")
        .map((l) => l.date)
        .sort()
        .reverse();

    if (doneLogs.length === 0) return 0;

    const today = new Date().toISOString().split("T")[0];
    // Streak must include today or yesterday
    const lastLog = doneLogs[0];
    const daysSinceLastLog = Math.floor(
        (new Date(today).getTime() - new Date(lastLog).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceLastLog > 1) return 0;

    let streak = 1;
    for (let i = 1; i < doneLogs.length; i++) {
        const current = new Date(doneLogs[i - 1]).getTime();
        const previous = new Date(doneLogs[i]).getTime();
        const diffDays = Math.floor((current - previous) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
            streak++;
        } else {
            break;
        }
    }
    return streak;
}

export async function updateHabit(id: string, updates: Partial<Habit>): Promise<Habit | null> {
    const habit = await habitStore.getItem<Habit>(id);
    if (!habit) return null;
    const updated = { ...habit, ...updates, updatedAt: new Date().toISOString() };
    await habitStore.setItem(id, updated);
    return updated;
}

export async function deleteHabit(id: string): Promise<boolean> {
    const habit = await habitStore.getItem<Habit>(id);
    if (!habit) return false;
    await habitStore.removeItem(id);
    return true;
}

// ================================================================
// Journal
// ================================================================

export async function getAllJournalEntries(): Promise<JournalEntry[]> {
    const entries: JournalEntry[] = [];
    await journalStore.iterate<JournalEntry, void>((value) => {
        entries.push(value);
    });
    return entries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function createJournalEntry(
    entry: string,
    mood: Mood = "okay",
    tags?: string[]
): Promise<JournalEntry> {
    const journalEntry: JournalEntry = {
        id: uuidv4(),
        entry,
        mood,
        tags,
        createdAt: new Date().toISOString(),
    };
    await journalStore.setItem(journalEntry.id, journalEntry);
    return journalEntry;
}

export async function deleteJournalEntry(id: string): Promise<boolean> {
    const entry = await journalStore.getItem<JournalEntry>(id);
    if (!entry) return false;
    await journalStore.removeItem(id);
    return true;
}

// ================================================================
// Reminders
// ================================================================

export async function getAllReminders(): Promise<Reminder[]> {
    const reminders: Reminder[] = [];
    await reminderStore.iterate<Reminder, void>((value) => {
        reminders.push(value);
    });
    return reminders.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
}

export async function createReminder(
    message: string,
    time: string,
    repeat: Reminder["repeat"] = "none"
): Promise<Reminder> {
    const reminder: Reminder = {
        id: uuidv4(),
        message,
        time,
        repeat,
        completed: false,
        createdAt: new Date().toISOString(),
    };
    await reminderStore.setItem(reminder.id, reminder);
    return reminder;
}

export async function updateReminder(id: string, updates: Partial<Reminder>): Promise<Reminder | null> {
    const reminder = await reminderStore.getItem<Reminder>(id);
    if (!reminder) return null;
    const updated = { ...reminder, ...updates };
    await reminderStore.setItem(id, updated);
    return updated;
}

export async function deleteReminder(id: string): Promise<boolean> {
    const reminder = await reminderStore.getItem<Reminder>(id);
    if (!reminder) return false;
    await reminderStore.removeItem(id);
    return true;
}

// ================================================================
// Memory (for AI context summaries)
// ================================================================

export async function getMemorySummaries(): Promise<string[]> {
    const summaries = await memoryStore.getItem<string[]>("summaries");
    return summaries || [];
}

export async function saveMemorySummary(summary: string): Promise<void> {
    const summaries = await getMemorySummaries();
    summaries.push(summary);
    // Keep last 50 summaries
    if (summaries.length > 50) {
        summaries.splice(0, summaries.length - 50);
    }
    await memoryStore.setItem("summaries", summaries);
}

export async function clearMemorySummaries(): Promise<void> {
    await memoryStore.setItem("summaries", []);
}

// ================================================================
// Storage Usage
// ================================================================

export async function getStorageUsage(): Promise<{
    tasks: number;
    habits: number;
    journal: number;
    reminders: number;
    chats: number;
    memory: number;
}> {
    let tasks = 0, habits = 0, journal = 0, reminders = 0, chats = 0, memory = 0;
    await taskStore.iterate(() => { tasks++; });
    await habitStore.iterate(() => { habits++; });
    await journalStore.iterate(() => { journal++; });
    await reminderStore.iterate(() => { reminders++; });
    await chatStore.iterate(() => { chats++; });
    const summaries = await getMemorySummaries();
    memory = summaries.length;
    return { tasks, habits, journal, reminders, chats, memory };
}

// ================================================================
// Clear All Data
// ================================================================

export async function clearAllData(): Promise<void> {
    await chatStore.clear();
    await taskStore.clear();
    await habitStore.clear();
    await journalStore.clear();
    await settingsStore.clear();
    await reminderStore.clear();
    await memoryStore.clear();
}
