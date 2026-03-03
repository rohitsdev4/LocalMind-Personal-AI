"use client";

// ============================================================
// LocalMind — Main Page
// Entry point rendering the full-screen chat interface
// ============================================================

import { ChatInterface } from "@/components/ChatInterface";

export default function Home() {
  return (
    <main>
      <ChatInterface />
    </main>
  );
}
