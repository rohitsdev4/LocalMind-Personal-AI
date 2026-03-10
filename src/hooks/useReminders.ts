import { useState, useEffect, useCallback } from "react";
import db from "@/lib/db";
import type { Reminder, ID } from "@/lib/types";

export function useReminders() {
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [activeToast, setActiveToast] = useState<Reminder | null>(null);

    const loadReminders = useCallback(async () => {
        const all = await db.getAllReminders();
        setReminders(all);
    }, []);

    // Initial load
    useEffect(() => {
        loadReminders();
    }, [loadReminders]);

    // Background polling for reminders
    useEffect(() => {
        const checkReminders = async () => {
            const all = await db.getAllReminders();
            const now = new Date().getTime();

            for (const r of all) {
                if (r.status === "active" || r.status === "snoozed") {
                    const triggerTime = new Date(r.snoozedUntil || r.triggerTime).getTime();

                    // If it's time to fire and hasn't been fired yet
                    if (triggerTime <= now && !r.fired) {
                        // Show in-app toast
                        setActiveToast(r);

                        // Mark as fired
                        r.fired = true;
                        r.status = "fired";
                        await db.saveReminder(r);

                        // Handle recurring
                        if (r.repeat && r.repeat !== "none") {
                            const newTrigger = calculateNextRepeat(r.triggerTime, r.repeat);
                            if (newTrigger) {
                                // Create the next occurrence
                                const nextReminder: Reminder = {
                                    ...r,
                                    id: crypto.randomUUID(),
                                    triggerTime: newTrigger.toISOString(),
                                    fired: false,
                                    status: "active",
                                    snoozedUntil: undefined,
                                    createdAt: new Date().toISOString()
                                };
                                await db.saveReminder(nextReminder);
                            }
                        }
                    }
                }
            }
            loadReminders();
        };

        const interval = setInterval(checkReminders, 60000); // Check every minute
        checkReminders(); // Initial check

        return () => clearInterval(interval);
    }, [loadReminders]);

    // Listen to Service Worker messages (Snooze/Dismiss actions)
    useEffect(() => {
        const handleMessage = async (event: MessageEvent) => {
            if (event.data && event.data.type === 'NOTIFICATION_CLICK') {
                const { action, reminderId } = event.data;
                const r = await db.getReminder(reminderId);
                if (!r) return;

                if (action === 'snooze-5m') {
                    r.snoozedUntil = new Date(Date.now() + 5 * 60000).toISOString();
                    r.status = "snoozed";
                    r.fired = false;
                } else if (action === 'snooze-1h') {
                    r.snoozedUntil = new Date(Date.now() + 60 * 60000).toISOString();
                    r.status = "snoozed";
                    r.fired = false;
                } else if (action === 'dismiss') {
                    r.status = "dismissed";
                }

                await db.saveReminder(r);
                loadReminders();
            }
        };

        navigator.serviceWorker?.addEventListener('message', handleMessage);
        return () => {
            navigator.serviceWorker?.removeEventListener('message', handleMessage);
        };
    }, [loadReminders]);

    const snoozeReminder = async (id: ID, minutes: number) => {
        const r = await db.getReminder(id);
        if (r) {
            r.snoozedUntil = new Date(Date.now() + minutes * 60000).toISOString();
            r.status = "snoozed";
            r.fired = false;
            await db.saveReminder(r);
            loadReminders();
            if (activeToast?.id === id) setActiveToast(null);
        }
    };

    const dismissReminder = async (id: ID) => {
        const r = await db.getReminder(id);
        if (r) {
            r.status = "dismissed";
            await db.saveReminder(r);
            loadReminders();
            if (activeToast?.id === id) setActiveToast(null);
        }
    };

    const deleteReminder = async (id: ID) => {
        await db.deleteReminder(id);
        loadReminders();
    };

    return {
        reminders,
        activeToast,
        snoozeReminder,
        dismissReminder,
        deleteReminder,
        dismissToast: () => setActiveToast(null),
        refresh: loadReminders
    };
}

function calculateNextRepeat(baseTimeIso: string, repeat: string): Date | null {
    const d = new Date(baseTimeIso);
    if (isNaN(d.getTime())) return null;

    switch (repeat) {
        case "daily": d.setDate(d.getDate() + 1); break;
        case "weekly": d.setDate(d.getDate() + 7); break;
        case "monthly": d.setMonth(d.getMonth() + 1); break;
        case "yearly": d.setFullYear(d.getFullYear() + 1); break;
        default: return null;
    }
    return d;
}
