import re

with open("src/hooks/useWebLLM.ts", "r") as f:
    content = f.read()

# Replace the single block with the structured fallbacks
search = """                // Use OpenRouter streaming API with auto-retry
                let response: Response | null = null;
                const maxRetries = 2;
                for (let attempt = 0; attempt <= maxRetries; attempt++) {
                    try {
                        response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                            method: "POST",
                            headers: {
                                "Authorization": `Bearer ${settings.openRouterApiKey}`,
                                "HTTP-Referer": window.location.href,
                                "X-Title": "LocalMind",
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({
                                model: settings.selectedModel,
                                messages: llmMessages,
                                stream: true,
                            }),
                            signal: abortRef.current.signal,
                        });

                        if (response.ok) break;

                        // Only retry for rate limits (429) or server errors (5xx)
                        if (response.status !== 429 && response.status < 500) {
                            break;
                        }

                        if (attempt < maxRetries) {
                            // Wait before retrying
                            await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
                        }
                    } catch (err) {
                        if (abortRef.current?.signal.aborted) throw err;
                        if (attempt === maxRetries) throw err;
                        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
                    }
                }

                if (!response || !response.ok) {
                    const errorText = response ? await response.text() : "Network Error";
                    throw new Error(`OpenRouter API error (${response?.status}): ${errorText}`);
                }"""

replace = """                let response: Response | null = null;
                let usedApi: "openrouter" | "anthropic" | "openai" = "openrouter";

                const tryOpenRouter = async () => {
                    let orResponse: Response | null = null;
                    const maxRetries = 2;
                    for (let attempt = 0; attempt <= maxRetries; attempt++) {
                        try {
                            orResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                                method: "POST",
                                headers: {
                                    "Authorization": `Bearer ${settings.openRouterApiKey}`,
                                    "HTTP-Referer": window.location.href,
                                    "X-Title": "LocalMind",
                                    "Content-Type": "application/json"
                                },
                                body: JSON.stringify({
                                    model: settings.selectedModel,
                                    messages: llmMessages,
                                    stream: true,
                                }),
                                signal: abortRef.current?.signal,
                            });
                            if (orResponse.ok) return orResponse;
                            if (orResponse.status !== 429 && orResponse.status < 500) break;
                            if (attempt < maxRetries) await new Promise((res) => setTimeout(res, 1000 * (attempt + 1)));
                        } catch (err) {
                            if (abortRef.current?.signal.aborted) throw err;
                            if (attempt === maxRetries) break;
                            await new Promise((res) => setTimeout(res, 1000 * (attempt + 1)));
                        }
                    }
                    return orResponse;
                };

                const tryAnthropic = async () => {
                    if (!settings.anthropicApiKey) return null;
                    // Format messages for Anthropic (system is separated, user/assistant alternating)
                    const systemMsgs = llmMessages.filter(m => m.role === "system").map(m => m.content).join("\\n");
                    const antMsgs = llmMessages.filter(m => m.role !== "system").map(m => ({
                        role: m.role,
                        content: m.content
                    }));

                    try {
                        const antResponse = await fetch("https://api.anthropic.com/v1/messages", {
                            method: "POST",
                            headers: {
                                "x-api-key": settings.anthropicApiKey,
                                "anthropic-version": "2023-06-01",
                                "anthropic-dangerously-allow-browser": "true",
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({
                                model: "claude-3-5-sonnet-20241022",
                                system: systemMsgs || undefined,
                                messages: antMsgs,
                                max_tokens: 1024,
                                stream: true,
                            }),
                            signal: abortRef.current?.signal,
                        });
                        return antResponse;
                    } catch (err) {
                        if (abortRef.current?.signal.aborted) throw err;
                        return null;
                    }
                };

                const tryOpenAI = async () => {
                    if (!settings.openaiApiKey) return null;
                    try {
                        const oaResponse = await fetch("https://api.openai.com/v1/chat/completions", {
                            method: "POST",
                            headers: {
                                "Authorization": `Bearer ${settings.openaiApiKey}`,
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({
                                model: "gpt-4o",
                                messages: llmMessages,
                                stream: true,
                            }),
                            signal: abortRef.current?.signal,
                        });
                        return oaResponse;
                    } catch (err) {
                        if (abortRef.current?.signal.aborted) throw err;
                        return null;
                    }
                };

                // Fallback Logic Sequence
                response = await tryOpenRouter();
                if (response && response.ok) {
                    usedApi = "openrouter";
                } else {
                    response = await tryAnthropic();
                    if (response && response.ok) {
                        usedApi = "anthropic";
                    } else {
                        response = await tryOpenAI();
                        if (response && response.ok) {
                            usedApi = "openai";
                        }
                    }
                }

                if (!response || !response.ok) {
                    const errorText = response ? await response.text() : "All APIs failed";
                    throw new Error(`API error (${response?.status || "Unknown"}): ${errorText}`);
                }"""

if search in content:
    content = content.replace(search, replace)
    with open("src/hooks/useWebLLM.ts", "w") as f:
        f.write(content)
    print("Success")
else:
    print("Search block not found")
