import React from "react";
import { MessageSquare, ListTodo, Flame, Bell, BookHeart, X } from "lucide-react";

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
    onFeatureSelect: (featureId: string) => void;
    activeFeature: string;
}

const MENU_ITEMS = [
    { id: "chat", icon: MessageSquare, label: "Chat", color: "text-brand-400" },
    { id: "tasks", icon: ListTodo, label: "Tasks", color: "text-accent-teal" },
    { id: "habits", icon: Flame, label: "Habits", color: "text-accent-amber" },
    { id: "reminders", icon: Bell, label: "Reminders", color: "text-accent-purple" },
    { id: "journal", icon: BookHeart, label: "Journal", color: "text-accent-pink" },
];

export function Sidebar({ isOpen, onClose, onFeatureSelect, activeFeature }: SidebarProps) {
    if (!isOpen) return null;

    const handleFeatureClick = (featureId: string) => {
        onFeatureSelect(featureId);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex">
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
                onClick={onClose}
            />

            <div className="relative w-64 h-full bg-surface-100 border-r border-white/10 shadow-2xl flex flex-col animate-slide-right">
                <div className="flex items-center justify-between p-4 border-b border-white/5">
                    <h2 className="text-lg font-bold text-white tracking-tight">Features</h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-all"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto py-4">
                    <div className="px-3 space-y-1">
                        {MENU_ITEMS.map((item) => {
                            const Icon = item.icon;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => handleFeatureClick(item.id)}
                                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 transition-all group ${activeFeature === item.id ? "bg-white/10 text-white" : "text-white/70 hover:text-white"}`}
                                >
                                    <div className={`p-2 rounded-lg bg-white/[0.03] group-hover:bg-white/10 ${item.color} transition-all ${activeFeature === item.id ? "bg-white/10" : ""}`}>
                                        <Icon className="w-4 h-4" />
                                    </div>
                                    <span className="text-sm font-medium">{item.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
