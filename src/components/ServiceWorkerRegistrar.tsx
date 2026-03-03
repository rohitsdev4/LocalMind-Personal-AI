"use client";

// ============================================================
// Service Worker Registration (manual, replacing next-pwa)
// ============================================================

import { useEffect } from "react";

export function ServiceWorkerRegistrar() {
    useEffect(() => {
        if (typeof window === "undefined") return;
        if ("serviceWorker" in navigator) {
            navigator.serviceWorker
                .register("/sw.js", { scope: "/" })
                .then((reg) => {
                    console.log("[LocalMind] Service Worker registered:", reg.scope);
                })
                .catch((err) => {
                    console.warn("[LocalMind] Service Worker registration failed:", err);
                });
        }
    }, []);

    return null;
}
