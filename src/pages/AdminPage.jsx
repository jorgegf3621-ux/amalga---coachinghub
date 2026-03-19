import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const ROLES = ["pending", "Team Lead", "Agent", "HR", "Manager"];
const CLIENTS = ["Gemini", "Unisource", "Equicopy", "Other"];

const ROLE_COLOR = {
  pending: { bg: "#f59e0b18", text: "#f59e0b" },
  "Team Lead": { bg: "#379AAB18", text: "#379AAB" },
  Agent: { bg: "#6366f118", text: "#6366f1" },
  HR: { bg: "#ec489918", text: "#ec4899" },
  Manager: { bg: "#10b98118", text: "#10b981" },
};

export default function AdminPage({ onBack }) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("All");

  useEffect(() => { fetchProfiles(); }, []);

  const fetchProfiles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setProfiles(data || []);
    setLoading(false);
  };

  const updateRole = async (id, role) => {
    setSaving(id);
    const { error } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", id);
    if (!error) {
      setProfiles(ps => ps.map(p => p.id === id ? { ...p, role } : p));
    }
    setSaving(null);
  };

  const updateClient = async (id, client) => {
    const { error } = await supabase.from("profiles").update({ client }).eq("id", id);
    if (!error) {
      setProfiles(ps => ps.map(p => p.id === id ? { ...p, client } : p));
    } else {
      console.error("Error updating client:", error);
    }
  };

  const filtered = profiles
    .filter(p => filterRole === "All" || p.role === filterRole)
    .filter(p =>
      p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.email?.toLowerCase().includes(search.toLowerCase())
    );

  const pendingCount = profiles.filter(p => p.role === "pending").length;

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} style={s.backBtn}>← Back to Hub</button>
          <div>
            <div style={s.headerTitle}>User Management</div>
            <div style={s.headerSub}>Assign roles to registered users</div>
          </div>
        </div>
        {pendingCount > 0 && (
          <div style={s.pendingBadge}>
            ⏳ {pendingCount} pending approval
          </div>
        )}
      </div>

      <div style={s.body}>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 20 }}>
          {["All", ...ROLES].map(r => {
            const count = r === "All" ? profiles.length : profiles.filter(p => p.role === r).length;
            const rc = ROLE_COLOR[r] || { bg: "#1e2130", text: "#94a3b8" };
            return (
              <div key={r} onClick={() => setFilterRole(r)}
                style={{ background: filterRole === r ? rc.bg : "#13151f", border: `1px solid ${filterRole === r ? rc.text + "40" : "#1e2130"}`, borderRadius: 10, padding: "12px 14px", cursor: "pointer" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: filterRole === r ? rc.text : "#f1f5f9" }}>{count}</div>
                <div style={{ fontSize: 10, color: filterRole === r ? rc.text : "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{r}</div>
              </div>
            );
          })}
        </div>

        {/* Search */}
        <div style={{ marginBottom: 14 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            style={s.search}
          />
        </div>

        {/* Table */}
        <div style={s.table}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1e2130" }}>
                {["User", "Email", "Role", "Client", "Registered", "Actions"].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={s.empty}>Loading users...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} style={s.empty}>No users found.</td></tr>
              ) : filtered.map((p, i) => {
                const rc = ROLE_COLOR[p.role] || ROLE_COLOR.pending;
                return (
                  <tr key={p.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid #1a1d2a" : "none" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#1a1d2a"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td style={s.td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: rc.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: rc.text, flexShrink: 0 }}>
                          {(p.full_name || p.email || "?").slice(0, 2).toUpperCase()}
                        </div>
                        <div style={{ fontSize: 13, color: "#f1f5f9", fontWeight: 500 }}>{p.full_name || "—"}</div>
                      </div>
                    </td>
                    <td style={{ ...s.td, color: "#64748b", fontSize: 12 }}>{p.email}</td>
                    <td style={s.td}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: rc.text, background: rc.bg, padding: "3px 10px", borderRadius: 99 }}>
                        {p.role}
                      </span>
                    </td>
                    <td style={s.td}>
                      <select
                        value={p.client || ""}
                        onChange={e => updateClient(p.id, e.target.value)}
                        style={s.select}>
                        <option value="">— None —</option>
                        {CLIENTS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td style={{ ...s.td, color: "#64748b", fontSize: 11 }}>
                      {p.created_at ? new Date(p.created_at).toLocaleDateString() : "—"}
                    </td>
                    <td style={s.td}>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        {ROLES.filter(r => r !== "pending" && r !== p.role).map(r => {
                          const rc2 = ROLE_COLOR[r];
                          return (
                            <button key={r} onClick={() => updateRole(p.id, r)}
                              disabled={saving === p.id}
                              style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${rc2.text}40`, background: rc2.bg, color: rc2.text, fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: saving === p.id ? 0.5 : 1 }}>
                              {r}
                            </button>
                          );
                        })}
                        {p.role !== "pending" && (
                          <button onClick={() => updateRole(p.id, "pending")}
                            style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #f59e0b40", background: "#f59e0b18", color: "#f59e0b", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                            Revoke
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const s = {
  page: {
    minHeight: "100vh",
    background: "#0d0f18",
    fontFamily: "'Poppins','Questrial',sans-serif",
    color: "#f1f5f9",
  },
  header: {
    padding: "16px 28px",
    borderBottom: "1px solid #1e2130",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#13151f",
    position: "sticky", top: 0, zIndex: 10,
  },
  backBtn: {
    padding: "7px 14px", borderRadius: 8,
    border: "1px solid #1e2130", background: "transparent",
    color: "#94a3b8", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
  },
  headerTitle: { fontSize: 16, fontWeight: 700, color: "#f1f5f9" },
  headerSub: { fontSize: 11, color: "#64748b" },
  pendingBadge: {
    background: "#f59e0b18", border: "1px solid #f59e0b30",
    borderRadius: 99, padding: "6px 14px",
    fontSize: 12, fontWeight: 600, color: "#f59e0b",
  },
  body: { padding: "24px 28px" },
  search: {
    width: "100%", maxWidth: 360,
    padding: "9px 14px", borderRadius: 9,
    border: "1px solid #1e2130", background: "#13151f",
    color: "#f1f5f9", fontSize: 13, outline: "none",
    fontFamily: "inherit", boxSizing: "border-box",
  },
  table: {
    background: "#13151f",
    border: "1px solid #1e2130",
    borderRadius: 12, overflow: "hidden",
  },
  th: {
    padding: "10px 14px", textAlign: "left",
    fontSize: 10, fontWeight: 700,
    color: "#64748b", textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  td: { padding: "13px 14px" },
  empty: { textAlign: "center", padding: 36, color: "#64748b", fontSize: 13 },
  select: {
    padding: "5px 8px", borderRadius: 7,
    border: "1px solid #1e2130", background: "#0d0f18",
    color: "#94a3b8", fontSize: 11, outline: "none",
    fontFamily: "inherit", cursor: "pointer",
  },
};