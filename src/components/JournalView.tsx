"use client";

import React, { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { Calendar, ChevronLeft, ChevronRight, Lock, Plus, Save, Download, FileText, Bot, Sparkles } from "lucide-react";
import db, { setJournalUnlockPin } from "@/lib/db";
import { hashPin } from "@/lib/crypto";
import type { JournalEntry, Mood } from "@/lib/types";

// Types for the WebLLM hook to call AI features
interface JournalViewProps {
    onClose: () => void;
    onAskAI?: (prompt: string) => void;
}

const MOODS: { value: Mood; emoji: string; label: string }[] = [
    { value: "great", emoji: "🤩", label: "Great" },
    { value: "good", emoji: "🙂", label: "Good" },
    { value: "okay", emoji: "😐", label: "Okay" },
    { value: "bad", emoji: "😟", label: "Bad" },
    { value: "terrible", emoji: "😢", label: "Terrible" },
];

export function JournalView({ onClose, onAskAI }: JournalViewProps) {
    // Start locked so we can determine if we need a PIN or not
    const [isLocked, setIsLocked] = useState(true);
    const [pinInput, setPinInput] = useState("");
    const [pinError, setPinError] = useState("");
    const [hasPinSet, setHasPinSet] = useState(false);

    // Data state
    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [currentDate, setCurrentDate] = useState<Date>(new Date());

    // Editor State
    const [entryText, setEntryText] = useState("");
    const [mood, setMood] = useState<Mood>("okay");
    const [energyLevel, setEnergyLevel] = useState(50);
    const [gratitude, setGratitude] = useState<string[]>(["", "", ""]);
    const [tags, setTags] = useState("");
    const [photos, setPhotos] = useState<string[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initial load: Check if PIN is set
    useEffect(() => {
        const init = async () => {
            const settings = await db.getSettings();
            if (settings.journalPin) {
                setHasPinSet(true);
                setIsLocked(true);
            } else {
                // Keep locked to force PIN creation before viewing/creating entries
                setHasPinSet(false);
                setIsLocked(true);
            }
        };
        init();
    }, []);

    // Load entries for current month/context
    const loadEntries = async () => {
        const all = await db.getAllJournalEntries();
        setEntries(all);

        // Find entry for currently selected date
        loadEntryForDate(currentDate, all);
    };

    const loadEntryForDate = (date: Date, allEntries: JournalEntry[] = entries) => {
        const dateStr = date.toISOString().split("T")[0];
        const existing = allEntries.find(e => e.createdAt.startsWith(dateStr));

        if (existing) {
            setEntryText(existing.entry);
            setMood(existing.mood);
            setEnergyLevel(existing.energyLevel || 50);
            setGratitude([...(existing.gratitude || []), "", "", ""].slice(0, 3));
            setTags(existing.tags?.join(", ") || "");
            setPhotos(existing.photos || []);
        } else {
            resetEditor();
        }
    };

    const resetEditor = () => {
        setEntryText("");
        setMood("okay");
        setEnergyLevel(50);
        setGratitude(["", "", ""]);
        setTags("");
        setPhotos([]);
    };

    const handlePinSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const settings = await db.getSettings();
        if (hasPinSet) {
            if (settings.journalPin === hashPin(pinInput)) {
                setJournalUnlockPin(pinInput);
                setIsLocked(false);
                setPinError("");
                loadEntries();
            } else {
                setPinError("Incorrect PIN");
            }
        } else {
            // Setting a new PIN
            if (pinInput.length >= 4) {
                settings.journalPin = hashPin(pinInput);
                await db.saveSettings(settings);
                setHasPinSet(true);
                setJournalUnlockPin(pinInput);
                setIsLocked(false);
                loadEntries();
            } else {
                setPinError("PIN must be at least 4 characters");
            }
        }
    };

    const handleSave = async () => {
        const dateStr = currentDate.toISOString().split("T")[0];
        const existingId = entries.find(e => e.createdAt.startsWith(dateStr))?.id;

        const newEntry: JournalEntry = {
            id: existingId || uuidv4(),
            entry: entryText,
            mood,
            energyLevel,
            gratitude: gratitude.filter(g => g.trim().length > 0),
            tags: tags.split(",").map(t => t.trim()).filter(t => t.length > 0),
            photos,
            createdAt: currentDate.toISOString(), // Simplified to use the selected date at midnight
        };

        await db.saveJournalEntry(newEntry);
        await loadEntries(); // Reload to get updated list
    };

    const handleDateChange = (offset: number) => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() + offset);
        setCurrentDate(newDate);
        loadEntryForDate(newDate);
    };

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            setPhotos(prev => [...prev, base64String]);
        };
        reader.readAsDataURL(file);
    };

    const applyTemplate = (type: "morning" | "evening") => {
        if (type === "morning") {
            setEntryText("How did you sleep?\n\nWhat are your top 3 goals for today?\n1.\n2.\n3.\n\nAny thoughts for the day?");
        } else {
            setEntryText("What were the highlights of your day?\n\nWhat could have gone better?\n\nTomorrow, I will focus on:");
        }
    };

    const exportToMarkdown = () => {
        const md = entries.map(e => {
            return `## ${new Date(e.createdAt).toLocaleDateString()}\n**Mood:** ${e.mood}\n**Energy:** ${e.energyLevel}/100\n**Gratitude:** ${e.gratitude?.join(", ")}\n**Tags:** ${e.tags?.join(", ")}\n\n${e.entry}\n---`;
        }).join("\n\n");

        const blob = new Blob([md], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "journal_export.md";
        a.click();
    };

    const exportToJSON = () => {
        const json = JSON.stringify(entries, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "journal_export.json";
        a.click();
    };

    const exportToPDF = () => {
        // A simple print-based PDF export
        const printWindow = window.open("", "_blank");
        if (!printWindow) return;

        const htmlContent = `
            <html>
            <head>
                <title>Journal Export</title>
                <style>
                    body { font-family: sans-serif; line-height: 1.6; padding: 20px; max-width: 800px; margin: 0 auto; color: #333; }
                    .entry { border-bottom: 1px solid #ccc; padding-bottom: 20px; margin-bottom: 20px; }
                    .date { font-weight: bold; font-size: 1.2em; color: #222; }
                    .meta { font-size: 0.9em; color: #666; margin-bottom: 10px; }
                    .content { white-space: pre-wrap; margin-top: 15px; }
                    .photos { display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap; }
                    .photos img { max-width: 200px; max-height: 200px; border-radius: 8px; object-fit: cover; }
                </style>
            </head>
            <body>
                <h1>My Journal</h1>
                ${entries.map(e => `
                    <div class="entry">
                        <div class="date">${new Date(e.createdAt).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                        <div class="meta">
                            <strong>Mood:</strong> ${e.mood} |
                            <strong>Energy:</strong> ${e.energyLevel}/100<br>
                            ${e.tags && e.tags.length > 0 ? `<strong>Tags:</strong> ${e.tags.join(", ")}<br>` : ''}
                            ${e.gratitude && e.gratitude.length > 0 ? `<strong>Gratitude:</strong> ${e.gratitude.join(", ")}` : ''}
                        </div>
                        <div class="content">${e.entry.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
                        ${e.photos && e.photos.length > 0 ? `
                            <div class="photos">
                                ${e.photos.map(p => `<img src="${p}" alt="Journal Photo" />`).join('')}
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
                <script>
                    window.onload = () => {
                        window.print();
                        setTimeout(() => window.close(), 500);
                    };
                </script>
            </body>
            </html>
        `;
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    // UI Render - PIN Lock
    if (isLocked) {
        return (
            <div className="absolute inset-0 z-40 bg-surface flex flex-col items-center justify-center p-4 animate-fade-in">
                <div className="w-16 h-16 rounded-2xl bg-surface-200 flex items-center justify-center mb-6">
                    <Lock className="w-8 h-8 text-brand-400" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Private Journal</h2>
                <p className="text-sm text-white/50 mb-6 text-center">
                    {hasPinSet ? "Enter your PIN to unlock" : "Set a new PIN to encrypt your journal"}
                </p>
                <form onSubmit={handlePinSubmit} className="w-full max-w-xs space-y-4">
                    <input
                        type="password"
                        value={pinInput}
                        onChange={(e) => setPinInput(e.target.value)}
                        placeholder="Enter PIN"
                        className="w-full bg-surface-100 border border-white/10 rounded-xl px-4 py-3 text-center text-white tracking-widest focus:outline-none focus:border-brand-500 transition-colors"
                        autoFocus
                    />
                    {pinError && <p className="text-accent-rose text-xs text-center">{pinError}</p>}
                    <button
                        type="submit"
                        className="w-full bg-brand-500 hover:bg-brand-600 text-white font-medium py-3 rounded-xl transition-all"
                    >
                        {hasPinSet ? "Unlock" : "Set PIN & Create"}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full text-white/40 hover:text-white text-sm py-2 transition-all"
                    >
                        Cancel
                    </button>
                </form>
            </div>
        );
    }

    return (
        <div className="absolute inset-0 z-40 bg-surface flex flex-col animate-slide-up">
            {/* Header */}
            <header className="flex items-center justify-between px-4 py-3 bg-surface-100/50 border-b border-white/5 backdrop-blur-xl">
                <div className="flex items-center gap-2">
                    <button onClick={onClose} className="p-2 -ml-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-all">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-lg font-bold text-white">Journal</h1>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative group">
                        <button className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-all flex items-center gap-1">
                            <Download className="w-4 h-4" />
                            <span className="text-xs">Export</span>
                        </button>
                        <div className="absolute right-0 top-full mt-1 w-32 bg-surface-200 border border-white/10 rounded-xl shadow-xl hidden group-hover:block overflow-hidden z-50">
                            <button onClick={exportToPDF} className="w-full text-left px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5">PDF</button>
                            <button onClick={exportToMarkdown} className="w-full text-left px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5">Markdown</button>
                            <button onClick={exportToJSON} className="w-full text-left px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5">JSON</button>
                        </div>
                    </div>
                    <button onClick={handleSave} className="p-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-all flex items-center gap-1 shadow-lg shadow-brand-500/20">
                        <Save className="w-4 h-4" />
                        <span className="text-xs font-medium pr-1">Save</span>
                    </button>
                </div>
            </header>

            {/* Date Navigation */}
            <div className="flex items-center justify-between px-4 py-2 bg-surface border-b border-white/5">
                <button onClick={() => handleDateChange(-1)} className="p-2 text-white/40 hover:text-white transition-all"><ChevronLeft className="w-4 h-4"/></button>
                <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-brand-400" />
                    <span className="font-medium text-white text-sm">
                        {currentDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                </div>
                <button onClick={() => handleDateChange(1)} className="p-2 text-white/40 hover:text-white transition-all"><ChevronRight className="w-4 h-4"/></button>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
                {/* AI & Templates Row */}
                <div className="flex flex-wrap gap-2">
                    <button onClick={() => applyTemplate('morning')} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 text-white/70 hover:bg-white/10 border border-white/5 transition-all">🌅 Morning Template</button>
                    <button onClick={() => applyTemplate('evening')} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 text-white/70 hover:bg-white/10 border border-white/5 transition-all">🌙 Evening Template</button>
                    {onAskAI && (
                        <>
                            <div className="w-px h-6 bg-white/10 mx-1 self-center"></div>
                            <button onClick={() => {
                                onAskAI("Please generate a creative writing prompt for my journal today.");
                                onClose();
                            }} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent-purple/10 text-accent-purple hover:bg-accent-purple/20 border border-accent-purple/20 transition-all flex items-center gap-1.5"><Sparkles className="w-3 h-3"/> AI Prompt</button>
                            <button onClick={() => {
                                const context = entries.map(e => `[${new Date(e.createdAt).toLocaleDateString()}] Mood: ${e.mood}, Energy: ${e.energyLevel}, Tags: ${e.tags?.join(", ")}. Entry: ${e.entry}`).join("\n\n");
                                onAskAI(`Please analyze these recent journal entries and give me a sentiment analysis and weekly mood summary report:\n\n${context}`);
                                onClose();
                            }} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent-purple/10 text-accent-purple hover:bg-accent-purple/20 border border-accent-purple/20 transition-all flex items-center gap-1.5"><Bot className="w-3 h-3"/> Analyze Mood</button>
                            <button onClick={() => {
                                const context = entries.map(e => `[${new Date(e.createdAt).toLocaleDateString()}] Mood: ${e.mood}. Entry: ${e.entry}`).join("\n\n");
                                onAskAI(`Can you look at my journal from exactly one year ago today and show me an 'On this day' memory? If not a year, then the oldest entry you can find? Here are my entries:\n\n${context}`);
                                onClose();
                            }} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent-teal/10 text-accent-teal hover:bg-accent-teal/20 border border-accent-teal/20 transition-all flex items-center gap-1.5">📅 On This Day</button>
                            <button onClick={() => {
                                const context = entries.map(e => `[${new Date(e.createdAt).toLocaleDateString()}] Mood: ${e.mood}, Energy: ${e.energyLevel}, Tags: ${e.tags?.join(", ")}. Entry: ${e.entry}`).join("\n\n");
                                onAskAI(`Can you look at my journal entries to see if there is any pattern detection, like how my mood changes based on habits being done? Here are the entries:\n\n${context}`);
                                onClose();
                            }} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent-amber/10 text-accent-amber hover:bg-accent-amber/20 border border-accent-amber/20 transition-all flex items-center gap-1.5">🔍 Pattern Detection</button>
                        </>
                    )}
                </div>

                {/* Mood & Energy */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-surface-100 rounded-2xl p-4 border border-white/5">
                        <label className="block text-xs font-medium text-white/50 mb-3 uppercase tracking-wider">How do you feel?</label>
                        <div className="flex justify-between gap-2">
                            {MOODS.map(m => (
                                <button
                                    key={m.value}
                                    onClick={() => setMood(m.value)}
                                    className={`flex flex-col items-center gap-1 flex-1 p-2 rounded-xl transition-all ${mood === m.value ? 'bg-white/10 scale-105 ring-1 ring-brand-500' : 'hover:bg-white/5 opacity-50 hover:opacity-100'}`}
                                >
                                    <span className="text-2xl">{m.emoji}</span>
                                    <span className="text-[10px] font-medium text-white/70">{m.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="bg-surface-100 rounded-2xl p-4 border border-white/5">
                        <label className="block text-xs font-medium text-white/50 mb-3 uppercase tracking-wider">Energy Level ({energyLevel}%)</label>
                        <div className="pt-2">
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={energyLevel}
                                onChange={(e) => setEnergyLevel(parseInt(e.target.value))}
                                className="w-full accent-brand-500 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                            />
                            <div className="flex justify-between text-[10px] text-white/40 mt-2 font-medium">
                                <span>Exhausted</span>
                                <span>Energized</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Gratitude */}
                <div className="bg-surface-100 rounded-2xl p-4 border border-white/5">
                    <label className="block text-xs font-medium text-white/50 mb-3 uppercase tracking-wider">Today I am grateful for...</label>
                    <div className="space-y-2">
                        {[0, 1, 2].map((idx) => (
                            <div key={idx} className="flex items-center gap-2">
                                <span className="text-xs font-medium text-white/20 w-4">{idx + 1}.</span>
                                <input
                                    type="text"
                                    value={gratitude[idx]}
                                    onChange={(e) => {
                                        const newG = [...gratitude];
                                        newG[idx] = e.target.value;
                                        setGratitude(newG);
                                    }}
                                    placeholder="Something good..."
                                    className="flex-1 bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/20 focus:bg-white/[0.05] transition-all"
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Entry Editor */}
                <div className="flex flex-col h-64 bg-surface-100 rounded-2xl border border-white/5 overflow-hidden">
                    <div className="px-4 py-2 border-b border-white/5 bg-white/[0.02] flex items-center gap-2">
                        <FileText className="w-4 h-4 text-white/40" />
                        <span className="text-xs font-medium text-white/50 uppercase tracking-wider">Reflection</span>
                    </div>
                    <textarea
                        value={entryText}
                        onChange={(e) => setEntryText(e.target.value)}
                        placeholder="Write your thoughts here..."
                        className="flex-1 w-full bg-transparent resize-none p-4 text-sm text-white focus:outline-none placeholder-white/20 leading-relaxed"
                    />
                </div>

                {/* Tags & Photos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-8">
                    <div className="bg-surface-100 rounded-2xl p-4 border border-white/5">
                        <label className="block text-xs font-medium text-white/50 mb-2 uppercase tracking-wider">Tags</label>
                        <input
                            type="text"
                            value={tags}
                            onChange={(e) => setTags(e.target.value)}
                            placeholder="e.g. work, family, gym"
                            className="w-full bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/20 transition-all"
                        />
                    </div>

                    <div className="bg-surface-100 rounded-2xl p-4 border border-white/5">
                        <label className="block text-xs font-medium text-white/50 mb-2 uppercase tracking-wider">Photos</label>
                        <div className="flex flex-wrap gap-2">
                            {photos.map((p, i) => (
                                <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-white/10 group">
                                    <img src={p} alt={`Attached ${i}`} className="w-full h-full object-cover" />
                                    <button
                                        onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}
                                        className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <span className="text-xs text-white">Remove</span>
                                    </button>
                                </div>
                            ))}
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="w-16 h-16 rounded-lg border-2 border-dashed border-white/10 hover:border-white/30 flex items-center justify-center text-white/30 hover:text-white/60 transition-all"
                            >
                                <Plus className="w-6 h-6" />
                            </button>
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handlePhotoUpload}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default JournalView;