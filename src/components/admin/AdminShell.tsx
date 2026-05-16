"use client";
import { useState } from "react";
import Sidebar from "./Sidebar";
import type { Role } from "@/generated/prisma/client";

interface Props {
  user: { name?: string | null; email?: string | null; role: Role };
  children: React.ReactNode;
}

export default function AdminShell({ user, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="flex min-h-screen" style={{ background: "#f8f7f4" }} dir="rtl">
      <Sidebar user={user} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {/* Mobile topbar */}
      <div className="md:hidden fixed top-0 right-0 left-0 z-30 flex items-center justify-between px-4 py-3 border-b border-white/10" style={{ background: "linear-gradient(180deg,#0f172a,#1e293b)" }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm text-white" style={{ background: "linear-gradient(135deg,#d97706,#f59e0b)" }}>M</div>
          <span className="font-bold text-white text-sm">Menu4U</span>
        </div>
        <button onClick={() => setSidebarOpen(true)} className="text-white p-2 rounded-lg hover:bg-white/10 transition-colors">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
      </div>
      <main className="flex-1 overflow-auto pt-14 md:pt-0">{children}</main>
    </div>
  );
}
