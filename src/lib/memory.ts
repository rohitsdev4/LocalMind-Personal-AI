// ============================================================
// LocalMind — Memory Management System
// Handles long-term memory via IndexedDB summaries and
// sliding window context management
// ============================================================

import db from "./db";
import type { ChatMessage, MemorySearchResult } from "./types";

// ============================================================
// Context Window Management
// Keeps the last N messages + injects relevant memory
// ============================================================

/**
 * Implements sliding window context management.
 * When messages exceed the limit, older messages are summarized
 * and stored for future retrieval.
 */
export async function getContextWindow(
    allMessages: ChatMessage[],
    maxMessages: number = 12
): Promise<ChatMessage[]> {
    // System messages always stay in context
    const systemMessages = allMessages.filter((m) => m.role === "system");
    const nonSystemMessages = allMessages.filter((m) => m.role !== "system");

    if (nonSystemMessages.length <= maxMessages) {
        return allMessages;
    }

    // Take the most recent messages for the active context
    const recentMessages = nonSystemMessages.slice(-maxMessages);

    // Messages that fell out of the window get summarized
    const oldMessages = nonSystemMessages.slice(0, -maxMessages);

    // Only summarize if there are enough old messages worth summarizing
    if (oldMessages.length >= 4) {
        const summary = createSummaryFromMessages(oldMessages);
        const summaryId = `summary_${Date.now()}`;
        await db.saveMemorySummary(summaryId, summary);
    }

    return [...systemMessages, ...recentMessages];
}

/**
 * Creates a condensed text summary from a batch of messages.
 * This is a simple extractive approach — we keep the key info.
 */
function createSummaryFromMessages(messages: ChatMessage[]): string {
    const lines: string[] = [];
    const date = messages[0]?.timestamp
        ? new Date(messages[0].timestamp).toLocaleDateString()
        : "Unknown date";

    lines.push(`[Conversation Summary — ${date}]`);

    for (const msg of messages) {
        if (msg.role === "user") {
            // Keep user messages concise
            const truncated =
                msg.content.length > 120
                    ? msg.content.slice(0, 120) + "..."
                    : msg.content;
            lines.push(`User: ${truncated}`);
        } else if (msg.role === "assistant" && !msg.toolName) {
            const truncated =
                msg.content.length > 150
                    ? msg.content.slice(0, 150) + "..."
                    : msg.content;
            lines.push(`AI: ${truncated}`);
        } else if (msg.role === "tool" && msg.toolName) {
            lines.push(`Tool [${msg.toolName}]: executed`);
        }
    }

    return lines.join("\n");
}

// ============================================================
// Memory Search (search_memory tool implementation)
// Searches across all data stores for relevant context
// ============================================================

/**
 * Searches IndexedDB across chats, tasks, habits, and journal
 * for content matching the query. Uses simple keyword matching
 * with relevance scoring.
 */
export async function searchMemory(
    query: string
): Promise<MemorySearchResult[]> {
    const results: MemorySearchResult[] = [];
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 2);

    // Search chat summaries
    const summaries = await db.getAllMemorySummaries();
    for (const s of summaries) {
        const score = calculateRelevance(s.summary, queryWords);
        if (score > 0) {
            results.push({
                content: s.summary,
                timestamp: s.timestamp,
                relevanceScore: score,
                source: "chat",
            });
        }
    }

    // Search tasks
    const tasks = await db.getAllTasks();
    for (const task of tasks) {
        const text = `${task.name} ${task.description || ""} ${task.tags?.join(" ") || ""}`;
        const score = calculateRelevance(text, queryWords);
        if (score > 0) {
            results.push({
                content: `Task: "${task.name}" — Status: ${task.status}, Priority: ${task.priority}${task.dueDate ? `, Due: ${task.dueDate}` : ""}`,
                timestamp: task.createdAt,
                relevanceScore: score,
                source: "task",
            });
        }
    }

    // Search habits
    const habits = await db.getAllHabits();
    for (const habit of habits) {
        const text = `${habit.name} ${habit.description || ""}`;
        const score = calculateRelevance(text, queryWords);
        if (score > 0) {
            results.push({
                content: `Habit: "${habit.name}" — Streak: ${habit.streak} days, Frequency: ${habit.frequency}`,
                timestamp: habit.createdAt,
                relevanceScore: score,
                source: "habit",
            });
        }
    }

    // Search journal entries
    const journals = await db.getAllJournalEntries();
    for (const entry of journals) {
        const text = `${entry.entry} ${entry.mood} ${entry.tags?.join(" ") || ""}`;
        const score = calculateRelevance(text, queryWords);
        if (score > 0) {
            results.push({
                content: `Journal (${entry.mood}): ${entry.entry.slice(0, 200)}`,
                timestamp: entry.createdAt,
                relevanceScore: score,
                source: "journal",
            });
        }
    }

    // Also search recent chat messages
    const chatSessions = await db.getAllChatSessions();
    for (const session of chatSessions.slice(0, 5)) {
        // Search last 5 sessions
        for (const msg of session.messages) {
            if (msg.role === "user" || msg.role === "assistant") {
                const score = calculateRelevance(msg.content, queryWords);
                if (score > 0.3) {
                    results.push({
                        content: `[${msg.role}]: ${msg.content.slice(0, 200)}`,
                        timestamp: msg.timestamp,
                        relevanceScore: score,
                        source: "chat",
                    });
                }
            }
        }
    }

    // Sort by relevance and return top results
    return results.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 10);
}

/**
 * Simple keyword-based relevance scoring.
 * Returns a score between 0 and 1.
 */
function calculateRelevance(text: string, queryWords: string[]): number {
    if (!text || queryWords.length === 0) return 0;

    const textLower = text.toLowerCase();
    let matchCount = 0;
    let totalWeight = 0;

    for (const word of queryWords) {
        const occurrences = (textLower.match(new RegExp(word, "g")) || []).length;
        if (occurrences > 0) {
            // Weight by word length (longer words = more specific)
            const weight = Math.min(word.length / 8, 1);
            matchCount += weight * Math.min(occurrences, 3);
        }
        totalWeight += Math.min(word.length / 8, 1);
    }

    if (totalWeight === 0) return 0;
    return Math.min(matchCount / totalWeight, 1);
}

/**
 * Loads the most recent memory summaries for system prompt injection.
 * This gives the AI "awareness" of past conversations at startup.
 * Modified to also include the active tasks, habits, and recent journals.
 */
export async function getRecentMemoryContext(
    count: number = 5
): Promise<string> {
    const summaries = await db.getAllMemorySummaries();
    const recent = summaries.slice(0, count);

    // Also inject state of active features (Cross-module AI context)
    const pendingTasks = (await db.getAllTasks()).filter(t => t.status !== "done").slice(0, 3);
    const activeHabits = (await db.getAllHabits()).slice(0, 3);
    const recentJournals = (await db.getAllJournalEntries()).slice(0, 2);

    let contextBlock = "";

    if (recent.length > 0) {
        const memoryBlock = recent.map((s) => s.summary).join("\n---\n");
        contextBlock += `[LONG-TERM MEMORY — Recent Conversations]\n${memoryBlock}\n`;
    }

    if (pendingTasks.length > 0) {
        const tasksStr = pendingTasks.map(t => `- [${t.priority}] ${t.name} (Due: ${t.dueDate || 'none'})`).join('\n');
        contextBlock += `\n[ACTIVE TASKS]\n${tasksStr}\n`;
    }

    if (activeHabits.length > 0) {
        const habitsStr = activeHabits.map(h => `- ${h.name} (${h.streak} day streak)`).join('\n');
        contextBlock += `\n[ACTIVE HABITS]\n${habitsStr}\n`;
    }

    if (recentJournals.length > 0) {
        const journalsStr = recentJournals.map(j => `- [Mood: ${j.mood}] ${j.entry.slice(0, 100)}...`).join('\n');
        contextBlock += `\n[RECENT JOURNALS]\n${journalsStr}\n`;
    }

    if (!contextBlock) {
        return "";
    }

    return `\n\n${contextBlock}[END CONTEXT]`;
}
