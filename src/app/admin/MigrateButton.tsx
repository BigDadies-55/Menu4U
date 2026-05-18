"use client";
import { useState } from "react";

export default function MigrateButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function run() {
    setStatus("loading");
    setMsg("");
    try {
      const res = await fetch("/api/migrate");
      const data = await res.json();
      if (res.ok) {
        setStatus("ok");
        setMsg(data.message ?? "הושלם בהצלחה");
      } else {
        setStatus("error");
        setMsg(data.error ?? "שגיאה לא ידועה");
      }
    } catch {
      setStatus("error");
      setMsg("שגיאת רשת");
    }
  }

  return (
    <div className="mb-8 p-4 bg-white rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
      <div className="flex-1">
        <div className="text-sm font-semibold text-gray-700">עדכון מסד נתונים</div>
        <div className="text-xs text-gray-400 mt-0.5">הרצת migrations — יש להפעיל לאחר כל עדכון</div>
        {msg && (
          <div className={`text-xs mt-1 font-medium ${status === "ok" ? "text-green-600" : "text-red-500"}`}>
            {msg}
          </div>
        )}
      </div>
      <button
        onClick={run}
        disabled={status === "loading"}
        className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-40 transition-colors"
      >
        {status === "loading" ? "מריץ..." : status === "ok" ? "✓ הושלם" : "הרץ"}
      </button>
    </div>
  );
}
