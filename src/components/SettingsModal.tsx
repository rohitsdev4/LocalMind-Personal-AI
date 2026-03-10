"use client";

import { useState, useEffect, useCallback } from "react";
import {
    X,
    Key,
    Cpu,
    Database,
    Trash2,
    CheckCircle,
    XCircle,
    Loader2,
    ExternalLink,
} from "lucide-react";
import * as db from "@/lib/db";

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentModel: string;
    onModelChange: (model: string) => void;
}

const FREE_MODELS = [
    { id: "meta-llama/llama-3.3-70b-instruct:free", name: "Llama 3.3 70B", provider: "Meta" },
    { id: "qwen/qwen3-235b-a22b:free", name: "Qwen3 235B", provider: "Qwen" },
    { id: "google/gemma-3-27b-it:free", name: "Gemma 3 27B", provider: "Google" },
    { id: "mistralai/mistral-small-3.1-24b-instruct:free", name: "Mistral Small 3.1", provider: "Mistral" },
    { id: "deepseek/deepseek-chat-v3-0324:free", name: "DeepSeek V3", provider: "DeepSeek" },
    { id: "microsoft/phi-4-reasoning-plus:free", name: "Phi-4 Reasoning+", provider: "Microsoft" },
];

interface StorageStats {
    tasks: number;
    habits: number;
    journal: number;
    reminders: number;
    chats: number;
}

export function SettingsModal({ isOpen, onClose, currentModel, onModelChange }: SettingsModalProps) {
    const [apiKey, setApiKey] = useState("");
    const [savedKey, setSavedKey] = useState("");
    const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
    const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [activeTab, setActiveTab] = useState<"api" | "model" | "storage">("api");

    // Load settings on open
    useEffect(() => {
        if (!isOpen) return;
        (async () => {
            const settings = await db.getSettings();
            if (settings.openRouterApiKey) {
                setSavedKey(settings.openRouterApiKey);
                setApiKey(""); // Don't show full key
            }
            const usage = await db.getStorageUsage();
            setStorageStats(usage);
        })();
    }, [isOpen]);

    const handleSaveKey = useCallback(async () => {
        if (!apiKey.trim()) return;
        const settings = await db.getSettings();
        await db.saveSettings({ ...settings, openRouterApiKey: apiKey.trim() });
        setSavedKey(apiKey.trim());
        setApiKey("");
    }, [apiKey]);

    const handleTestConnection = useCallback(async () => {
        const key = apiKey.trim() || savedKey;
        if (!key) return;

        setTestStatus("testing");
        try {
            const res = await fetch("https://openrouter.ai/api/v1/models", {
                headers: { Authorization: `Bearer ${key}` },
            });
            setTestStatus(res.ok ? "success" : "error");
        } catch {
            setTestStatus("error");
        }
        setTimeout(() => setTestStatus("idle"), 3000);
    }, [apiKey, savedKey]);

    const handleModelSelect = useCallback(
        async (modelId: string) => {
            onModelChange(modelId);
            const settings = await db.getSettings();
            await db.saveSettings({ ...settings, selectedModel: modelId });
        },
        [onModelChange]
    );

    const handleClearAllData = useCallback(async () => {
        await db.clearAllData();
        setStorageStats({ tasks: 0, habits: 0, journal: 0, reminders: 0, chats: 0 });
        setShowClearConfirm(false);
    }, []);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden border border-gray-800">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-800">
                    <h2 className="text-lg font-semibold text-white">Settings</h2>
                    <button
                        onClick={onClose}
                        className="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-800">
                    {[
                        { id: "api" as const, label: "API Key", icon: Key },
                        { id: "model" as const, label: "Model", icon: Cpu },
                        { id: "storage" as const, label: "Storage", icon: Database },
                    ].map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            onClick={() => setActiveTab(id)}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                                activeTab === id
                                    ? "text-purple-400 border-b-2 border-purple-400"
                                    : "text-gray-500 hover:text-gray-300"
                            }`}
                        >
                            <Icon size={16} />
                            {label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto max-h-[60vh]">
                    {/* API Key Tab */}
                    {activeTab === "api" && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                                    OpenRouter API Key
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="password"
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        placeholder={savedKey ? "Key saved (enter new to replace)" : "sk-or-..."}
                                        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                    <button
                                        onClick={handleSaveKey}
                                        disabled={!apiKey.trim()}
                                        className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
                                    >
                                        Save
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={handleTestConnection}
                                disabled={testStatus === "testing" || (!apiKey.trim() && !savedKey)}
                                className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-lg text-sm transition-colors"
                            >
                                {testStatus === "testing" && <Loader2 size={14} className="animate-spin" />}
                                {testStatus === "success" && <CheckCircle size={14} className="text-green-400" />}
                                {testStatus === "error" && <XCircle size={14} className="text-red-400" />}
                                {testStatus === "idle" && "Test Connection"}
                                {testStatus === "testing" && "Testing..."}
                                {testStatus === "success" && "Connected!"}
                                {testStatus === "error" && "Failed"}
                            </button>

                            <a
                                href="https://openrouter.ai/keys"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-sm text-purple-400 hover:text-purple-300"
                            >
                                Get a free API key <ExternalLink size={14} />
                            </a>
                        </div>
                    )}

                    {/* Model Tab */}
                    {activeTab === "model" && (
                        <div className="space-y-2">
                            <p className="text-sm text-gray-400 mb-3">
                                All models are free via OpenRouter.
                            </p>
                            {FREE_MODELS.map((model) => (
                                <button
                                    key={model.id}
                                    onClick={() => handleModelSelect(model.id)}
                                    className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors ${
                                        currentModel === model.id
                                            ? "bg-purple-600/20 border border-purple-500/30"
                                            : "bg-gray-800 hover:bg-gray-750 border border-transparent"
                                    }`}
                                >
                                    <div>
                                        <p className="text-sm font-medium text-white">{model.name}</p>
                                        <p className="text-xs text-gray-500">{model.provider}</p>
                                    </div>
                                    {currentModel === model.id && (
                                        <CheckCircle size={16} className="text-purple-400" />
                                    )}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Storage Tab */}
                    {activeTab === "storage" && (
                        <div className="space-y-4">
                            {storageStats && (
                                <div className="grid grid-cols-2 gap-3">
                                    {(Object.entries(storageStats) as [string, number][]).map(
                                        ([key, count]) => (
                                            <div
                                                key={key}
                                                className="bg-gray-800 rounded-lg p-3"
                                            >
                                                <p className="text-xs text-gray-500 capitalize">{key}</p>
                                                <p className="text-lg font-semibold text-white">{count}</p>
                                            </div>
                                        )
                                    )}
                                </div>
                            )}

                            <div className="border-t border-gray-800 pt-4">
                                {!showClearConfirm ? (
                                    <button
                                        onClick={() => setShowClearConfirm(true)}
                                        className="flex items-center gap-2 px-3 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-400 rounded-lg text-sm transition-colors"
                                    >
                                        <Trash2 size={14} />
                                        Clear All Data
                                    </button>
                                ) : (
                                    <div className="space-y-2">
                                        <p className="text-sm text-red-400">
                                            This will permanently delete all your data. Are you sure?
                                        </p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleClearAllData}
                                                className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors"
                                            >
                                                Yes, Delete Everything
                                            </button>
                                            <button
                                                onClick={() => setShowClearConfirm(false)}
                                                className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
