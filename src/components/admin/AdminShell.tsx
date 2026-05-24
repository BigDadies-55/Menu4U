"use client";
import { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import type { Role } from "@/generated/prisma/client";

const SIDEBAR_COLLAPSED = 60;    // px — icon rail only
const SIDEBAR_PINNED    = 256;   // px — full expanded width

interface Props {
  user: { name?: string | null; email?: string | null; role: Role };
  kdsView: string;
  children: React.ReactNode;
}

export default function AdminShell({ user, kdsView, children }: Props) {
  const [sidebarOpen,       setSidebarOpen]       = useState(false);
  const [pinned,            setPinned]             = useState(false);
  const [showPasswordModal, setShowPasswordModal]  = useState(false);
  const [pwForm,   setPwForm]   = useState({ current: "", next: "" });
  const [pwLoading,setPwLoading]= useState(false);
  const [pwError,  setPwError]  = useState("");
  const [pwSuccess,setPwSuccess]= useState(false);

  // Restore pin preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("menu4u_sidebar_pinned");
    if (saved === "1") setPinned(true);
  }, []);

  function togglePin() {
    setPinned(v => {
      localStorage.setItem("menu4u_sidebar_pinned", v ? "0" : "1");
      return !v;
    });
  }

  function openPasswordModal() {
    setShowPasswordModal(true);
    setPwError("");
    setPwSuccess(false);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwLoading(true); setPwError(""); setPwSuccess(false);
    const res = await fetch("/api/admin/profile/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }),
    });
    if (res.ok) {
      setPwSuccess(true);
      setPwForm({ current: "", next: "" });
      setTimeout(() => { setShowPasswordModal(false); setPwSuccess(false); }, 1500);
    } else {
      const data = await res.json();
      setPwError(data.error ?? "שגיאה");
    }
    setPwLoading(false);
  }

  return (
    <div className="min-h-screen" style={{ background: "#f0ece3" }} dir="rtl">

      <Sidebar
        user={user} kdsView={kdsView}
        pinned={pinned} onTogglePin={togglePin}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onChangePassword={openPasswordModal}
      />

      {/* Main — offset right so content is never under the sidebar */}
      <main
        className="overflow-auto flex flex-col min-h-screen"
        style={{
          marginRight: pinned ? SIDEBAR_PINNED : SIDEBAR_COLLAPSED,
          transition: "margin-right 230ms cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        {/* On mobile: no right margin */}
        <style>{`@media (max-width: 767px) { main { margin-right: 0 !important; } }`}</style>

        {/* Top bar — sticky, full width of main */}
        <TopBar
          user={user}
          onChangePassword={openPasswordModal}
          onOpenMobileSidebar={() => setSidebarOpen(true)}
        />

        {/* Page content */}
        <div className="flex-1">
          {children}
        </div>
      </main>

      {/* Password modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-7">
            <h2 className="text-xl font-bold text-gray-900 mb-6">שינוי סיסמה</h2>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">סיסמה נוכחית</label>
                <input required type="password" value={pwForm.current}
                  onChange={e => setPwForm({ ...pwForm, current: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">סיסמה חדשה</label>
                <input required type="password" minLength={6} value={pwForm.next}
                  onChange={e => setPwForm({ ...pwForm, next: e.target.value })}
                  placeholder="מינימום 6 תווים"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              {pwError   && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{pwError}</p>}
              {pwSuccess && <p className="text-amber-700 text-sm bg-amber-50 px-3 py-2 rounded-lg">הסיסמה שונתה בהצלחה!</p>}
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={pwLoading}
                  className="flex-1 text-white py-2.5 rounded-xl font-semibold text-sm disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg,#8B6914,#C9A84C)" }}>
                  {pwLoading ? "שומר..." : "שמור סיסמה"}
                </button>
                <button type="button" onClick={() => setShowPasswordModal(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl font-semibold text-sm">
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
