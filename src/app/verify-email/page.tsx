"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function VerifyEmailPage() {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendSuccess, setResendSuccess] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const router = useRouter();

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  function handleDigit(index: number, value: string) {
    const char = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = char;
    setDigits(next);
    setError("");
    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(""));
      inputRefs.current[5]?.focus();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const otp = digits.join("");
    if (otp.length < 6) return;
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otp }),
    });
    if (res.ok) {
      router.replace("/admin");
    } else {
      const data = await res.json();
      setError(data.error ?? "קוד שגוי, נסה שנית");
      setDigits(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    }
    setLoading(false);
  }

  async function handleResend() {
    setResendLoading(true);
    setResendSuccess(false);
    const res = await fetch("/api/auth/resend-otp", { method: "POST" });
    if (res.ok) {
      setResendSuccess(true);
      setResendCooldown(60);
    }
    setResendLoading(false);
  }

  const otpComplete = digits.every((d) => d !== "");

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg,#0a0a0a 0%,#1a1208 100%)" }}
      dir="rtl"
    >
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4"
            style={{ background: "linear-gradient(135deg,#C9A84C,#8B6914)" }}
          >
            ✉️
          </div>
          <h1 className="text-2xl font-bold text-gray-900">אימות אימייל</h1>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            שלחנו קוד אימות בן 6 ספרות לכתובת המייל שלך.
            <br />
            הקוד תקף ל-15 דקות.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="flex gap-2 justify-center mb-6" onPaste={handlePaste} dir="ltr">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={(e) => handleDigit(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className="w-11 h-13 text-center text-xl font-bold border-2 rounded-xl focus:outline-none transition-colors"
                style={{
                  borderColor: d ? "#C9A84C" : "#e5e7eb",
                  backgroundColor: d ? "#faf5e4" : "#fff",
                  height: "52px",
                }}
              />
            ))}
          </div>

          {error && (
            <p className="text-red-500 text-sm text-center bg-red-50 rounded-lg px-3 py-2 mb-4">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!otpComplete || loading}
            className="w-full py-3 rounded-xl font-semibold text-white transition-all mb-4"
            style={{
              background: otpComplete ? "linear-gradient(90deg,#C9A84C,#8B6914)" : "#d1d5db",
              cursor: otpComplete ? "pointer" : "not-allowed",
            }}
          >
            {loading ? "מאמת..." : "אמת אימייל"}
          </button>
        </form>

        <div className="text-center">
          {resendSuccess && (
            <p className="text-green-600 text-sm mb-2">קוד חדש נשלח למייל ✓</p>
          )}
          <button
            onClick={handleResend}
            disabled={resendLoading || resendCooldown > 0}
            className="text-sm text-amber-600 hover:text-amber-800 font-medium transition-colors disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            {resendLoading
              ? "שולח..."
              : resendCooldown > 0
              ? `שלח קוד חדש (${resendCooldown}s)`
              : "לא קיבלת קוד? שלח שוב"}
          </button>
        </div>
      </div>
    </div>
  );
}
