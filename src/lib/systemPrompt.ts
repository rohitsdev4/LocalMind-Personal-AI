// ============================================================
// LocalMind — System Prompt Builder (OPTIMIZED FOR SPEED)
// Shorter prompt = less prefill time = faster first token
// ============================================================

import { getToolDefinitionsForPrompt } from "./tools";
import { getRecentMemoryContext } from "./memory";

/**
 * Builds a CONCISE system prompt to minimize prefill time.
 * Every token in the system prompt adds to latency.
 */
export async function buildSystemPrompt(): Promise<string> {
    const toolDefs = getToolDefinitionsForPrompt();
    const memoryContext = await getRecentMemoryContext(3); // Only 3 summaries, not 5

    return `You are LocalMind, a private AI life assistant running locally on the user's device. Be helpful and concise.

RULES:
- You cannot access the internet or know the current time. Use get_current_date if needed.
- Keep responses under 100 words unless asked for detail.
- Be proactive: create tasks, log habits, save journals when the user mentions them.

TOOL FORMAT:
<tool_call>{"name": "tool_name", "args": {"key": "value"}}</tool_call>

TOOLS:
${toolDefs}
${memoryContext}`;
}
