"use client";

import { useState } from "react";
import { loginAction } from "./actions";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await loginAction(email, password);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, #0f172a 0%, #134e4a 100%)" }}
    >
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl"
            style={{ background: "linear-gradient(135deg, #d97706 0%, #f59e0b 100%)" }}
          >
            <span className="text-white text-2xl font-bold">M</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-wide">Menu4U</h1>
          <p className="text-slate-400 mt-1 text-sm tracking-wider uppercase">ממשק ניהול</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                אימייל
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                placeholder="admin@menu4u.com"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                סיסמה
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-white transition-all shadow-lg hover:shadow-emerald-900/50 disabled:opacity-60 active:scale-98"
              style={{ background: "linear-gradient(135deg, #059669 0%, #047857 100%)" }}
            >
              {loading ? "מתחבר..." : "כניסה למערכת"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
