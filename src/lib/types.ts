// ============================================================
// LocalMind — TypeScript Type Definitions
// All data models for the application
// ============================================================

/** Unique identifier type */
export type ID = string;

/** Timestamp in ISO 8601 format */
export type Timestamp = string;

// ============================================================
// Chat & Messages
// ============================================================

export type MessageRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
    id: ID;
    role: MessageRole;
    content: string;
    timestamp: Timestamp;
    /** If role is 'tool', which tool was called */
    toolName?: string;
    /** Parsed tool call result */
    toolResult?: unknown;
    /** Whether this message is a summary of older messages */
    isSummary?: boolean;
}

export interface ChatSession {
    id: ID;
    title: string;
    messages: ChatMessage[];
    createdAt: Timestamp;
    updatedAt: Timestamp;
    /** Condensed summaries of older messages for memory */
    summaries: string[];
}

// ============================================================
// Tasks
// ============================================================

export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "pending" | "in-progress" | "done" | "cancelled";

export interface Task {
    id: ID;
    name: string;
    description?: string;
    dueDate?: Timestamp;
    priority: TaskPriority;
    status: TaskStatus;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    tags?: string[];
}

// ============================================================
// Habits
// ============================================================

export interface HabitLog {
    date: string; // YYYY-MM-DD
    status: "done" | "skipped" | "missed";
    note?: string;
}

export interface Habit {
    id: ID;
    name: string;
    description?: string;
    frequency: "daily" | "weekly" | "monthly";
    logs: HabitLog[];
    streak: number;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

// ============================================================
// Journal
// ============================================================

export type Mood = "great" | "good" | "okay" | "bad" | "terrible";

export interface JournalEntry {
    id: ID;
    entry: string;
    mood: Mood;
    tags?: string[];
    createdAt: Timestamp;
}

// ============================================================
// User Settings
// ============================================================

export interface UserSettings {
    selectedModel: string;
    theme: "dark" | "light";
    notificationsEnabled: boolean;
    maxContextMessages: number;
    installedAt?: Timestamp;
    openRouterApiKey?: string;
}

// ============================================================
// Reminders
// ============================================================

export interface Reminder {
    id: ID;
    message: string;
    triggerTime: Timestamp;
    fired: boolean;
    createdAt: Timestamp;
}

// ============================================================
// AI Engine Types
// ============================================================

export type EngineStatus =
    | "idle"
    | "downloading"
    | "loading"
    | "ready"
    | "generating"
    | "error";

// ============================================================
// Tool System Types
// ============================================================

export interface ToolCall {
    name: string;
    args: Record<string, unknown>;
}

export interface ToolDefinition {
    name: string;
    description: string;
    parameters: Record<string, { type: string; description: string; required?: boolean }>;
}

export interface ToolResult {
    success: boolean;
    data?: unknown;
    error?: string;
    displayMessage: string;
}

// ============================================================
// Memory Types
// ============================================================

export interface MemorySearchResult {
    content: string;
    timestamp: Timestamp;
    relevanceScore: number;
    source: "chat" | "task" | "habit" | "journal";
}
