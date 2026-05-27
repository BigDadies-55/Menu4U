"use client";

import { useEffect, useState } from "react";

type Restaurant = { id: string; name: string; logo: string | null; groupId: string | null };
type Group = { id: string; name: string; logo: string | null; createdAt: string; restaurants: Restaurant[] };

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [allRestaurants, setAllRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [newGroupName, setNewGroupName] = useState("");
  const [creating, setCreating] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/groups");
    if (res.ok) {
      const data = await res.json();
      setGroups(data.groups ?? []);
      setAllRestaurants(data.allRestaurants ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function createGroup() {
    if (!newGroupName.trim()) return;
    setCreating(true);
    await fetch("/api/admin/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newGroupName.trim() }),
    });
    setNewGroupName("");
    setCreating(false);
    load();
  }

  async function deleteGroup(groupId: string) {
    if (!confirm("למחוק את הרשת? המסעדות ינותקו ממנה (לא יימחקו).")) return;
    await fetch(`/api/admin/groups/${groupId}`, { method: "DELETE" });
    load();
  }

  async function addRestaurant(groupId: string, restaurantId: string) {
    await fetch(`/api/admin/groups/${groupId}/restaurants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId }),
    });
    load();
  }

  async function removeRestaurant(groupId: string, restaurantId: string) {
    await fetch(`/api/admin/groups/${groupId}/restaurants?restaurantId=${restaurantId}`, {
      method: "DELETE",
    });
    load();
  }

  const unassigned = allRestaurants.filter(r => !r.groupId);

  return (
    <div style={{ padding: "32px 24px", maxWidth: 800, margin: "0 auto", direction: "rtl" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>ניהול רשתות מסעדות</h1>
      <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, marginBottom: 32 }}>
        רשת מאפשרת ללקוחות לצבור ולממש נקודות וקופונים בכל הסניפים של אותה רשת.
      </p>

      {/* Create group */}
      <div style={{
        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 12, padding: 20, marginBottom: 28,
      }}>
        <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>יצירת רשת חדשה</div>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            value={newGroupName}
            onChange={e => setNewGroupName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && createGroup()}
            placeholder="שם הרשת (לדוג׳: רשת קפה אביב)"
            style={{
              flex: 1, padding: "10px 14px", borderRadius: 8,
              background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)",
              color: "inherit", fontSize: 14,
            }}
          />
          <button
            onClick={createGroup}
            disabled={creating || !newGroupName.trim()}
            style={{
              padding: "10px 20px", borderRadius: 8, border: "none",
              background: creating ? "rgba(197,168,128,0.3)" : "#C5A880",
              color: "#0D0D0D", fontWeight: 700, fontSize: 14, cursor: "pointer",
            }}
          >
            {creating ? "יוצר..." : "+ צור רשת"}
          </button>
        </div>
      </div>

      {/* Groups list */}
      {loading ? (
        <div style={{ color: "rgba(255,255,255,0.4)", textAlign: "center", padding: 40 }}>טוען...</div>
      ) : groups.length === 0 ? (
        <div style={{ color: "rgba(255,255,255,0.3)", textAlign: "center", padding: 40 }}>
          אין רשתות מוגדרות עדיין
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {groups.map(g => {
            const isOpen = expandedGroup === g.id;
            const groupRestaurants = allRestaurants.filter(r => r.groupId === g.id);
            const available = unassigned; // restaurants not in any group

            return (
              <div key={g.id} style={{
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(197,168,128,0.2)",
                borderRadius: 14, overflow: "hidden",
              }}>
                {/* Header */}
                <div
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "16px 20px", cursor: "pointer",
                    background: isOpen ? "rgba(197,168,128,0.07)" : "transparent",
                  }}
                  onClick={() => setExpandedGroup(isOpen ? null : g.id)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 20 }}>🏢</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{g.name}</div>
                      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
                        {groupRestaurants.length} סניפים
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button
                      onClick={e => { e.stopPropagation(); deleteGroup(g.id); }}
                      style={{
                        padding: "5px 12px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.3)",
                        background: "rgba(239,68,68,0.08)", color: "#fca5a5",
                        fontSize: 12, cursor: "pointer",
                      }}
                    >
                      מחק רשת
                    </button>
                    <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 18 }}>{isOpen ? "▲" : "▼"}</span>
                  </div>
                </div>

                {/* Expanded content */}
                {isOpen && (
                  <div style={{ padding: "0 20px 20px" }}>
                    {/* Current restaurants */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
                        סניפים ברשת
                      </div>
                      {groupRestaurants.length === 0 ? (
                        <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 13, padding: "8px 0" }}>
                          אין סניפים ברשת זו עדיין
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {groupRestaurants.map(r => (
                            <div key={r.id} style={{
                              display: "flex", alignItems: "center", justifyContent: "space-between",
                              background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.15)",
                              borderRadius: 8, padding: "8px 14px",
                            }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ color: "#4ade80", fontSize: 14 }}>✓</span>
                                <span style={{ fontSize: 14 }}>{r.name}</span>
                              </div>
                              <button
                                onClick={() => removeRestaurant(g.id, r.id)}
                                style={{
                                  padding: "3px 10px", borderRadius: 5,
                                  border: "1px solid rgba(239,68,68,0.2)",
                                  background: "rgba(239,68,68,0.06)",
                                  color: "#fca5a5", fontSize: 11, cursor: "pointer",
                                }}
                              >
                                הסר
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Add restaurant */}
                    {available.length > 0 && (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
                          הוסף סניף
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {available.map(r => (
                            <button
                              key={r.id}
                              onClick={() => addRestaurant(g.id, r.id)}
                              style={{
                                padding: "6px 14px", borderRadius: 8,
                                background: "rgba(197,168,128,0.1)", border: "1px solid rgba(197,168,128,0.3)",
                                color: "#C5A880", fontSize: 13, cursor: "pointer",
                              }}
                            >
                              + {r.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {available.length === 0 && groupRestaurants.length === 0 && (
                      <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 13 }}>
                        כל המסעדות כבר משויכות לרשת
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
