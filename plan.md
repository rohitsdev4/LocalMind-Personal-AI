1. **Update Types**: Modify `src/lib/types.ts` to include `anthropicApiKey` and `openaiApiKey` in `UserSettings`.
2. **Update Database Defaults**: Modify `src/lib/db.ts` to provide default values for the new API keys.
3. **Update Context Awareness**: Edit `src/lib/systemPrompt.ts` to fetch and inject open tasks, today's habits, upcoming reminders, and recent journal mood context directly into the system prompt.
4. **Update Settings Modal**: Refactor `src/components/SettingsModal.tsx` to allow users to input "Bring Your Own Key" (BYOK) for OpenRouter, Anthropic, and OpenAI.
5. **Implement Fallback & Retry Logic**: Update `src/hooks/useWebLLM.ts` to handle streaming with retries. If OpenRouter fails (e.g., rate limit), it should auto-retry or fallback to Anthropic, then OpenAI. We'll implement parsing of SSE (Server-Sent Events) for all three API formats.
6. **Verify Frontend**: Run `npm run lint` and `npm run build` to verify the codebase compiles successfully.
7. **Pre-commit Instructions**: Run the `pre_commit_instructions` tool to perform required tests and reflection.
8. **Submit Changes**: Submit the branch with a descriptive commit message.
