"use client";

// ============================================================
// LocalMind — Main Page
// Entry point rendering the full-screen chat interface
// ============================================================

import { useState } from "react";
import { ChatInterface } from "@/components/ChatInterface";
import { TasksView } from "@/components/tasks/TasksView";

export default function Home() {
  const [activeView, setActiveView] = useState<"chat" | "tasks">("chat");

  return (
    <main className="h-screen w-screen overflow-hidden">
      {activeView === "chat" && <ChatInterface onSelectView={setActiveView} />}
      {activeView === "tasks" && <TasksView onSelectView={setActiveView} />}
    </main>
  );
}
