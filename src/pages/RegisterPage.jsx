import { useState } from "react";
import { supabase } from "../lib/supabase";

const CLIENT_DEPTS = {
  Gemini:    ["UOS", "CNR", "EDR", "Vouchers", "Record Review", "Record Retrieval", "OSS"],
  Equicopy:  ["Record Retrieval"],
  Unisource: ["Record Retrieval"],
};
const CLIENTS_LIST = Object.keys(CLIENT_DEPTS);

export default function RegisterPage({ onSwitch }) {
  const [form, setForm] = useState({ fullName: "", email: "", password: "", confirm: "", client: "", dept: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const deptsForClient = form.client ? (CLIENT_DEPTS[form.client] || []) : [];

  const handleRegister = async () => {
    if (!form.fullName || !form.email || !form.password || !form.confirm || !form.client || !form.dept) {
      setError("Please fill in all fields."); return;
    }
    if (form.password !== form.confirm) {
      setError("Passwords do not match."); return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters."); return;
    }
    setLoading(true); setError("");
    const { data, error: err } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.fullName } },
    });
    if (err) { setError(err.message); setLoading(false); return; }
    if (data?.user) {
      await supabase.from("profiles").update({ client: form.client, dept: form.dept }).eq("id", data.user.id);
    }
    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <div style={styles.page}>
        <div style={styles.bg} />
        <div style={styles.card}>
          <div style={styles.logoWrap}>
            <div style={styles.logoIcon}>
              <svg viewBox="0 0 40 40" width="40" height="40" fill="none">
                <path d="M6 34 L20 8 L26 18 L14 34 Z" fill="#379AAB" opacity="0.45"/>
                <path d="M14 34 L26 18 L32 28 L22 34 Z" fill="#379AAB" opacity="0.72"/>
                <path d="M22 34 L32 28 L38 34 Z" fill="#379AAB"/>
              </svg>
            </div>
            <div>
              <div style={styles.logoText}>AMALGA</div>
              <div style={styles.logoSub}>Coaching Hub</div>
            </div>
          </div>
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9", marginBottom: 10 }}>Account Created!</h2>
            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}>
              Your account is <strong style={{ color: "#f59e0b" }}>pending approval</strong>.
            </p>
            <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.7, marginBottom: 24 }}>
              An administrator will assign your role shortly.<br />
              You'll be able to log in once your account is approved.
            </p>
            <button onClick={onSwitch} style={styles.btn}>Go to Login →</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.bg} />
      <div style={styles.card}>
        <div style={styles.logoWrap}>
          <div>
            <div style={styles.logoText}>Amalga</div>
            <div style={styles.logoSub}>Coaching Hub</div>
          </div>
        </div>

        <h2 style={styles.title}>Create account</h2>
        <p style={styles.subtitle}>Your role will be assigned by an administrator after registration.</p>

        {error && <div style={styles.error}>{error}</div>}

        {[
          { k: "fullName", label: "Full Name", type: "text", placeholder: "John Smith" },
          { k: "email", label: "Email", type: "email", placeholder: "you@amalga.com" },
          { k: "password", label: "Password", type: "password", placeholder: "Min. 6 characters" },
          { k: "confirm", label: "Confirm Password", type: "password", placeholder: "Repeat password" },
        ].map(f => (
          <div key={f.k} style={styles.field}>
            <label style={styles.label}>{f.label}</label>
            <input
              type={f.type}
              value={form[f.k]}
              onChange={e => set(f.k, e.target.value)}
              placeholder={f.placeholder}
              style={styles.input}
            />
          </div>
        ))}

        <div style={styles.field}>
          <label style={styles.label}>Client</label>
          <select
            value={form.client}
            onChange={e => { set("client", e.target.value); set("dept", ""); }}
            style={styles.input}
          >
            <option value="">Select your client...</option>
            {CLIENTS_LIST.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {form.client && (
          <div style={styles.field}>
            <label style={styles.label}>Department</label>
            <select
              value={form.dept}
              onChange={e => set("dept", e.target.value)}
              style={styles.input}
            >
              <option value="">Select your department...</option>
              {deptsForClient.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        )}

        {/* Pending role notice */}
        <div style={styles.notice}>
          <span style={{ fontSize: 14 }}>⏳</span>
          <span>Your account will start as <strong>Pending</strong> until an admin assigns your role.</span>
        </div>

        <button onClick={handleRegister} disabled={loading} style={styles.btn}>
          {loading ? "Creating account..." : "Register →"}
        </button>

        <div style={{ textAlign: "center", marginTop: 16 }}>
          <span style={{ fontSize: 12, color: "#64748b" }}>Already have an account? </span>
          <button onClick={onSwitch} style={styles.link}>Sign in</button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0a0c14",
    fontFamily: "'Poppins','Questrial',sans-serif",
    padding: 20,
    position: "relative",
    overflow: "hidden",
  },
  bg: {
    position: "absolute",
    inset: 0,
    background: "radial-gradient(ellipse 80% 60% at 50% -10%, #379AAB22 0%, transparent 70%)",
    pointerEvents: "none",
  },
  card: {
    background: "#13151f",
    border: "1px solid #1e2130",
    borderRadius: 20,
    padding: "36px 36px",
    width: "100%",
    maxWidth: 420,
    position: "relative",
    boxShadow: "0 40px 80px #00000060",
  },
  logoWrap: { display: "flex", alignItems: "center", gap: 12, marginBottom: 28 },
  logoIcon: {
    width: 48, height: 48,
    background: "#379AAB15",
    border: "1px solid #379AAB30",
    borderRadius: 14,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  logoText: { fontSize: 18, fontWeight: 800, color: "#f1f5f9", letterSpacing: "0.08em" },
  logoSub: { fontSize: 10, color: "#379AAB", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 },
  title: { fontSize: 20, fontWeight: 700, color: "#f1f5f9", margin: "0 0 6px" },
  subtitle: { fontSize: 12, color: "#64748b", margin: "0 0 22px", lineHeight: 1.6 },
  error: {
    background: "#ef444415", border: "1px solid #ef444430",
    borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#ef4444", marginBottom: 16,
  },
  field: { marginBottom: 14 },
  label: {
    display: "block", fontSize: 11, fontWeight: 600,
    color: "#94a3b8", marginBottom: 5,
    textTransform: "uppercase", letterSpacing: "0.05em",
  },
  input: {
    width: "100%", padding: "10px 14px", borderRadius: 10,
    border: "1px solid #1e2130", background: "#0d0f18",
    color: "#f1f5f9", fontSize: 13, outline: "none",
    boxSizing: "border-box", fontFamily: "inherit",
  },
  notice: {
    display: "flex", alignItems: "flex-start", gap: 8,
    background: "#f59e0b10", border: "1px solid #f59e0b25",
    borderRadius: 10, padding: "10px 12px",
    fontSize: 12, color: "#f59e0b", marginBottom: 16, lineHeight: 1.6,
  },
  btn: {
    width: "100%", padding: "12px", borderRadius: 10, border: "none",
    background: "linear-gradient(135deg,#379AAB,#2a7a89)",
    color: "#fff", fontSize: 14, fontWeight: 700,
    cursor: "pointer", fontFamily: "inherit",
  },
  link: {
    background: "none", border: "none",
    color: "#379AAB", fontSize: 12, fontWeight: 600,
    cursor: "pointer", fontFamily: "inherit",
  },
};