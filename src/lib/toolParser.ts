// ============================================================
// LocalMind — Tool Call Parser
// Extracts structured tool calls from AI text output
// ============================================================
//
// The AI is instructed to wrap tool calls in <tool_call> tags:
//   <tool_call>{"name": "create_task", "args": {...}}</tool_call>
//
// This parser handles:
//   - Clean JSON extraction
//   - Multiple tool calls in one response
//   - Malformed JSON recovery
//   - Validation of tool names and arguments
// ============================================================

import type { ToolCall } from "./types";

/** Valid tool names the system recognizes */
const VALID_TOOLS = new Set([
    "create_task",
    "log_habit",
    "write_journal",
    "search_memory",
    "set_reminder",
    "get_current_date",
]);

/**
 * Primary parser: extracts tool calls from AI output text.
 * Returns an array of parsed tool calls and the cleaned text
 * (with tool call tags removed).
 */
export function parseToolCalls(text: string): {
    toolCalls: ToolCall[];
    cleanText: string;
    hasToolCalls: boolean;
} {
    const toolCalls: ToolCall[] = [];

    // Primary regex: match <tool_call>...</tool_call> blocks
    // Using dotAll (s) flag to match across newlines
    const toolCallRegex = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/gi;
    let match;

    while ((match = toolCallRegex.exec(text)) !== null) {
        const jsonStr = match[1].trim();
        const parsed = tryParseToolJSON(jsonStr);
        if (parsed) {
            toolCalls.push(parsed);
        }
    }

    // Fallback: try to match ```tool_call blocks (some models use code blocks)
    if (toolCalls.length === 0) {
        const codeBlockRegex = /```(?:tool_call|json)?\s*([\s\S]*?)\s*```/gi;
        while ((match = codeBlockRegex.exec(text)) !== null) {
            const jsonStr = match[1].trim();
            const parsed = tryParseToolJSON(jsonStr);
            if (parsed) {
                toolCalls.push(parsed);
            }
        }
    }

    // Clean the text by removing tool call tags
    const cleanText = text
        .replace(/<tool_call>\s*[\s\S]*?\s*<\/tool_call>/gi, "")
        .replace(/```(?:tool_call|json)?\s*[\s\S]*?\s*```/gi, "")
        .trim();

    return {
        toolCalls,
        cleanText,
        hasToolCalls: toolCalls.length > 0,
    };
}

/**
 * Attempts to parse a JSON string into a ToolCall object.
 * Handles common JSON issues from LLM output.
 */
function tryParseToolJSON(jsonStr: string): ToolCall | null {
    // Step 1: Direct parse attempt
    try {
        const parsed = JSON.parse(jsonStr);
        return validateToolCall(parsed);
    } catch {
        // Step 2: Try to fix common JSON issues
    }

    // Step 2: Remove trailing commas (common LLM error)
    let fixed = jsonStr.replace(/,\s*([}\]])/g, "$1");

    // Step 3: Try to fix unquoted keys
    fixed = fixed.replace(
        /(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g,
        '$1"$2":'
    );

    // Step 4: Fix single quotes to double quotes
    fixed = fixed.replace(/'/g, '"');

    try {
        const parsed = JSON.parse(fixed);
        return validateToolCall(parsed);
    } catch {
        // Step 5: Last resort — try to extract name and args separately
        return extractToolCallFromMessyJSON(jsonStr);
    }
}

/**
 * Last-resort extraction for very malformed JSON.
 * Tries to pull out the tool name and basic args.
 */
function extractToolCallFromMessyJSON(text: string): ToolCall | null {
    // Try to find "name": "..." pattern
    const nameMatch = text.match(/["']?name["']?\s*:\s*["']([^"']+)["']/);
    if (!nameMatch) return null;

    const name = nameMatch[1];
    if (!VALID_TOOLS.has(name)) return null;

    // Try to find "args": {...} pattern
    const argsMatch = text.match(/["']?args["']?\s*:\s*(\{[\s\S]*\})/);
    let args: Record<string, unknown> = {};

    if (argsMatch) {
        try {
            args = JSON.parse(argsMatch[1].replace(/'/g, '"'));
        } catch {
            // Extract individual key-value pairs
            const kvRegex = /["']?(\w+)["']?\s*:\s*["']([^"']+)["']/g;
            let kvMatch;
            while ((kvMatch = kvRegex.exec(argsMatch[1])) !== null) {
                args[kvMatch[1]] = kvMatch[2];
            }
        }
    }

    return { name, args };
}

/**
 * Validates that a parsed object is a valid ToolCall.
 */
function validateToolCall(obj: Record<string, unknown>): ToolCall | null {
    if (!obj || typeof obj !== "object") return null;

    const name = obj.name as string;
    if (!name || typeof name !== "string") return null;

    // Check if it's a known tool
    if (!VALID_TOOLS.has(name)) return null;

    const args =
        (obj.args as Record<string, unknown>) ||
        (obj.arguments as Record<string, unknown>) ||
        (obj.parameters as Record<string, unknown>) ||
        {};

    return { name, args };
}

/**
 * Generates the error message to send back to the AI
 * when a tool call is malformed.
 */
export function generateRetryPrompt(failedText: string): string {
    return `[SYSTEM ERROR] Your last tool call was malformed and could not be parsed. The raw output was: "${failedText.slice(0, 200)}". Please retry using the exact format: <tool_call>{"name": "tool_name", "args": {"key": "value"}}</tool_call>. Make sure the JSON is valid.`;
}

/**
 * Checks if the AI's response likely contains a tool call attempt
 * that wasn't properly formatted.
 */
export function looksLikeFailedToolCall(text: string): boolean {
    const indicators = [
        /tool_call/i,
        /"name"\s*:\s*"(create_task|log_habit|write_journal|search_memory|set_reminder|get_current_date)"/i,
        /\{[^}]*"name"[^}]*"args"/i,
    ];

    return indicators.some((regex) => regex.test(text));
}
