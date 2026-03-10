"use client";

// ============================================================
// LocalMind — Settings Modal
// User preferences: model switching, storage info, data clearing
// ============================================================

import React, { useState, useEffect } from "react";
import {
    Settings,
    X,
    Trash2,
    HardDrive,
    Cpu,
    Brain,
    ChevronRight,
    AlertTriangle,
    Database,
    MessageSquare,
    ListTodo,
    Flame,
    BookHeart,
    Bell,
} from "lucide-react";
import db from "@/lib/db";
import type { UserSettings } from "@/lib/types";

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onModelChange: (modelId: string) => void;
    currentModel: string;
}

interface StorageInfo {
    chats: number;
    tasks: number;
    habits: number;
    journal: number;
    reminders: number;
    memory: number;
}

export function SettingsModal({
    isOpen,
    onClose,
    onModelChange,
    currentModel,
}: SettingsModalProps) {
    const [settings, setSettings] = useState<UserSettings | null>(null);
    const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [apiKey, setApiKey] = useState("");

    useEffect(() => {
        if (isOpen) {
            loadData();
        }
    }, [isOpen]);

    const loadData = async () => {
        const s = await db.getSettings();
        setSettings(s);
        if (s.openRouterApiKey) {
            setApiKey(s.openRouterApiKey);
        }
        const info = await db.getStorageUsage();
        setStorageInfo(info);
    };

    const handleApiKeyChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const newKey = e.target.value;
        setApiKey(newKey);
        if (settings) {
            const newSettings: UserSettings = {
                ...settings,
                openRouterApiKey: newKey,
            };
            await db.saveSettings(newSettings);
            setSettings(newSettings);
        }
    };

    const handleModelChange = async (modelId: string) => {
        if (!settings) return;
        const newSettings: UserSettings = {
            ...settings,
            selectedModel: modelId as UserSettings["selectedModel"],
        };
        await db.saveSettings(newSettings);
        setSettings(newSettings);
        onModelChange(modelId);
    };

    const handleClearAllData = async () => {
        setDeleting(true);
        await db.clearAllData();
        setDeleting(false);
        setShowDeleteConfirm(false);
        await loadData();
    };

    if (!isOpen) return null;

    const totalItems =
        storageInfo
            ? storageInfo.chats +
            storageInfo.tasks +
            storageInfo.habits +
            storageInfo.journal +
            storageInfo.reminders +
            storageInfo.memory
            : 0;

    const MODELS = [
        {
            id: "google/gemini-2.5-flash:free",
            name: "Gemini 2.5 Flash",
            desc: "Fast and lightweight",
            size: "Free",
            recommended: true,
        },
        {
            id: "deepseek/deepseek-chat:free",
            name: "DeepSeek V3",
            desc: "High performance chat model",
            size: "Free",
            recommended: false,
        },
        {
            id: "meta-llama/llama-3.3-70b-instruct:free",
            name: "Llama 3.3 70B",
            desc: "Great quality for reasoning",
            size: "Free",
            recommended: false,
        },
    ];

    const STORAGE_ITEMS = [
        { key: "chats" as const, icon: MessageSquare, label: "Chat Messages", color: "text-brand-400" },
        { key: "tasks" as const, icon: ListTodo, label: "Tasks", color: "text-accent-teal" },
        { key: "habits" as const, icon: Flame, label: "Habits", color: "text-accent-amber" },
        { key: "journal" as const, icon: BookHeart, label: "Journal Entries", color: "text-accent-pink" },
        { key: "reminders" as const, icon: Bell, label: "Reminders", color: "text-accent-purple" },
        { key: "memory" as const, icon: Brain, label: "Memory Summaries", color: "text-accent-emerald" },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full sm:max-w-md max-h-[85vh] overflow-y-auto bg-surface-100 border border-white/10 rounded-t-3xl sm:rounded-2xl animate-slide-up">
                {/* Header */}
                <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 bg-surface-100/95 backdrop-blur-xl border-b border-white/5">
                    <div className="flex items-center gap-2">
                        <Settings className="w-5 h-5 text-white/60" />
                        <h2 className="text-lg font-semibold text-white">Settings</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl hover:bg-white/10 text-white/50 hover:text-white transition-all"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 space-y-6">
                    {/* API Key */}
                    <section>
                        <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Settings className="w-3.5 h-3.5" />
                            OpenRouter Configuration
                        </h3>
                        <div className="space-y-3">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-white/70">
                                    API Key
                                </label>
                                <input
                                    type="password"
                                    value={apiKey}
                                    onChange={handleApiKeyChange}
                                    placeholder="sk-or-v1-..."
                                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-brand-500 transition-colors"
                                />
                                <p className="text-xs text-white/30">
                                    Get your free key at <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:underline">openrouter.ai</a>
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* AI Model Selection */}
                    <section>
                        <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Cpu className="w-3.5 h-3.5" />
                            AI Model
                        </h3>
                        <div className="space-y-2">
                            {MODELS.map((model) => (
                                <button
                                    key={model.id}
                                    onClick={() => handleModelChange(model.id)}
                                    className={`w-full text-left p-3.5 rounded-xl border transition-all ${currentModel === model.id || settings?.selectedModel === model.id
                                            ? "border-brand-500/50 bg-brand-500/10"
                                            : "border-white/5 bg-white/[0.02] hover:bg-white/5"
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-white">
                                                    {model.name}
                                                </span>
                                                {model.recommended && (
                                                    <span className="px-1.5 py-0.5 rounded-md bg-accent-emerald/20 text-accent-emerald text-[10px] font-semibold">
                                                        RECOMMENDED
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-white/40 mt-0.5">
                                                {model.desc}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-white/30">{model.size}</span>
                                            <ChevronRight className="w-4 h-4 text-white/20" />
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* Storage Usage */}
                    <section>
                        <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <HardDrive className="w-3.5 h-3.5" />
                            Storage Usage
                        </h3>
                        <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
                            {STORAGE_ITEMS.map((item, i) => {
                                const Icon = item.icon;
                                const count = storageInfo ? storageInfo[item.key] : 0;
                                return (
                                    <div
                                        key={item.key}
                                        className={`flex items-center justify-between px-4 py-3 ${i < STORAGE_ITEMS.length - 1 ? "border-b border-white/5" : ""
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <Icon className={`w-4 h-4 ${item.color}`} />
                                            <span className="text-sm text-white/70">{item.label}</span>
                                        </div>
                                        <span className="text-sm font-mono text-white/40">
                                            {count}
                                        </span>
                                    </div>
                                );
                            })}

                            {/* Total */}
                            <div className="flex items-center justify-between px-4 py-3 bg-white/[0.02] border-t border-white/5">
                                <div className="flex items-center gap-3">
                                    <Database className="w-4 h-4 text-white/50" />
                                    <span className="text-sm font-medium text-white/80">Total Items</span>
                                </div>
                                <span className="text-sm font-mono font-semibold text-white/60">
                                    {totalItems}
                                </span>
                            </div>
                        </div>
                    </section>

                    {/* Danger Zone */}
                    <section>
                        <h3 className="text-xs font-semibold text-accent-rose/60 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Danger Zone
                        </h3>

                        {showDeleteConfirm ? (
                            <div className="rounded-xl border border-accent-rose/30 bg-accent-rose/10 p-4">
                                <p className="text-sm text-white/80 mb-3">
                                    Are you sure? This will permanently delete all your data including chats, tasks, habits, and journal entries.
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setShowDeleteConfirm(false)}
                                        className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/70 text-sm font-medium transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleClearAllData}
                                        disabled={deleting}
                                        className="flex-1 py-2.5 rounded-xl bg-accent-rose hover:bg-accent-rose/80 text-white text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {deleting ? (
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <Trash2 className="w-3.5 h-3.5" />
                                        )}
                                        Delete Everything
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className="w-full p-3.5 rounded-xl border border-accent-rose/20 bg-accent-rose/5 hover:bg-accent-rose/10 text-accent-rose text-sm font-medium transition-all flex items-center justify-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" />
                                Clear All Data
                            </button>
                        )}
                    </section>

                    {/* App Info */}
                    <div className="text-center pt-4 pb-2 border-t border-white/5">
                        <p className="text-white/20 text-xs">
                            LocalMind v1.0.0 — Runs 100% on your device
                        </p>
                        <p className="text-white/10 text-[10px] mt-1">
                            Powered by WebGPU + WebLLM
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default SettingsModal;
