import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import AdminPage from "./pages/AdminPage";
import CoachingHub from "./pages/CoachingHub";

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authView, setAuthView] = useState("login"); // "login" | "register"
  const [showAdmin, setShowAdmin] = useState(false);

  // Listen for auth changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else { setProfile(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (!error) setProfile(data);
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setShowAdmin(false);
    setAuthView("login");
  };

  // Loading spinner
  if (loading) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", background: "#0a0c14",
        fontFamily: "'Poppins',sans-serif",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>
            <svg viewBox="0 0 40 40" width="48" height="48" fill="none">
              <path d="M6 34 L20 8 L26 18 L14 34 Z" fill="#379AAB" opacity="0.45"/>
              <path d="M14 34 L26 18 L32 28 L22 34 Z" fill="#379AAB" opacity="0.72"/>
              <path d="M22 34 L32 28 L38 34 Z" fill="#379AAB"/>
            </svg>
          </div>
          <div style={{ fontSize: 13, color: "#64748b" }}>Loading...</div>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!session) {
    return authView === "login"
      ? <LoginPage onSwitch={() => setAuthView("register")} />
      : <RegisterPage onSwitch={() => setAuthView("login")} />;
  }

  // Logged in but pending role
  if (!profile || profile.role === "pending") {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", background: "#0a0c14",
        fontFamily: "'Poppins',sans-serif", padding: 20,
      }}>
        <div style={{
          background: "#13151f", border: "1px solid #1e2130",
          borderRadius: 20, padding: "40px 36px", maxWidth: 400, width: "100%",
          textAlign: "center", boxShadow: "0 40px 80px #00000060",
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9", marginBottom: 10 }}>
            Account Pending
          </h2>
          <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.7, marginBottom: 8 }}>
            Welcome, <strong style={{ color: "#f1f5f9" }}>{profile?.full_name || session.user.email}</strong>!
          </p>
          <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.7, marginBottom: 28 }}>
            Your account is waiting for an administrator to assign your role.
            Please check back shortly or contact your team lead.
          </p>
          <button onClick={handleLogout} style={{
            padding: "10px 24px", borderRadius: 9,
            border: "1px solid #1e2130", background: "transparent",
            color: "#94a3b8", fontSize: 13, cursor: "pointer", fontFamily: "inherit",
          }}>
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Admin panel (only Manager can access)
  if (showAdmin && profile.role === "Manager") {
    return <AdminPage onBack={() => setShowAdmin(false)} />;
  }

  // Main Hub
  return (
    <CoachingHub
      userProfile={profile}
      onLogout={handleLogout}
      onOpenAdmin={profile.role === "Manager" ? () => setShowAdmin(true) : null}
    />
  );
}