// ============================================================
// LocalMind — System Prompt Builder (OPTIMIZED FOR SPEED)
// Shorter prompt = less prefill time = faster first token
// ============================================================

import { getToolDefinitionsForPrompt } from "./tools";
import { getRecentMemoryContext } from "./memory";
import db from "./db";

/**
 * Builds a CONCISE system prompt to minimize prefill time.
 * Every token in the system prompt adds to latency.
 */
export async function buildSystemPrompt(): Promise<string> {
    const toolDefs = getToolDefinitionsForPrompt();
    const memoryContext = await getRecentMemoryContext(3); // Only 3 summaries, not 5

    // Fetch context awareness data
    const [tasks, habits, reminders, journals] = await Promise.all([
        db.getAllTasks(),
        db.getAllHabits(),
        db.getAllReminders(),
        db.getAllJournalEntries()
    ]);

    // Format Tasks
    const openTasks = tasks.filter(t => t.status !== "done" && t.status !== "cancelled");
    const tasksContext = openTasks.length > 0
        ? `\nOPEN TASKS: ${openTasks.map(t => `[${t.priority}] ${t.name}`).join(", ")}`
        : "";

    // Format Habits
    const today = new Date().toISOString().split("T")[0];
    const todayHabits = habits.map(h => {
        const loggedToday = h.logs.find(l => l.date === today);
        return `${h.name} (${loggedToday ? loggedToday.status : "pending"})`;
    });
    const habitsContext = habits.length > 0
        ? `\nTODAY'S HABITS: ${todayHabits.join(", ")}`
        : "";

    // Format Reminders
    const upcomingReminders = reminders.filter(r => !r.fired);
    const remindersContext = upcomingReminders.length > 0
        ? `\nUPCOMING REMINDERS: ${upcomingReminders.map(r => `"${r.message}" at ${new Date(r.triggerTime).toLocaleString()}`).join(", ")}`
        : "";

    // Format Journal Mood
    const recentJournal = journals[0]; // Assuming they are sorted descending in db
    const moodContext = recentJournal
        ? `\nRECENT MOOD: ${recentJournal.mood} (from ${new Date(recentJournal.createdAt).toLocaleDateString()})`
        : "";

    const dynamicContext = `${tasksContext}${habitsContext}${remindersContext}${moodContext}`;

    return `You are LocalMind, a private AI life assistant running locally on the user's device. Be helpful and concise.

RULES:
- You cannot access the internet or know the current time. Use get_current_date if needed.
- Keep responses under 100 words unless asked for detail.
- Be proactive: create tasks, log habits, save journals when the user mentions them.
${dynamicContext}

TOOL FORMAT:
<tool_call>{"name": "tool_name", "args": {"key": "value"}}</tool_call>

TOOLS:
${toolDefs}
${memoryContext}`;
}
