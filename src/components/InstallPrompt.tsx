"use client";

// ============================================================
// LocalMind — Install Prompt (PWA Add to Home Screen)
// Custom banner to encourage installing the PWA
// ============================================================

import React, { useState, useEffect } from "react";
import { Download, X, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] =
        useState<BeforeInstallPromptEvent | null>(null);
    const [showBanner, setShowBanner] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        // Check if already dismissed
        const wasDismissed = localStorage.getItem("localmind_install_dismissed");
        if (wasDismissed) {
            setDismissed(true);
            return;
        }

        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            // Show banner after a 3-second delay so it's not jarring
            setTimeout(() => setShowBanner(true), 3000);
        };

        window.addEventListener("beforeinstallprompt", handler);
        return () => window.removeEventListener("beforeinstallprompt", handler);
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") {
            setShowBanner(false);
        }
        setDeferredPrompt(null);
    };

    const handleDismiss = () => {
        setShowBanner(false);
        setDismissed(true);
        localStorage.setItem("localmind_install_dismissed", "true");
    };

    if (!showBanner || dismissed || !deferredPrompt) return null;

    return (
        <div className="fixed bottom-20 left-4 right-4 z-40 animate-slide-up">
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-surface-200/95 to-surface-100/95 backdrop-blur-xl p-4 shadow-2xl shadow-black/30">
                {/* Decorative gradient */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-brand-500/20 to-accent-purple/20 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />

                <div className="relative flex items-center gap-3">
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-brand-500 to-accent-purple flex items-center justify-center shadow-lg shadow-brand-500/30">
                        <Smartphone className="w-6 h-6 text-white" />
                    </div>

                    <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-sm">
                            Install LocalMind
                        </p>
                        <p className="text-white/40 text-xs mt-0.5">
                            Add to home screen for the full offline experience
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleDismiss}
                            className="p-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-all"
                            aria-label="Dismiss"
                        >
                            <X className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleInstall}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold transition-all active:scale-95 shadow-lg shadow-brand-500/30"
                        >
                            <Download className="w-3.5 h-3.5" />
                            Install
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default InstallPrompt;
