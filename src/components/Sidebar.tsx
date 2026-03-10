"use client";

import { MessageSquare, ListTodo, Flame, Bell, BookOpen, X } from "lucide-react";

export type SidebarView = "chat" | "tasks" | "habits" | "reminders" | "journal";

interface SidebarProps {
    isOpen: boolean;
    currentView: SidebarView;
    onNavigate: (view: SidebarView) => void;
    onClose: () => void;
}

const NAV_ITEMS: { view: SidebarView; label: string; icon: typeof MessageSquare }[] = [
    { view: "chat", label: "Chat", icon: MessageSquare },
    { view: "tasks", label: "Tasks", icon: ListTodo },
    { view: "habits", label: "Habits", icon: Flame },
    { view: "reminders", label: "Reminders", icon: Bell },
    { view: "journal", label: "Journal", icon: BookOpen },
];

export function Sidebar({ isOpen, currentView, onNavigate, onClose }: SidebarProps) {
    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={onClose}
                />
            )}

            {/* Sidebar panel */}
            <aside
                className={`fixed top-0 left-0 h-full w-64 bg-gray-900 border-r border-gray-800 z-50 transform transition-transform duration-200 ease-in-out ${
                    isOpen ? "translate-x-0" : "-translate-x-full"
                }`}
            >
                <div className="flex items-center justify-between p-4 border-b border-gray-800">
                    <h2 className="text-lg font-semibold text-white">LocalMind</h2>
                    <button
                        onClick={onClose}
                        className="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <nav className="p-2 space-y-1">
                    {NAV_ITEMS.map(({ view, label, icon: Icon }) => (
                        <button
                            key={view}
                            onClick={() => {
                                onNavigate(view);
                                onClose();
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                                currentView === view
                                    ? "bg-purple-600/20 text-purple-400"
                                    : "text-gray-400 hover:bg-gray-800 hover:text-white"
                            }`}
                        >
                            <Icon size={18} />
                            {label}
                        </button>
                    ))}
                </nav>

                <div className="absolute bottom-4 left-0 right-0 px-4">
                    <p className="text-xs text-gray-600 text-center">
                        LocalMind v2.0 -- AI Life Assistant
                    </p>
                </div>
            </aside>
        </>
    );
}
