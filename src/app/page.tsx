"use client";

// ============================================================
// LocalMind — Main Page
// Entry point rendering the full-screen chat interface
// ============================================================

import { useState } from "react";
import { ChatInterface } from "@/components/ChatInterface";
import { RemindersInterface } from "@/components/RemindersInterface";
import { Sidebar } from "@/components/Sidebar";

export default function Home() {
  const [currentView, setCurrentView] = useState("chat");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <main className="flex min-h-screen flex-col bg-surface">
        {currentView === "chat" ? (
            <ChatInterface onOpenSidebar={() => setSidebarOpen(true)} />
        ) : currentView === "reminders" ? (
            <div className="flex-1 flex flex-col h-full bg-surface relative">
                <button
                    onClick={() => setSidebarOpen(true)}
                    className="absolute top-4 left-4 z-50 p-2 rounded-xl text-white/60 hover:text-white bg-surface-100/50 backdrop-blur-md"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
                </button>
                <RemindersInterface />
            </div>
        ) : (
            <div className="flex-1 flex items-center justify-center text-white/50 relative">
                 <button
                    onClick={() => setSidebarOpen(true)}
                    className="absolute top-4 left-4 z-50 p-2 rounded-xl text-white/60 hover:text-white bg-surface-100/50 backdrop-blur-md"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
                </button>
                Coming soon...
            </div>
        )}

        <Sidebar
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            currentView={currentView}
            onViewChange={setCurrentView}
        />
    </main>
  );
}
