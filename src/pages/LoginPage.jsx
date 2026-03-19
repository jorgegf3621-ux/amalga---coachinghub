import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function LoginPage({ onSwitch }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState("login"); // "login" | "forgot" | "sent"

  const handleLogin = async () => {
    if (!email || !password) { setError("Please fill in all fields."); return; }
    setLoading(true); setError("");
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) setError(err.message);
    setLoading(false);
  };

  const handleForgot = async () => {
    if (!email) { setError("Please enter your email address."); return; }
    setLoading(true); setError("");
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (err) { setError(err.message); setLoading(false); return; }
    setView("sent");
    setLoading(false);
  };

  const Logo = () => (
    <div style={styles.logoWrap}>
      <div>
        <div style={styles.logoText}>Amalga</div>
        <div style={styles.logoSub}>Coaching Hub</div>
      </div>
    </div>
  );

  // ── Sent confirmation view ──
  if (view === "sent") {
    return (
      <div style={styles.page}>
        <div style={styles.bg} />
        <div style={styles.card}>
          <Logo />
          <div style={{ textAlign: "center", padding: "12px 0 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9", margin: "0 0 10px" }}>Check your email</h2>
            <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.7, marginBottom: 6 }}>
              We sent a password reset link to
            </p>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#379AAB", marginBottom: 24 }}>{email}</p>
            <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.7, marginBottom: 28 }}>
              Click the link in the email to set a new password. The link expires in 1 hour.
            </p>
            <button onClick={() => { setView("login"); setError(""); }} style={styles.btn}>
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Forgot password view ──
  if (view === "forgot") {
    return (
      <div style={styles.page}>
        <div style={styles.bg} />
        <div style={styles.card}>
          <Logo />
          <h2 style={styles.title}>Reset password</h2>
          <p style={styles.subtitle}>Enter your email and we'll send you a reset link.</p>

          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleForgot()}
              placeholder="you@amalga.com"
              style={styles.input}
              autoFocus
            />
          </div>

          <button onClick={handleForgot} disabled={loading} style={styles.btn}>
            {loading ? "Sending..." : "Send Reset Link →"}
          </button>

          <div style={{ textAlign: "center", marginTop: 18 }}>
            <button onClick={() => { setView("login"); setError(""); }} style={styles.link}>
              ← Back to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Login view ──
  return (
    <div style={styles.page}>
      <div style={styles.bg} />
      <div style={styles.card}>
        <Logo />

        <h2 style={styles.title}>Welcome back</h2>
        <p style={styles.subtitle}>Sign in to your account to continue</p>

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.field}>
          <label style={styles.label}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            placeholder="you@amalga.com"
            style={styles.input}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            placeholder="••••••••"
            style={styles.input}
          />
          <div style={{ textAlign: "right", marginTop: 6 }}>
            <button onClick={() => { setView("forgot"); setError(""); }} style={styles.link}>
              Forgot password?
            </button>
          </div>
        </div>

        <button onClick={handleLogin} disabled={loading} style={styles.btn}>
          {loading ? "Signing in..." : "Sign In →"}
        </button>

        <div style={styles.divider}><span>or</span></div>

        <button onClick={onSwitch} style={styles.secondary}>
          Create a new account
        </button>

        <p style={styles.footer}>
          Amalga Group · Confidential platform
        </p>
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
    padding: "40px 36px",
    width: "100%",
    maxWidth: 420,
    position: "relative",
    boxShadow: "0 40px 80px #00000060",
  },
  logoWrap: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 32,
  },
  logoIcon: {
    width: 48,
    height: 48,
    background: "#379AAB15",
    border: "1px solid #379AAB30",
    borderRadius: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    fontSize: 18,
    fontWeight: 800,
    color: "#f1f5f9",
    letterSpacing: "0.08em",
  },
  logoSub: {
    fontSize: 10,
    color: "#379AAB",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    fontWeight: 600,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: "#f1f5f9",
    margin: "0 0 6px",
  },
  subtitle: {
    fontSize: 13,
    color: "#64748b",
    margin: "0 0 28px",
  },
  error: {
    background: "#ef444415",
    border: "1px solid #ef444430",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 12,
    color: "#ef4444",
    marginBottom: 16,
  },
  field: { marginBottom: 16 },
  label: {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    color: "#94a3b8",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  input: {
    width: "100%",
    padding: "11px 14px",
    borderRadius: 10,
    border: "1px solid #1e2130",
    background: "#0d0f18",
    color: "#f1f5f9",
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
    transition: "border-color 0.2s",
  },
  btn: {
    width: "100%",
    padding: "12px",
    borderRadius: 10,
    border: "none",
    background: "linear-gradient(135deg,#379AAB,#2a7a89)",
    color: "#fff",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    marginTop: 8,
    fontFamily: "inherit",
    transition: "opacity 0.2s",
  },
  divider: {
    textAlign: "center",
    color: "#1e2130",
    fontSize: 12,
    margin: "18px 0",
    position: "relative",
    borderTop: "1px solid #1e2130",
    paddingTop: 0,
  },
  secondary: {
    width: "100%",
    padding: "11px",
    borderRadius: 10,
    border: "1px solid #1e2130",
    background: "transparent",
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  footer: {
    textAlign: "center",
    fontSize: 11,
    color: "#2d3748",
    marginTop: 24,
    marginBottom: 0,
  },
  link: {
    background: "none",
    border: "none",
    color: "#379AAB",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },
};