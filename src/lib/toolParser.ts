// ================================================================
// LocalMind -- Tool Call Parser
// Extracts tool calls from AI-generated text
// ================================================================

import { ToolCall } from "./types";

/** All valid tool names the AI can invoke */
const VALID_TOOLS = new Set([
    "create_task",
    "complete_task",
    "update_task",
    "delete_task",
    "get_tasks",
    "create_habit",
    "log_habit",
    "delete_habit",
    "get_habits",
    "write_journal",
    "get_journal_entries",
    "search_memory",
    "set_reminder",
    "get_reminders",
    "cancel_reminder",
    "get_current_date",
]);

interface ParseResult {
    toolCalls: ToolCall[];
    cleanText: string;
    hasToolCalls: boolean;
}

/**
 * Validate a parsed tool call
 */
function validateToolCall(name: string, args: Record<string, unknown>): ToolCall | null {
    if (!name || typeof name !== "string") return null;
    const trimmed = name.trim().toLowerCase();
    if (!VALID_TOOLS.has(trimmed)) {
        console.warn(`[ToolParser] Unknown tool: ${trimmed}`);
        return null;
    }
    return { name: trimmed, args: args || {} };
}

/**
 * Try to fix common JSON issues in tool call arguments
 */
function tryFixJSON(jsonStr: string): string {
    let fixed = jsonStr.trim();
    // Remove trailing commas before } or ]
    fixed = fixed.replace(/,\s*([}\]])/g, "$1");
    // Fix single quotes to double quotes
    fixed = fixed.replace(/'/g, '"');
    // Fix unquoted keys
    fixed = fixed.replace(/(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
    return fixed;
}

/**
 * Parse tool calls from AI output text.
 * Looks for <tool_call>{...}</tool_call> patterns.
 */
export function parseToolCalls(text: string): ParseResult {
    const toolCalls: ToolCall[] = [];
    let cleanText = text;

    // Primary pattern: <tool_call>{"name": "...", "args": {...}}</tool_call>
    const toolCallRegex = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/gi;
    let match;

    while ((match = toolCallRegex.exec(text)) !== null) {
        const jsonStr = match[1].trim();
        try {
            let parsed = JSON.parse(jsonStr);
            // Handle nested tool_call objects
            if (parsed.tool_call) parsed = parsed.tool_call;

            const name = parsed.name || parsed.tool || parsed.function;
            const args = parsed.args || parsed.arguments || parsed.parameters || {};

            const validated = validateToolCall(name, args);
            if (validated) {
                toolCalls.push(validated);
                cleanText = cleanText.replace(match[0], "");
            }
        } catch {
            // Try to fix JSON
            try {
                const fixed = tryFixJSON(jsonStr);
                const parsed = JSON.parse(fixed);
                const name = parsed.name || parsed.tool || parsed.function;
                const args = parsed.args || parsed.arguments || parsed.parameters || {};

                const validated = validateToolCall(name, args);
                if (validated) {
                    toolCalls.push(validated);
                    cleanText = cleanText.replace(match[0], "");
                }
            } catch {
                console.warn("[ToolParser] Failed to parse tool call JSON:", jsonStr);
            }
        }
    }

    // Fallback: look for ```json code blocks with tool calls
    if (toolCalls.length === 0) {
        const codeBlockRegex = /```(?:json)?\s*\n?\s*({[\s\S]*?})\s*\n?\s*```/gi;
        while ((match = codeBlockRegex.exec(text)) !== null) {
            try {
                const parsed = JSON.parse(match[1]);
                if (parsed.name && VALID_TOOLS.has(parsed.name.trim().toLowerCase())) {
                    const validated = validateToolCall(parsed.name, parsed.args || {});
                    if (validated) {
                        toolCalls.push(validated);
                        cleanText = cleanText.replace(match[0], "");
                    }
                }
            } catch {
                // Not a tool call code block
            }
        }
    }

    // Clean up extra whitespace
    cleanText = cleanText.replace(/\n{3,}/g, "\n\n").trim();

    return {
        toolCalls,
        cleanText,
        hasToolCalls: toolCalls.length > 0,
    };
}

/**
 * Detect if text looks like a failed/malformed tool call attempt
 */
export function looksLikeFailedToolCall(text: string): boolean {
    const allToolNames = Array.from(VALID_TOOLS).join("|");
    const patterns = [
        new RegExp(`\\b(${allToolNames})\\s*\\(`, "i"),
        new RegExp(`\\b(${allToolNames})\\s*\\{`, "i"),
        /tool_call[^>]/i,
        /<tool[^_]/i,
        /\{\s*"name"\s*:\s*"\w+".*"args"/i,
    ];

    return patterns.some((p) => p.test(text));
}
