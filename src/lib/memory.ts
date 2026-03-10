// ================================================================
// LocalMind -- Memory Management
// Context window management and conversation summarization
// ================================================================

import { ChatMessage, MemorySearchResult } from "./types";
import * as db from "./db";

// ================================================================
// Context Window Management
// ================================================================

/**
 * Get a windowed slice of messages for API context.
 * If messages exceed the limit, older ones are summarized and stored.
 */
export async function getContextWindow(
    messages: ChatMessage[],
    maxMessages: number = 50
): Promise<ChatMessage[]> {
    if (messages.length <= maxMessages) {
        return messages;
    }

    // Summarize older messages
    const cutoff = messages.length - maxMessages;
    const olderMessages = messages.slice(0, cutoff);
    const recentMessages = messages.slice(cutoff);

    // Create summary of older messages
    const summary = summarizeMessages(olderMessages);
    if (summary) {
        await db.saveMemorySummary(summary);
    }

    return recentMessages;
}

/**
 * Summarize a batch of messages into a condensed memory string.
 * Extracts key information from user-assistant pairs.
 */
function summarizeMessages(messages: ChatMessage[]): string {
    if (messages.length === 0) return "";

    const pairs: string[] = [];
    let i = 0;

    while (i < messages.length) {
        const msg = messages[i];

        if (msg.role === "user") {
            const userContent = msg.content.substring(0, 200).trim();
            // Look for the next assistant response
            let assistantContent = "";
            let toolActions: string[] = [];

            for (let j = i + 1; j < messages.length; j++) {
                const next = messages[j];
                if (next.role === "assistant") {
                    assistantContent = next.content.substring(0, 200).trim();
                    i = j + 1;
                    break;
                } else if (next.role === "tool" && next.toolName) {
                    const result = next.toolResult as { success?: boolean; message?: string } | undefined;
                    const preview = result?.message?.substring(0, 80) || next.content.substring(0, 80);
                    toolActions.push(`Used ${next.toolName}: ${preview}`);
                } else if (next.role === "user") {
                    // Next user message without assistant response
                    i = j;
                    break;
                }
                if (j === messages.length - 1) {
                    i = messages.length;
                }
            }

            let pairSummary = `User: ${userContent}`;
            if (toolActions.length > 0) {
                pairSummary += ` | Actions: ${toolActions.join("; ")}`;
            }
            if (assistantContent) {
                pairSummary += ` | AI: ${assistantContent}`;
            }
            pairs.push(pairSummary);
        } else {
            i++;
        }
    }

    if (pairs.length === 0) return "";

    const timestamp = new Date().toISOString();
    return `[Summary ${timestamp}] ${pairs.join(" || ")}`;
}

// ================================================================
// Add messages to long-term memory
// ================================================================

/**
 * Check if conversation is getting long and auto-summarize older parts.
 * Called after each AI response.
 */
export async function addToMemory(messages: ChatMessage[]): Promise<void> {
    // Only summarize if we have enough messages
    if (messages.length < 10) return;

    // Check if we should create a summary checkpoint
    const session = await db.getChatSession();
    const existingSummaries = session.summaries || [];
    const lastSummaryCount = existingSummaries.length;

    // Create a new summary every 20 messages
    const summaryInterval = 20;
    const expectedSummaries = Math.floor(messages.length / summaryInterval);

    if (expectedSummaries > lastSummaryCount) {
        const startIdx = lastSummaryCount * summaryInterval;
        const endIdx = expectedSummaries * summaryInterval;
        const toSummarize = messages.slice(startIdx, endIdx);

        const summary = summarizeMessages(toSummarize);
        if (summary) {
            await db.saveMemorySummary(summary);
            session.summaries = [...existingSummaries, summary];
            await db.saveChatSession(session);
        }
    }
}

// ================================================================
// Memory Search
// ================================================================

/**
 * Search through stored memory summaries by keyword matching.
 */
export async function searchMemory(query: string): Promise<MemorySearchResult[]> {
    const summaries = await db.getMemorySummaries();
    if (summaries.length === 0) return [];

    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    if (queryWords.length === 0) return [];

    const results: MemorySearchResult[] = [];

    for (const summary of summaries) {
        const lowerSummary = summary.toLowerCase();
        let matchCount = 0;

        for (const word of queryWords) {
            if (lowerSummary.includes(word)) {
                matchCount++;
            }
        }

        if (matchCount > 0) {
            const relevance = matchCount / queryWords.length;
            // Extract timestamp from summary if present
            const timestampMatch = summary.match(/\[Summary ([^\]]+)\]/);
            const timestamp = timestampMatch ? timestampMatch[1] : "unknown";

            results.push({
                content: summary,
                timestamp,
                relevance,
            });
        }
    }

    // Sort by relevance (highest first)
    results.sort((a, b) => b.relevance - a.relevance);

    return results;
}

// ================================================================
// Recent Memory Context (for system prompt)
// ================================================================

/**
 * Get recent memory summaries to include in the system prompt.
 */
export async function getRecentMemoryContext(count: number = 3): Promise<string> {
    const summaries = await db.getMemorySummaries();
    if (summaries.length === 0) return "";

    const recent = summaries.slice(-count);
    return `\n\nRECENT MEMORY (previous conversations):\n${recent.join("\n")}`;
}
