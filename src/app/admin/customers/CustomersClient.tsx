"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import PageShell from "@/components/admin/PageShell";

type Restaurant = { id: string; name: string };
type Customer = {
  id: string; restaurantId: string; restaurantName: string;
  name: string; phone: string | null; email: string | null;
  notes: string | null; createdAt: string;
};

type ModalMode = "add" | "edit";
type ModalState = {
  mode: ModalMode;
  customer?: Customer;
} | null;

const EMPTY_FORM = { name: "", phone: "", email: "", notes: "", restaurantId: "" };

export default function CustomersClient({
  restaurants,
  isSuperAdmin,
}: {
  restaurants: Restaurant[];
  isSuperAdmin: boolean;
}) {
  const [customers,      setCustomers]      = useState<Customer[]>([]);
  const [loading,        setLoading]        = useState(false);
  const [filterRest,     setFilterRest]     = useState(restaurants.length === 1 ? restaurants[0].id : "");
  const [search,         setSearch]         = useState("");
  const [modal,          setModal]          = useState<ModalState>(null);
  const [form,           setForm]           = useState(EMPTY_FORM);
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState("");
  const [confirmDelete,  setConfirmDelete]  = useState<string | null>(null);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchCustomers = useCallback(async (restId: string, q: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (restId) params.set("restaurantId", restId);
    if (q)      params.set("q", q);
    try {
      const res = await fetch(`/api/admin/customers?${params}`);
      const data = await res.json();
      setCustomers(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      fetchCustomers(filterRest, search);
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [filterRest, search, fetchCustomers]);

  function openAdd() {
    setForm({ ...EMPTY_FORM, restaurantId: filterRest || (restaurants[0]?.id ?? "") });
    setError("");
    setModal({ mode: "add" });
  }

  function openEdit(c: Customer) {
    setForm({ name: c.name, phone: c.phone ?? "", email: c.email ?? "", notes: c.notes ?? "", restaurantId: c.restaurantId });
    setError("");
    setModal({ mode: "edit", customer: c });
  }

  async function handleSave() {
    setSaving(true); setError("");
    try {
      if (modal?.mode === "add") {
        const res = await fetch("/api/admin/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error ?? "שגיאה"); setSaving(false); return; }
      } else if (modal?.mode === "edit" && modal.customer) {
        const res = await fetch(`/api/admin/customers/${modal.customer.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error ?? "שגיאה"); setSaving(false); return; }
      }
      setModal(null);
      fetchCustomers(filterRest, search);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/admin/customers/${id}`, { method: "DELETE" });
    if (res.ok) {
      setConfirmDelete(null);
      setCustomers(prev => prev.filter(c => c.id !== id));
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  return (
    <PageShell>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">לקוחות</h1>
          <p className="text-sm text-gray-500 mt-0.5">{customers.length} לקוחות</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg,#8B6914,#C9A84C)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          הוסף לקוח
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        {(isSuperAdmin || restaurants.length > 1) && (
          <select
            value={filterRest}
            onChange={e => setFilterRest(e.target.value)}
            className="px-3.5 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 min-w-[180px]"
          >
            {isSuperAdmin && <option value="">כל המסעדות</option>}
            {restaurants.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        )}
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="חיפוש לפי שם, טלפון, אימייל..."
            className="w-full pr-9 pl-3.5 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <svg className="animate-spin ml-2" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/></svg>
            טוען...
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span className="text-sm">אין לקוחות{search ? " תואמים לחיפוש" : " עדיין"}</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-5 py-3 text-right">שם</th>
                  <th className="px-5 py-3 text-right">טלפון</th>
                  <th className="px-5 py-3 text-right">אימייל</th>
                  {isSuperAdmin && <th className="px-5 py-3 text-right">מסעדה</th>}
                  <th className="px-5 py-3 text-right">הצטרף</th>
                  <th className="px-5 py-3 text-right">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {customers.map(c => (
                  <tr key={c.id} className="hover:bg-amber-50/30 transition-colors group">
                    <td className="px-5 py-3.5 font-medium text-gray-900">{c.name}</td>
                    <td className="px-5 py-3.5 text-gray-600 font-mono text-xs">{c.phone || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-gray-600">
                      {c.email
                        ? <a href={`mailto:${c.email}`} className="text-amber-700 hover:underline">{c.email}</a>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    {isSuperAdmin && <td className="px-5 py-3.5 text-gray-500 text-xs">{c.restaurantName}</td>}
                    <td className="px-5 py-3.5 text-gray-400 text-xs whitespace-nowrap">{formatDate(c.createdAt)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEdit(c)}
                          className="p-1.5 rounded-lg hover:bg-amber-100 text-amber-600 transition-colors"
                          title="עריכה"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        {confirmDelete === c.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleDelete(c.id)} className="px-2 py-1 rounded-lg bg-red-500 text-white text-[10px] font-bold">מחק</button>
                            <button onClick={() => setConfirmDelete(null)} className="px-2 py-1 rounded-lg bg-gray-100 text-gray-600 text-[10px]">ביטול</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(c.id)}
                            className="p-1.5 rounded-lg hover:bg-red-100 text-red-400 transition-colors"
                            title="מחיקה"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-7">
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              {modal.mode === "add" ? "הוסף לקוח" : "עריכת לקוח"}
            </h2>
            <div className="space-y-4">
              {/* Restaurant selector — only for SUPER_ADMIN in add mode */}
              {modal.mode === "add" && (isSuperAdmin || restaurants.length > 1) && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">מסעדה *</label>
                  <select
                    value={form.restaurantId}
                    onChange={e => setForm(f => ({ ...f, restaurantId: e.target.value }))}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <option value="">בחר מסעדה</option>
                    {restaurants.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">שם מלא *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="ישראל ישראלי"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">טלפון</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="050-0000000"
                  dir="ltr"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">אימייל</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="email@example.com"
                  dir="ltr"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">הערות</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder="הערות נוספות..."
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                />
              </div>
              {error && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim() || (modal.mode === "add" && !form.restaurantId)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: "linear-gradient(135deg,#8B6914,#C9A84C)" }}
              >
                {saving ? "שומר..." : modal.mode === "add" ? "הוסף" : "שמור"}
              </button>
              <button
                onClick={() => setModal(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
