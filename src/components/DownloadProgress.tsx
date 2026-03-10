"use client";

// ============================================================
// LocalMind — Download Progress Component
// Shows model download/loading status with a premium UI
// ============================================================

import React from "react";
import type { EngineStatus } from "@/lib/types";
import { Brain, Download, Loader2, Cpu, CheckCircle2, AlertTriangle } from "lucide-react";

interface ModelDownloadProgress {
    progress: number;
    timeElapsed: number;
    text: string;
    loaded: number;
    total: number;
}

interface DownloadProgressProps {
    progress: ModelDownloadProgress;
    status: EngineStatus;
    error: string | null;
    onRetry: () => void;
}

export function DownloadProgress({
    progress,
    status,
    error,
    onRetry,
}: DownloadProgressProps) {
    if (status === "ready") return null;

    const formatBytes = (bytes: number): string => {
        if (bytes === 0) return "0 B";
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
    };

    const formatTime = (seconds: number): string => {
        if (seconds < 60) return `${Math.round(seconds)}s`;
        const mins = Math.floor(seconds / 60);
        const secs = Math.round(seconds % 60);
        return `${mins}m ${secs}s`;
    };

    const getStatusInfo = () => {
        switch (status) {
            case "downloading":
                return {
                    icon: <Download className="w-6 h-6 text-brand-400 animate-bounce-soft" />,
                    title: "Downloading AI Model",
                    subtitle: "This is a one-time download (~1GB). The model will be cached for offline use.",
                    color: "from-brand-500/20 to-accent-purple/20",
                };
            case "loading":
                return {
                    icon: <Cpu className="w-6 h-6 text-accent-teal animate-pulse-soft" />,
                    title: "Loading AI Engine",
                    subtitle: "Initializing WebGPU and loading model weights into memory...",
                    color: "from-accent-teal/20 to-accent-emerald/20",
                };
            case "error":
                return {
                    icon: <AlertTriangle className="w-6 h-6 text-accent-rose" />,
                    title: "Initialization Failed",
                    subtitle: error || "Something went wrong while loading the AI model.",
                    color: "from-accent-rose/20 to-accent-pink/20",
                };
            default:
                return {
                    icon: <Brain className="w-6 h-6 text-brand-400" />,
                    title: "Preparing LocalMind",
                    subtitle: "Setting up your private AI assistant...",
                    color: "from-brand-500/20 to-accent-purple/20",
                };
        }
    };

    const info = getStatusInfo();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface/95 backdrop-blur-xl">
            <div className="w-full max-w-md mx-4 animate-fade-in">
                {/* Logo & Branding */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-500 to-accent-purple mb-4 shadow-lg shadow-brand-500/30 animate-glow">
                        <Brain className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">
                        Local<span className="text-brand-400">Mind</span>
                    </h1>
                    <p className="text-surface-50/50 text-sm mt-1">
                        Your Private AI Assistant
                    </p>
                </div>

                {/* Status Card */}
                <div
                    className={`relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br ${info.color} backdrop-blur-lg p-6`}
                >
                    {/* Shimmer Effect */}
                    {status !== "error" && (
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer"
                            style={{ backgroundSize: "200% 100%" }} />
                    )}

                    <div className="relative">
                        {/* Status Header */}
                        <div className="flex items-center gap-3 mb-4">
                            {info.icon}
                            <div>
                                <h2 className="text-white font-semibold text-lg">{info.title}</h2>
                                <p className="text-white/50 text-xs mt-0.5 leading-relaxed max-w-[280px]">
                                    {info.subtitle}
                                </p>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        {status !== "error" && (
                            <div className="space-y-3">
                                <div className="relative h-2.5 bg-white/10 rounded-full overflow-hidden">
                                    <div
                                        className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out bg-gradient-to-r from-brand-500 via-accent-purple to-brand-400"
                                        style={{ width: `${Math.max(progress.progress, 2)}%` }}
                                    >
                                        {/* Animated glow on the edge of progress */}
                                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white/40 rounded-full blur-sm" />
                                    </div>
                                </div>

                                {/* Stats Row */}
                                <div className="flex items-center justify-between text-xs text-white/40">
                                    <span className="flex items-center gap-1.5">
                                        {status === "downloading" || status === "loading" ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                            <CheckCircle2 className="w-3 h-3 text-accent-emerald" />
                                        )}
                                        {progress.progress}%
                                    </span>
                                    {progress.total > 0 && (
                                        <span>
                                            {formatBytes(progress.loaded)} / {formatBytes(progress.total)}
                                        </span>
                                    )}
                                    <span>{formatTime(progress.timeElapsed)}</span>
                                </div>

                                {/* Progress Text */}
                                <p className="text-white/30 text-[11px] font-mono truncate">
                                    {progress.text}
                                </p>
                            </div>
                        )}

                        {/* Error Retry */}
                        {status === "error" && (
                            <button
                                onClick={onRetry}
                                className="w-full mt-4 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white text-sm font-medium transition-all active:scale-95"
                            >
                                Try Again
                            </button>
                        )}
                    </div>
                </div>

                {/* Bottom Hint */}
                {status !== "error" && (
                    <p className="text-center text-white/20 text-xs mt-4">
                        💡 Subsequent loads will be instant — model is cached offline
                    </p>
                )}
            </div>
        </div>
    );
}

export default DownloadProgress;
