// ============================================================
// LocalMind — Database Layer (localforage / IndexedDB)
// Persistent, offline-first storage for all app data
// ============================================================

import localforage from "localforage";
import type {
    ChatSession,
    Task,
    Habit,
    JournalEntry,
    UserSettings,
    Reminder,
    ID,
} from "./types";

// ============================================================
// Store Initialization
// Each data type gets its own IndexedDB store for isolation
// ============================================================

const chatStore = localforage.createInstance({
    name: "localmind",
    storeName: "chats",
    description: "Chat sessions and message history",
});

const taskStore = localforage.createInstance({
    name: "localmind",
    storeName: "tasks",
    description: "Task management",
});

const habitStore = localforage.createInstance({
    name: "localmind",
    storeName: "habits",
    description: "Habit tracking",
});

const journalStore = localforage.createInstance({
    name: "localmind",
    storeName: "journal",
    description: "Journal entries",
});

const settingsStore = localforage.createInstance({
    name: "localmind",
    storeName: "settings",
    description: "User preferences",
});

const reminderStore = localforage.createInstance({
    name: "localmind",
    storeName: "reminders",
    description: "Scheduled reminders",
});

const memoryStore = localforage.createInstance({
    name: "localmind",
    storeName: "memory",
    description: "Conversation summaries for long-term memory",
});

// ============================================================
// Default Settings
// ============================================================

const DEFAULT_SETTINGS: UserSettings = {
    selectedModel: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    theme: "dark",
    notificationsEnabled: true,
    maxContextMessages: 8,
};

// ============================================================
// Chat Operations
// ============================================================

export const db = {
    // --- Chats ---
    async getChatSession(id: ID): Promise<ChatSession | null> {
        return chatStore.getItem<ChatSession>(id);
    },

    async saveChatSession(session: ChatSession): Promise<void> {
        await chatStore.setItem(session.id, session);
    },

    async getAllChatSessions(): Promise<ChatSession[]> {
        const sessions: ChatSession[] = [];
        await chatStore.iterate<ChatSession, void>((value) => {
            sessions.push(value);
        });
        return sessions.sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
    },

    async deleteChatSession(id: ID): Promise<void> {
        await chatStore.removeItem(id);
    },

    async clearAllChats(): Promise<void> {
        await chatStore.clear();
    },

    // --- Tasks ---
    async getTask(id: ID): Promise<Task | null> {
        return taskStore.getItem<Task>(id);
    },

    async saveTask(task: Task): Promise<void> {
        await taskStore.setItem(task.id, task);
    },

    async getAllTasks(): Promise<Task[]> {
        const tasks: Task[] = [];
        await taskStore.iterate<Task, void>((value) => {
            tasks.push(value);
        });
        return tasks.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    },

    async deleteTask(id: ID): Promise<void> {
        await taskStore.removeItem(id);
    },

    // --- Habits ---
    async getHabit(id: ID): Promise<Habit | null> {
        return habitStore.getItem<Habit>(id);
    },

    async saveHabit(habit: Habit): Promise<void> {
        await habitStore.setItem(habit.id, habit);
    },

    async getAllHabits(): Promise<Habit[]> {
        const habits: Habit[] = [];
        await habitStore.iterate<Habit, void>((value) => {
            habits.push(value);
        });
        return habits;
    },

    async deleteHabit(id: ID): Promise<void> {
        await habitStore.removeItem(id);
    },

    // --- Journal ---
    async saveJournalEntry(entry: JournalEntry): Promise<void> {
        await journalStore.setItem(entry.id, entry);
    },

    async getAllJournalEntries(): Promise<JournalEntry[]> {
        const entries: JournalEntry[] = [];
        await journalStore.iterate<JournalEntry, void>((value) => {
            entries.push(value);
        });
        return entries.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    },

    async deleteJournalEntry(id: ID): Promise<void> {
        await journalStore.removeItem(id);
    },

    // --- Reminders ---
    async saveReminder(reminder: Reminder): Promise<void> {
        await reminderStore.setItem(reminder.id, reminder);
    },

    async getAllReminders(): Promise<Reminder[]> {
        const reminders: Reminder[] = [];
        await reminderStore.iterate<Reminder, void>((value) => {
            reminders.push(value);
        });
        return reminders;
    },

    async deleteReminder(id: ID): Promise<void> {
        await reminderStore.removeItem(id);
    },

    // --- Settings ---
    async getSettings(): Promise<UserSettings> {
        const settings = await settingsStore.getItem<UserSettings>("user_settings");
        return settings || DEFAULT_SETTINGS;
    },

    async saveSettings(settings: UserSettings): Promise<void> {
        await settingsStore.setItem("user_settings", settings);
    },

    // --- Memory (Long-Term Summaries) ---
    async saveMemorySummary(id: ID, summary: string): Promise<void> {
        await memoryStore.setItem(id, {
            summary,
            timestamp: new Date().toISOString(),
        });
    },

    async getAllMemorySummaries(): Promise<{ summary: string; timestamp: string }[]> {
        const summaries: { summary: string; timestamp: string }[] = [];
        await memoryStore.iterate<{ summary: string; timestamp: string }, void>((value) => {
            summaries.push(value);
        });
        return summaries.sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
    },

    async clearMemory(): Promise<void> {
        await memoryStore.clear();
    },

    // --- Storage Info ---
    async getStorageUsage(): Promise<{
        chats: number;
        tasks: number;
        habits: number;
        journal: number;
        reminders: number;
        memory: number;
    }> {
        const countStore = async (store: LocalForage): Promise<number> => {
            return store.length();
        };

        return {
            chats: await countStore(chatStore),
            tasks: await countStore(taskStore),
            habits: await countStore(habitStore),
            journal: await countStore(journalStore),
            reminders: await countStore(reminderStore),
            memory: await countStore(memoryStore),
        };
    },

    // --- Nuclear Option ---
    async clearAllData(): Promise<void> {
        await Promise.all([
            chatStore.clear(),
            taskStore.clear(),
            habitStore.clear(),
            journalStore.clear(),
            settingsStore.clear(),
            reminderStore.clear(),
            memoryStore.clear(),
        ]);
    },
};

export default db;
