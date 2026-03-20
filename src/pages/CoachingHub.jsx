// src/pages/CoachingHub.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * ROLES (exact spelling)
 * - "Admin"
 * - "Manager"
 * - "HR"
 * - "Team Lead"
 * - "Specialist"
 *
 * Notes:
 * - If userProfile.role is null/empty => user is "Pending" until Admin assigns.
 * - This file keeps Coaching flow + Warning approval flow.
 * - Data is local state for now (clean/empty). Later you can wire to Supabase tables.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Helpers / Styles
// ─────────────────────────────────────────────────────────────────────────────
const ROLES = ["Admin", "Manager", "HR", "Team Lead", "Specialist"];

const EWS_OPTIONS = ["Green", "Yellow", "Red", "Imminent"];

const STATUS_STYLE = {
  Pending: { bg: "#f59e0b18", text: "#f59e0b", dot: "#f59e0b" },
  Delivered: { bg: "#3b82f618", text: "#3b82f6", dot: "#3b82f6" },
  Acknowledged: { bg: "#10b98118", text: "#10b981", dot: "#10b981" },
};

const EWS_STYLE = {
  Green: { bg: "#10b98120", text: "#10b981" },
  Yellow: { bg: "#f59e0b20", text: "#f59e0b" },
  Red: { bg: "#ef444420", text: "#ef4444" },
  Imminent: { bg: "#7c3aed20", text: "#a78bfa" },
};

const WARNING_STYLE = {
  "Verbal Warning": { color: "#f59e0b", bg: "#f59e0b15", icon: "⚠️" },
  "Written Warning": { color: "#ef4444", bg: "#ef444415", icon: "📝" },
  "Final Warning": { color: "#7c3aed", bg: "#7c3aed15", icon: "🚨" },
};

const TYPE_COLOR = {
  Performance: "#6366f1",
  Attendance: "#f59e0b",
  "Attrition Risk": "#ef4444",
};

const CLIENT_DEPTS = {
  Gemini:    ["UOS", "CNR", "EDR", "Vouchers", "Record Review", "Record Retrieval", "OSS"],
  Equicopy:  ["Record Retrieval"],
  Unisource: ["Record Retrieval"],
};
const CLIENTS_LIST = Object.keys(CLIENT_DEPTS);

// Normalize DB snake_case → UI camelCase
const normCoaching = (r) => {
  const extra = r.extra_data || {};
  return {
    ...r,
    agentName:       r.agent_name       ?? r.agentName ?? "",
    tlName:          r.tl_name          ?? r.tlName ?? "",
    expectedBehavior:r.expected_behavior?? r.expectedBehavior ?? "",
    actionPlan:      r.action_plan      ?? r.actionPlan ?? "",
    followUpDate:    r.follow_up_date   ?? r.followUpDate ?? "",
    supervisorNotes: r.supervisor_notes ?? r.supervisorNotes ?? "",
    agentRating:     r.agent_rating     ?? r.agentRating ?? null,
    agentComment:    r.agent_comment    ?? r.agentComment ?? "",
    // Spread all extra_data fields to top level
    ...extra,
  };
};

const normWarning = (r) => ({
  ...r,
  agentName:          r.agent_name          ?? r.agentName ?? "",
  createdBy:          r.created_by          ?? r.createdBy ?? "",
  warningType:        r.warning_type        ?? r.warningType ?? "",
  situationDesc:      r.situation_desc      ?? r.situationDesc ?? "",
  unfulfilledExp:     r.unfulfilled_exp     ?? r.unfulfilledExp ?? "",
  followUpPeriod:     r.follow_up_period    ?? r.followUpPeriod ?? "",
  areasOfConcern:     r.areas_of_concern    ?? r.areasOfConcern ?? "",
  recommendedActions: r.recommended_actions ?? r.recommendedActions ?? "",
  employeeStatement:  r.employee_statement  ?? r.employeeStatement ?? "",
  witness1Name:       r.witness1_name       ?? r.witness1Name ?? "",
  witness2Name:       r.witness2_name       ?? r.witness2Name ?? "",
});

const normTriad = (r) => ({
  ...r,
  managerName:       r.manager_name        ?? r.managerName ?? "",
  tlName:            r.tl_name             ?? r.tlName ?? "",
  agentName:         r.agent_name          ?? r.agentName ?? "",
  coachingId:        r.coaching_id         ?? r.coachingId ?? null,
  areasOfImprovement:r.areas_of_improvement?? r.areasOfImprovement ?? "",
  actionPlan:        r.action_plan         ?? r.actionPlan ?? "",
  followUpDate:      r.follow_up_date      ?? r.followUpDate ?? "",
  tlRating:          r.tl_rating           ?? r.tlRating ?? null,
  tlComment:         r.tl_comment          ?? r.tlComment ?? "",
  acknowledgedAt:    r.acknowledged_at     ?? r.acknowledgedAt ?? null,
});

// Sample data structure for Team Leads and Agents
const DATABASE = {
  teamLeads: [
    { id: "1", name: "Jorge Gomez", client: "Amalga Group", agents: [] },
  ],
};

const CURRENT_TL = DATABASE.teamLeads[0] || { name: "Manager", id: "1" };

const inp = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 8,
  border: "1px solid #1e2130",
  background: "#0d0f18",
  color: "#e2e8f0",
  fontSize: 13,
  boxSizing: "border-box",
  outline: "none",
  fontFamily: "inherit",
};

const ta = { ...inp, resize: "vertical", minHeight: 80, lineHeight: 1.6 };

// Theme-aware input/textarea helpers
const inpStyle = (T) => ({ ...inp, background: T.inputBg, color: T.text, border: `1px solid ${T.border}` });
const taStyle  = (T) => ({ ...ta,  background: T.inputBg, color: T.text, border: `1px solid ${T.border}` });

function safeInitials(name) {
  return (name || "U")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function Avatar({ name, size = 32, color = "#6366f1" }) {
  const i = safeInitials(name);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `linear-gradient(135deg,${color},${color}bb)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.34,
        fontWeight: 700,
        color: "#fff",
        flexShrink: 0,
      }}
    >
      {i}
    </div>
  );
}

function Field({ label, required, hint, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          display: "block",
          fontSize: 11,
          fontWeight: 700,
          color: "#94a3b8",
          marginBottom: 5,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
        }}
      >
        {label}
        {required && <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>}
      </label>
      {hint && (
        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6, fontStyle: "italic" }}>
          {hint}
        </div>
      )}
      {children}
    </div>
  );
}

function RadioGroup({ options, value, onChange, colors = {}, T = THEMES.dark }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
      {options.map((opt) => {
        const c = colors[opt] || "#14b8a6";
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            style={{
              padding: "6px 13px",
              borderRadius: 8,
              border: `1.5px solid ${active ? c : T.border}`,
              background: active ? c + "22" : "transparent",
              color: active ? c : T.muted,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function BulletInput({ value, onChange, placeholder, T = THEMES.dark }) {
  const lines = value ? value.split("\n") : [""];
  const updateLine = (i, v) => {
    const updated = [...lines];
    updated[i] = v;
    onChange(updated.join("\n"));
  };
  const addLine = () => onChange((value || "") + "\n");
  const removeLine = (i) => {
    const updated = lines.filter((_, idx) => idx !== i);
    onChange(updated.join("\n"));
  };
  return (
    <div>
      {lines.map((line, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <span style={{ color: "#14b8a6", fontSize: 14, flexShrink: 0 }}>•</span>
          <input
            value={line}
            onChange={(e) => updateLine(i, e.target.value)}
            placeholder={placeholder}
            style={{ ...inpStyle(T), flex: 1, padding: "7px 10px" }}
          />
          {lines.length > 1 && (
            <button
              type="button"
              onClick={() => removeLine(i)}
              style={{
                background: "none",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                fontSize: 16,
                padding: "0 4px",
              }}
            >
              ×
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={addLine}
        style={{
          fontSize: 11,
          color: "#14b8a6",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "2px 0",
          marginTop: 2,
        }}
      >
        + Add item
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Coaching Detail Modal (Specialist)
/// ────────────────────────────────────────────────────────────────────────────
function CoachingDetailModal({ coaching, onClose, onAcknowledge, isAgent = false, T = THEMES.dark }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const acknowledged = coaching.status === "Acknowledged" || submitted;

  const handleAcknowledge = () => {
    onAcknowledge(coaching.id, rating, comment);
    setSubmitted(true);
    setTimeout(onClose, 900);
  };

  const tc = TYPE_COLOR[coaching.type] || "#64748b";
  const ews = EWS_STYLE[coaching.ews] || {};

  const Section = ({ title, content, isBullets }) => (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "#14b8a6",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      {isBullets ? (
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {(content || "")
            .split("\n")
            .filter((l) => l.trim())
            .map((l, i) => (
              <li key={i} style={{ fontSize: 13, color: T.sub, marginBottom: 4, lineHeight: 1.6 }}>
                {l}
              </li>
            ))}
        </ul>
      ) : (
        <div style={{ fontSize: 13, color: T.sub, lineHeight: 1.7 }}>
          {content || <span style={{ color: T.muted, fontStyle: "italic" }}>Not specified</span>}
        </div>
      )}
    </div>
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000000cc",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 20,
      }}
    >
      <div
        style={{
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 18,
          width: "100%",
          maxWidth: 600,
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: "20px 26px 16px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                {!isAgent && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: tc, background: tc + "18", padding: "3px 10px", borderRadius: 99 }}>
                    {coaching.type}
                  </span>
                )}
                {!isAgent && coaching.ews && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: ews.text,
                      background: ews.bg,
                      padding: "3px 10px",
                      borderRadius: 99,
                    }}
                  >
                    EWS: {coaching.ews}
                  </span>
                )}
              </div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: T.text }}>Coaching Record</h3>
              <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>
                {coaching.date} · {coaching.dept || "—"}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 20 }}
            >
              ×
            </button>
          </div>
        </div>

        <div style={{ overflowY: "auto", flex: 1, padding: "22px 26px" }}>
          <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
            <div style={{ flex: 1, background: T.bg, borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 10, color: T.muted, marginBottom: 4 }}>SPECIALIST</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Avatar name={coaching.agentName} size={26} color="#6366f1" />
                <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{coaching.agentName}</div>
              </div>
            </div>
            <div style={{ flex: 1, background: T.bg, borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 10, color: T.muted, marginBottom: 4 }}>TEAM LEAD</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Avatar name={coaching.tlName || "—"} size={26} color="#14b8a6" />
                <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{coaching.tlName || "—"}</div>
              </div>
            </div>
          </div>

          {/* ── New coaching types ── */}
          {coaching.type === "General coaching" && (
            <>
              {coaching.mood && <Section title="Mood" content={coaching.mood} />}
              {coaching.kpiPerformance && <Section title="Overall KPI Performance" content={coaching.kpiPerformance} />}
              {coaching.kpisDiscussed && <Section title="Main KPIs Discussed" content={coaching.kpisDiscussed} />}
              {coaching.kpiRiskFlag === "Yes" && coaching.kpiRiskDetail && <Section title="KPI Risk Detail" content={coaching.kpiRiskDetail} />}
              {coaching.prodQualityNotes && <Section title="Productivity / Quality Notes" content={coaching.prodQualityNotes} />}
              {coaching.prodRiskFlag === "Yes" && coaching.prodRiskDetail && <Section title="Productivity / Quality Risk" content={coaching.prodRiskDetail} />}
              {coaching.genAttNotes && <Section title="Attendance Notes" content={coaching.genAttNotes} />}
              {coaching.genAttRiskFlag === "Yes" && coaching.genAttRiskDetail && <Section title="Attendance Risk" content={coaching.genAttRiskDetail} />}
            </>
          )}

          {coaching.type === "Productivity" && (
            <>
              {coaching.mood && <Section title="Mood" content={coaching.mood} />}
              {coaching.currentProductivity && <Section title="Current Productivity" content={coaching.currentProductivity} />}
              {coaching.productivityQuality && <Section title="Productivity Quality" content={coaching.productivityQuality} />}
              {coaching.rootCause && <Section title="Root Cause" content={coaching.rootCause} />}
              {coaching.prodComment && <Section title="Additional Comments" content={coaching.prodComment} />}
              {coaching.agentCommit && <Section title="Agent's Commitment" content={coaching.agentCommit} />}
              {coaching.tlCommit && <Section title="Team Lead Commitment" content={coaching.tlCommit} />}
            </>
          )}

          {coaching.type === "Attendance" && (
            coaching.attendanceProblem ? (
              <>
                {coaching.mood && <Section title="Mood" content={coaching.mood} />}
                <Section title="Attendance Problem" content={coaching.attendanceProblem} />
                {coaching.attRootCause && <Section title="Root Cause" content={coaching.attRootCause} />}
                {coaching.agentCommit && <Section title="Agent's Commitment" content={coaching.agentCommit} />}
                {coaching.tlCommit && <Section title="Team Lead Commitment" content={coaching.tlCommit} />}
              </>
            ) : (
              <>
                <Section title="Incident Type" content={coaching.incidence_type} />
                <Section title="Number of Incidents" content={coaching.incidence_count} />
                {coaching.pattern && <Section title="Pattern Detected" content={coaching.pattern} />}
                {coaching.agent_reason && <Section title="Agent's Explanation" content={coaching.agent_reason} />}
                {coaching.att_agent_commit && <Section title="Agent Commitment" content={coaching.att_agent_commit} />}
                {coaching.att_tl_commit && <Section title="Team Lead Commitment" content={coaching.att_tl_commit} />}
              </>
            )
          )}

          {(coaching.type === "Attrition risk" || coaching.type === "Attrition Risk") && (
            <>
              {coaching.mood && <Section title="Mood" content={coaching.mood} />}
              {(coaching.redFlag || coaching.red_flag) && (
                <Section title="Red Flag" content={
                  (coaching.redFlag || coaching.red_flag) === "Other"
                    ? (coaching.otherReason || coaching.other_reason)
                    : (coaching.redFlag || coaching.red_flag)
                } />
              )}
              {(coaching.companyActions || coaching.company_actions) && <Section title="Company Actions" content={coaching.companyActions || coaching.company_actions} />}
              {(coaching.agentCommit || coaching.att_risk_commit) && <Section title="Agent Commitment" content={coaching.agentCommit || coaching.att_risk_commit} />}
            </>
          )}

          {/* ── Legacy type (Performance) ── */}
          {coaching.type === "Performance" && (
            <>
              <Section title="Reason for Coaching" content={coaching.reason} />
              <Section title="Observations" content={coaching.observations} isBullets />
              <Section title="Expected Behavior" content={coaching.expectedBehavior} isBullets />
              <Section title="Action Plan" content={coaching.actionPlan} isBullets />
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#14b8a6", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Follow-Up</div>
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ background: "#0d0f18", borderRadius: 8, padding: "10px 14px", flex: 1 }}>
                    <div style={{ fontSize: 10, color: "#64748b", marginBottom: 3 }}>FOLLOW-UP DATE</div>
                    <div style={{ fontSize: 13, color: "#e2e8f0" }}>{coaching.followUpDate || "Not set"}</div>
                  </div>
                  <div style={{ background: "#0d0f18", borderRadius: 8, padding: "10px 14px", flex: 2 }}>
                    <div style={{ fontSize: 10, color: "#64748b", marginBottom: 3 }}>SUPERVISOR NOTES</div>
                    <div style={{ fontSize: 13, color: "#e2e8f0" }}>{coaching.supervisorNotes || "—"}</div>
                  </div>
                </div>
              </div>
            </>
          )}

          {coaching.notes && <Section title="Additional Notes" content={coaching.notes} />}

          {!acknowledged && coaching.status === "Delivered" && (
            <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 12, padding: 18, marginTop: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 14 }}>Your Feedback</div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: T.muted, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Rate this coaching session
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setRating(s)}
                      onMouseEnter={() => setHoverRating(s)}
                      onMouseLeave={() => setHoverRating(0)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: 28,
                        color: s <= (hoverRating || rating) ? "#f59e0b" : T.border,
                        padding: 0,
                        transition: "color 0.1s",
                      }}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: T.muted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Comments (optional)
                </div>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Share your thoughts..."
                  style={{ ...taStyle(T), minHeight: 70 }}
                />
              </div>

              <button
                type="button"
                onClick={handleAcknowledge}
                disabled={rating <= 0}
                style={{
                  width: "100%",
                  padding: "11px",
                  borderRadius: 9,
                  border: "none",
                  background: rating > 0 ? "linear-gradient(135deg,#14b8a6,#0d9488)" : T.border,
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: rating > 0 ? "pointer" : "not-allowed",
                  opacity: rating > 0 ? 1 : 0.7,
                }}
              >
                ✓ Acknowledge & Submit
              </button>
            </div>
          )}

          {acknowledged && (
            <div style={{ background: "#10b98115", border: "1px solid #10b98140", borderRadius: 10, padding: 14, textAlign: "center" }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>✅</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#10b981" }}>Coaching Acknowledged</div>
              <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>Thank you for your feedback.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Coaching Modal (Team Lead creates)
// ─────────────────────────────────────────────────────────────────────────────
function WarningDeliveredSection({ form, set, T }) {
  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
      <Field label="Was a warning delivered?">
        <RadioGroup T={T} options={["Yes", "No"]} value={form.warningDelivered} onChange={v => set("warningDelivered", v)} colors={{ Yes: "#ef4444", No: "#10b981" }} />
      </Field>
      {form.warningDelivered === "Yes" && (
        <Field label="Warning Type" required>
          <RadioGroup T={T} options={["Verbal Warning", "Written Warning", "Final Warning"]} value={form.warningType} onChange={v => set("warningType", v)} colors={{ "Verbal Warning": "#f59e0b", "Written Warning": "#ef4444", "Final Warning": "#7c3aed" }} />
        </Field>
      )}
    </div>
  );
}

function CoachingModal({ onClose, onSave, agentsForDropdown = [], clientProfiles = [], initialForm = null, onDraftChange, T = THEMES.dark }) {
  const defaultForm = {
    client: "", dept: "", agentName: "",
    date: new Date().toISOString().split("T")[0],
    coachingReason: "",
    // Shared
    mood: "", ews: "", notes: "",
    // General coaching
    kpiPerformance: "", kpisDiscussed: "", kpiRiskFlag: "", kpiRiskDetail: "",
    prodQualityNotes: "", prodRiskFlag: "", prodRiskDetail: "",
    genAttNotes: "", genAttRiskFlag: "", genAttRiskDetail: "",
    // Productivity
    currentProductivity: "", productivityQuality: "", rootCause: "", prodComment: "",
    agentCommit: "", tlCommit: "",
    // Attendance
    attendanceProblem: "", attRootCause: "",
    // Attrition risk
    redFlag: "", otherReason: "", companyActions: "",
    // Warning section (all types)
    warningDelivered: "", warningType: "",
    // Top agent nomination
    topAgent: "",
  };

  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm || defaultForm);

  const set = (k, v) => setForm((f) => {
    const updated = { ...f, [k]: v };
    if (onDraftChange) onDraftChange(updated);
    return updated;
  });

  const deptsForClient = form.client ? (CLIENT_DEPTS[form.client] || []) : [];
  const agentsForClient = clientProfiles.filter(p =>
    p.role === "Agent" &&
    (!form.client || p.client === form.client) &&
    (!form.dept || p.dept === form.dept)
  );

  // Theme-aware input styles
  const inpT = { ...inp, background: T.inputBg, color: T.text, border: `1px solid ${T.border}` };
  const taT = { ...ta, background: T.inputBg, color: T.text, border: `1px solid ${T.border}` };

  const MOOD_OPTIONS_GENERAL = ["Excited!", "Happy!", "Neutral", "Focused", "Unmotivated", "Other"];
  const MOOD_OPTIONS = ["Excited!", "Happy!", "Neutral", "Focused"];
  const REASON_COLORS = { "General coaching": "#14b8a6", Productivity: "#6366f1", Attendance: "#f59e0b", "Attrition risk": "#ef4444" };

  const canNext1 = !!(form.client && form.dept && form.agentName && form.date && form.coachingReason);

  const canNext2 = (() => {
    switch (form.coachingReason) {
      case "General coaching":
        return !!(form.mood && form.kpiPerformance && form.kpisDiscussed);
      case "Productivity":
        return !!(form.mood && form.currentProductivity && form.productivityQuality && form.rootCause && form.agentCommit && form.tlCommit);
      case "Attendance":
        return !!(form.mood && form.attendanceProblem && form.attRootCause && form.agentCommit && form.tlCommit);
      case "Attrition risk":
        return !!(form.mood && form.redFlag && form.companyActions && (form.redFlag !== "Other" || form.otherReason));
      default: return false;
    }
  })();

  const canNext = step === 1 ? canNext1 : canNext2;

  return (
    <div style={{ padding: "24px 26px", maxWidth: 700, margin: "0 auto" }}>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 18, display: "flex", flexDirection: "column" }}>

        {/* Header + stepper */}
        <div style={{ padding: "20px 26px 14px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <button type="button" onClick={onClose} style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 8, color: T.muted, cursor: "pointer", fontSize: 12, padding: "5px 12px", fontFamily: "inherit" }}>
              ← Back
            </button>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: T.text }}>New Coaching</h3>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {["Basic Info", form.coachingReason || "Reason", "Close Out"].map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: step >= i + 1 ? "#14b8a6" : T.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: step >= i + 1 ? "#fff" : T.muted }}>
                  {i + 1}
                </div>
                <span style={{ fontSize: 11, color: step === i + 1 ? "#14b8a6" : "#64748b", fontWeight: step === i + 1 ? 700 : 400 }}>{s}</span>
                {i < 2 && <div style={{ width: 16, height: 1, background: T.border }} />}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 26px" }}>

          {/* ── Step 1: Basic Info ── */}
          {step === 1 && (
            <>
              <Field label="Client" required>
                <select value={form.client} onChange={(e) => { set("client", e.target.value); set("dept", ""); set("agentName", ""); }} style={inpT}>
                  <option value="">Select a client...</option>
                  {CLIENTS_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              {form.client && (
                <Field label="Department" required>
                  <select value={form.dept} onChange={(e) => { set("dept", e.target.value); set("agentName", ""); }} style={inpT}>
                    <option value="">Select a department...</option>
                    {deptsForClient.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </Field>
              )}
              {form.dept && (
                <Field label="Specialist" required hint={agentsForClient.length ? `${agentsForClient.length} specialist(s) in ${form.dept}` : "No specialists registered for this department yet"}>
                  {agentsForClient.length ? (
                    <select value={form.agentName} onChange={e => set("agentName", e.target.value)} style={inpT}>
                      <option value="">Select a specialist...</option>
                      {agentsForClient.map(a => <option key={a.id} value={a.full_name}>{a.full_name}</option>)}
                    </select>
                  ) : (
                    <input value={form.agentName} onChange={e => set("agentName", e.target.value)} placeholder="Type specialist name..." style={inpT} />
                  )}
                </Field>
              )}
              <Field label="Date" required>
                <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} style={inpT} />
              </Field>
              <Field label="Coaching Reason" required>
                <RadioGroup T={T} options={["General coaching", "Productivity", "Attendance", "Attrition risk"]} value={form.coachingReason} onChange={(v) => set("coachingReason", v)} colors={REASON_COLORS} />
              </Field>
            </>
          )}

          {/* ── Step 2: General coaching ── */}
          {step === 2 && form.coachingReason === "General coaching" && (
            <>
              <Field label="How is the agent's mood in general?" required>
                <RadioGroup T={T} options={MOOD_OPTIONS_GENERAL} value={form.mood} onChange={v => set("mood", v)} />
              </Field>
              <Field label="Overall KPI Performance" required>
                <RadioGroup T={T} options={["Exceeds", "Meets", "Needs Improvement", "Below"]} value={form.kpiPerformance} onChange={v => set("kpiPerformance", v)} colors={{ Exceeds: "#10b981", Meets: "#14b8a6", "Needs Improvement": "#f59e0b", Below: "#ef4444" }} />
              </Field>
              <Field label="Main KPIs Discussed" required>
                <RadioGroup T={T} options={["Productivity", "Quality", "Attendance", "Timeliness", "Other"]} value={form.kpisDiscussed} onChange={v => set("kpisDiscussed", v)} />
              </Field>
              <Field label="Is there a risk flag on the KPI section?">
                <RadioGroup T={T} options={["Yes", "No"]} value={form.kpiRiskFlag} onChange={v => set("kpiRiskFlag", v)} colors={{ Yes: "#ef4444", No: "#10b981" }} />
              </Field>
              {form.kpiRiskFlag === "Yes" && (
                <Field label="KPI Risk — Detail">
                  <textarea value={form.kpiRiskDetail} onChange={e => set("kpiRiskDetail", e.target.value)} placeholder="Describe the risk..." style={taT} />
                </Field>
              )}
              <Field label="Productivity / Quality Notes">
                <textarea value={form.prodQualityNotes} onChange={e => set("prodQualityNotes", e.target.value)} placeholder="Any notes on productivity or quality..." style={taT} />
              </Field>
              <Field label="Is there a risk flag on Productivity / Quality?">
                <RadioGroup T={T} options={["Yes", "No"]} value={form.prodRiskFlag} onChange={v => set("prodRiskFlag", v)} colors={{ Yes: "#ef4444", No: "#10b981" }} />
              </Field>
              {form.prodRiskFlag === "Yes" && (
                <Field label="Productivity / Quality Risk — Detail">
                  <textarea value={form.prodRiskDetail} onChange={e => set("prodRiskDetail", e.target.value)} placeholder="Describe the risk..." style={taT} />
                </Field>
              )}
              <Field label="Attendance Notes">
                <textarea value={form.genAttNotes} onChange={e => set("genAttNotes", e.target.value)} placeholder="Any notes on attendance..." style={taT} />
              </Field>
              <Field label="Is there a risk flag on Attendance?">
                <RadioGroup T={T} options={["Yes", "No"]} value={form.genAttRiskFlag} onChange={v => set("genAttRiskFlag", v)} colors={{ Yes: "#ef4444", No: "#10b981" }} />
              </Field>
              {form.genAttRiskFlag === "Yes" && (
                <Field label="Attendance Risk — Detail">
                  <textarea value={form.genAttRiskDetail} onChange={e => set("genAttRiskDetail", e.target.value)} placeholder="Describe the risk..." style={taT} />
                </Field>
              )}
              <WarningDeliveredSection form={form} set={set} T={T} />
            </>
          )}

          {/* ── Step 2: Productivity ── */}
          {step === 2 && form.coachingReason === "Productivity" && (
            <>
              <Field label="How is the agent's mood in general?" required>
                <RadioGroup T={T} options={MOOD_OPTIONS} value={form.mood} onChange={v => set("mood", v)} />
              </Field>
              <Field label="What is their current productivity?" required>
                <select value={form.currentProductivity} onChange={e => set("currentProductivity", e.target.value)} style={inpT}>
                  <option value="">Choose...</option>
                  {["0-20 cases a day", "20 to 30 cases a day", "30 to 40", "40 to 50", "50 to 60", "Above 60"].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="How about the Productivity Quality?" required>
                <select value={form.productivityQuality} onChange={e => set("productivityQuality", e.target.value)} style={inpT}>
                  <option value="">Choose...</option>
                  {["Good productivity quality", "Bad PQ: Copy and paste", "Bad PQ: No calls received", "Bad PQ: No notes at the shift starting time", "Bad PQ: No notes before end of shift", "Other (Not following procedures)"].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Root cause for this behaviour?" required>
                <RadioGroup T={T} options={["Attitude", "Knowledge", "Skill", "Unclear client processes"]} value={form.rootCause} onChange={v => set("rootCause", v)} />
              </Field>
              <Field label="Any other comment about Productivity or PQ?">
                <textarea value={form.prodComment} onChange={e => set("prodComment", e.target.value)} placeholder="Optional comment..." style={taT} />
              </Field>
              <Field label="What is the agent's commitment for the next review?" required>
                <textarea value={form.agentCommit} onChange={e => set("agentCommit", e.target.value)} placeholder="Agent's commitment..." style={taT} />
              </Field>
              <Field label="What is the Team Leader's commitment for the next review?" required>
                <textarea value={form.tlCommit} onChange={e => set("tlCommit", e.target.value)} placeholder="TL commitment..." style={taT} />
              </Field>
              <WarningDeliveredSection form={form} set={set} T={T} />
            </>
          )}

          {/* ── Step 2: Attendance ── */}
          {step === 2 && form.coachingReason === "Attendance" && (
            <>
              <Field label="How is the agent's mood in general?" required>
                <RadioGroup T={T} options={MOOD_OPTIONS} value={form.mood} onChange={v => set("mood", v)} />
              </Field>
              <Field label="What is the attendance problem we are facing?" required>
                <RadioGroup T={T} options={["Absenteeism", "Tardiness", "Unjustified disconnection throughout the day", "Other"]} value={form.attendanceProblem} onChange={v => set("attendanceProblem", v)} />
              </Field>
              <Field label="What is the root cause for this behavior?" required>
                <textarea value={form.attRootCause} onChange={e => set("attRootCause", e.target.value)} placeholder="Root cause..." style={taT} />
              </Field>
              <Field label="What is the agent's commitment?" required>
                <textarea value={form.agentCommit} onChange={e => set("agentCommit", e.target.value)} placeholder="Agent's commitment..." style={taT} />
              </Field>
              <Field label="What is the Team Lead commitment?" required>
                <textarea value={form.tlCommit} onChange={e => set("tlCommit", e.target.value)} placeholder="TL commitment..." style={taT} />
              </Field>
              <WarningDeliveredSection form={form} set={set} T={T} />
            </>
          )}

          {/* ── Step 2: Attrition risk ── */}
          {step === 2 && form.coachingReason === "Attrition risk" && (
            <>
              <Field label="How is the agent's mood in general?" required>
                <RadioGroup T={T} options={MOOD_OPTIONS} value={form.mood} onChange={v => set("mood", v)} />
              </Field>
              <Field label="What is the red flag we noticed?" required>
                <RadioGroup T={T} options={["Absenteeism", "Lateness", "Low performance", "Attitude", "Salary not enough", "Health issues", "Other"]} value={form.redFlag} onChange={v => set("redFlag", v)} />
              </Field>
              {form.redFlag === "Other" && (
                <Field label="If other, what is the reason?" required>
                  <input value={form.otherReason} onChange={e => set("otherReason", e.target.value)} placeholder="Specify reason..." style={inpT} />
                </Field>
              )}
              <Field label="What actions are we going to take as a company to help resolve the root cause?" required>
                <textarea value={form.companyActions} onChange={e => set("companyActions", e.target.value)} placeholder="Company actions..." style={taT} />
              </Field>
              <Field label="Agent's commitment to avoid it happening again?">
                <textarea value={form.agentCommit} onChange={e => set("agentCommit", e.target.value)} placeholder="Agent's commitment..." style={taT} />
              </Field>
              <WarningDeliveredSection form={form} set={set} T={T} />
            </>
          )}

          {/* ── Step 3: Close Out ── */}
          {step === 3 && (
            <>
              <Field label="EWS Status" required>
                <RadioGroup T={T} options={EWS_OPTIONS} value={form.ews} onChange={v => set("ews", v)} colors={{ Green: "#10b981", Yellow: "#f59e0b", Red: "#ef4444", Imminent: "#7c3aed" }} />
              </Field>
              <Field label="⭐ Nominate as Top Agent?" hint="Recognize this specialist's outstanding performance this period">
                <RadioGroup T={T} options={["Yes", "No"]} value={form.topAgent} onChange={v => set("topAgent", v)} colors={{ Yes: "#f59e0b", No: "#64748b" }} />
              </Field>
              <Field label="Free text space for any other comment or summary.">
                <textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Any additional notes..." style={{ ...taT, minHeight: 100 }} />
              </Field>
              <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Summary</div>
                {[
                  ["Specialist", form.agentName],
                  ["Department", form.dept],
                  ["Date", form.date],
                  ["Coaching Reason", form.coachingReason],
                  ["Mood", form.mood],
                  ["Warning Delivered", form.warningDelivered],
                  ["Warning Type", form.warningDelivered === "Yes" ? form.warningType : null],
                  ["EWS", form.ews],
                  ["Top Agent", form.topAgent || null],
                ].map(([k, v]) => v ? (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
                    <span style={{ color: T.muted }}>{k}</span>
                    <span style={{ color: T.text, fontWeight: 500 }}>{v}</span>
                  </div>
                ) : null)}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 26px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 8, flexShrink: 0 }}>
          <button type="button" onClick={onClose} style={{ padding: "9px 18px", borderRadius: 8, border: `1px solid ${T.border}`, background: "transparent", color: T.muted, fontSize: 12, cursor: "pointer" }}>
            Cancel
          </button>
          {step > 1 && (
            <button type="button" onClick={() => setStep(s => s - 1)} style={{ padding: "9px 18px", borderRadius: 8, border: `1px solid ${T.border}`, background: "transparent", color: T.muted, fontSize: 12, cursor: "pointer" }}>
              ← Back
            </button>
          )}
          <div style={{ flex: 1 }} />
          {step < 3 ? (
            <button type="button" onClick={() => setStep(s => s + 1)} disabled={!canNext}
              style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: canNext ? "linear-gradient(135deg,#14b8a6,#0d9488)" : T.border, color: canNext ? "#fff" : T.muted, fontSize: 12, fontWeight: 600, cursor: canNext ? "pointer" : "not-allowed" }}>
              Next →
            </button>
          ) : (
            <button type="button" onClick={() => { onSave(form); onClose(); }} disabled={!form.ews}
              style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: form.ews ? "linear-gradient(135deg,#14b8a6,#0d9488)" : T.border, color: form.ews ? "#fff" : T.muted, fontSize: 12, fontWeight: 600, cursor: form.ews ? "pointer" : "not-allowed" }}>
              Save Coaching ✓
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Warning Modal (Team Lead creates)
// ─────────────────────────────────────────────────────────────────────────────
function WarningModal({ onClose, onSave, agentsForDropdown = [], clientProfiles = [], initialForm = null, onDraftChange, T = THEMES.dark }) {
  const defaultForm = {
    client: "", agentName: "", dept: "",
    date: new Date().toISOString().split("T")[0],
    warningType: "", situationDesc: "", unfulfilledExp: "", followUpPeriod: "",
    areasOfConcern: "", recommendedActions: "",
    facts: "", employeeStatement: "", witness1Name: "", witness2Name: "",
  };
  const [form, setForm] = useState(initialForm || defaultForm);

  const set = (k, v) => setForm((f) => {
    const updated = { ...f, [k]: v };
    if (onDraftChange) onDraftChange(updated);
    return updated;
  });

  // Departments for selected client
  const deptsForClient = form.client ? (CLIENT_DEPTS[form.client] || []) : [];

  // Filter agents by client AND department
  const agentsForClient = clientProfiles.filter(p =>
    p.role === "Agent" &&
    (!form.client || p.client === form.client) &&
    (!form.dept || p.dept === form.dept)
  );

  const canSave = form.client && form.dept && form.agentName && form.warningType && form.date;

  return (
    <div style={{ padding: "24px 26px", maxWidth: 700, margin: "0 auto" }}>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 18, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "20px 26px 14px", borderBottom: `1px solid ${T.border}`, flexShrink: 0, display: "flex", alignItems: "center", gap: 12 }}>
          <button type="button" onClick={onClose} style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 8, color: T.muted, cursor: "pointer", fontSize: 12, padding: "5px 12px", fontFamily: "inherit" }}>
            ← Back
          </button>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: T.text }}>🚨 Disciplinary Action</h3>
        </div>

        <div style={{ padding: "20px 26px" }}>
          <Field label="Warning Type" required>
            <div style={{ display: "flex", gap: 8 }}>
              {Object.entries(WARNING_STYLE).map(([type, s]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => set("warningType", type)}
                  style={{
                    flex: 1,
                    padding: "10px 6px",
                    borderRadius: 10,
                    border: `1.5px solid ${form.warningType === type ? s.color : "#1e2130"}`,
                    background: form.warningType === type ? s.bg : "transparent",
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 18, marginBottom: 3 }}>{s.icon}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: form.warningType === type ? s.color : "#64748b" }}>{type}</div>
                </button>
              ))}
            </div>
          </Field>

          <Field label="Client" required>
            <select
              value={form.client}
              onChange={(e) => { set("client", e.target.value); set("dept", ""); set("agentName", ""); }}
              style={inp}
            >
              <option value="">Select a client...</option>
              {CLIENTS_LIST.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>

          {form.client && (
            <Field label="Department" required>
              <select
                value={form.dept}
                onChange={(e) => { set("dept", e.target.value); set("agentName", ""); }}
                style={inp}
              >
                <option value="">Select a department...</option>
                {deptsForClient.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
          )}

          {form.dept && (
            <Field
              label="Specialist"
              required
              hint={agentsForClient.length ? `${agentsForClient.length} specialist(s) in ${form.dept}` : "No specialists registered for this department yet"}
            >
              {agentsForClient.length ? (
                <select value={form.agentName} onChange={e => set("agentName", e.target.value)} style={inp}>
                  <option value="">Select a specialist...</option>
                  {agentsForClient.map(a => <option key={a.id} value={a.full_name}>{a.full_name}</option>)}
                </select>
              ) : (
                <input value={form.agentName} onChange={e => set("agentName", e.target.value)} placeholder="Type specialist name..." style={inp} />
              )}
            </Field>
          )}

          <Field label="Date" required>
            <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} style={inp} />
          </Field>

          {form.warningType === "Verbal Warning" &&
            [
              { k: "situationDesc", l: "Objective Description of the Situation", p: "Describe what happened..." },
              { k: "unfulfilledExp", l: "Unfulfilled Expectation", p: "What expectation was not met?" },
              { k: "followUpPeriod", l: "Follow-Up Period", p: "e.g. 30 days, 2 weeks..." },
            ].map((f) => (
              <Field key={f.k} label={f.l} required>
                {f.k === "followUpPeriod" ? (
                  <input value={form[f.k]} onChange={(e) => set(f.k, e.target.value)} placeholder={f.p} style={inp} />
                ) : (
                  <textarea value={form[f.k]} onChange={(e) => set(f.k, e.target.value)} placeholder={f.p} style={ta} />
                )}
              </Field>
            ))}

          {form.warningType === "Written Warning" &&
            [
              { k: "areasOfConcern", l: "Areas of Concern", p: "Describe the observed behaviors/performance issues..." },
              { k: "recommendedActions", l: "Recommended Actions", p: "List the improvement actions..." },
            ].map((f) => (
              <Field key={f.k} label={f.l} required>
                <textarea value={form[f.k]} onChange={(e) => set(f.k, e.target.value)} placeholder={f.p} style={ta} />
              </Field>
            ))}

          {form.warningType === "Final Warning" &&
            [
              { k: "facts", l: "Facts", p: "Describe the facts that led to this action..." },
              { k: "employeeStatement", l: "Employee Statement", p: "Employee's response or statement..." },
              { k: "witness1Name", l: "Witness 1 Name", p: "" },
              { k: "witness2Name", l: "Witness 2 Name", p: "" },
            ].map((f) => (
              <Field key={f.k} label={f.l} required>
                {f.k.includes("witness") ? (
                  <input value={form[f.k]} onChange={(e) => set(f.k, e.target.value)} placeholder={f.p} style={inp} />
                ) : (
                  <textarea value={form[f.k]} onChange={(e) => set(f.k, e.target.value)} placeholder={f.p} style={ta} />
                )}
              </Field>
            ))}
        </div>

        <div style={{ padding: "14px 26px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 8, justifyContent: "flex-end", flexShrink: 0 }}>
          <button type="button" onClick={onClose} style={{ padding: "9px 18px", borderRadius: 8, border: `1px solid ${T.border}`, background: "transparent", color: T.muted, fontSize: 12, cursor: "pointer" }}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onSave(form);
              onClose();
            }}
            disabled={!canSave}
            style={{
              padding: "9px 22px",
              borderRadius: 8,
              border: "none",
              background: canSave ? "linear-gradient(135deg,#ef4444,#dc2626)" : "#1e2130",
              color: canSave ? "#fff" : "#64748b",
              fontSize: 12,
              fontWeight: 600,
              cursor: canSave ? "pointer" : "not-allowed",
            }}
          >
            Save & Submit ✓
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

// ── THEME SYSTEM ──────────────────────────────────────────────────────────────
const THEMES = {
  dark: {
    bg: "#0d0f18", card: "#13151f", sidebar: "#13151f",
    border: "#1e2130", text: "#f1f5f9", sub: "#e2e8f0",
    muted: "#64748b", hover: "#1a1d2a", headerBg: "#0d0f18",
    inputBg: "#0d0f18", accent: "#379AAB",
  },
  light: {
    bg: "#f4fbfc", card: "#ffffff", sidebar: "#ffffff",
    border: "#e2eef0", text: "#1a2e35", sub: "#2d4a52",
    muted: "#7a9aa3", hover: "#eaf6f8", headerBg: "#ffffff",
    inputBg: "#f4fbfc", accent: "#379AAB",
  },
};

const MONTHS = [
  {val:"01",label:"January"},{val:"02",label:"February"},{val:"03",label:"March"},
  {val:"04",label:"April"},{val:"05",label:"May"},{val:"06",label:"June"},
  {val:"07",label:"July"},{val:"08",label:"August"},{val:"09",label:"September"},
  {val:"10",label:"October"},{val:"11",label:"November"},{val:"12",label:"December"},
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

// ── COACHING COMPLIANCE HELPERS ───────────────────────────────────────────────
function getMonthCoachings(coachings, month, year) {
  return coachings.filter(c => {
    if (!c.date) return false;
    return c.date.slice(0,7) === `${year}-${month}`;
  });
}

function calcCompliance(coachings, month, year, target) {
  if (!target || target === 0) return null;
  const monthC = getMonthCoachings(coachings, month, year);
  const acked = monthC.filter(c => c.status === "Acknowledged").length;
  return { acked, target, pct: Math.min(Math.round((acked / target) * 100), 100) };
}

function complianceColor(pct) {
  if (pct >= 80) return "#10b981";
  if (pct >= 50) return "#f59e0b";
  return "#ef4444";
}

// ── DRILLDOWN MODAL ───────────────────────────────────────────────────────────
function DrilldownModal({ title, coachings, T, onClose, onOpenCoaching }) {
  const [filterMonth, setFilterMonth] = useState("");
  const [filterYear, setFilterYear]   = useState("");
  const [filterType, setFilterType]   = useState("All");
  const [filterEws,  setFilterEws]    = useState("All");

  const years = [...new Set(coachings.map(c => c.date?.slice(0,4)))].filter(Boolean).sort((a,b)=>b-a);

  const filtered = coachings
    .filter(c => !filterMonth || c.date?.slice(5,7) === filterMonth)
    .filter(c => !filterYear  || c.date?.slice(0,4) === filterYear)
    .filter(c => filterType === "All" || c.type === filterType)
    .filter(c => filterEws  === "All" || c.ews  === filterEws);

  const sel = { padding:"5px 9px", borderRadius:7, border:`1px solid ${T.border}`, background:T.inputBg, color:T.text, fontSize:11, outline:"none", fontFamily:"inherit", cursor:"pointer" };

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"#00000099", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, padding:20 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:18, width:"100%", maxWidth:720, maxHeight:"88vh", display:"flex", flexDirection:"column", boxShadow:"0 32px 80px #00000070" }}>
        {/* Header */}
        <div style={{ padding:"18px 22px 14px", borderBottom:`1px solid ${T.border}`, display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
          <div style={{ fontSize:15, fontWeight:700, color:T.text }}>{title}</div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:T.muted, cursor:"pointer", fontSize:20 }}>×</button>
        </div>
        {/* Filters */}
        <div style={{ padding:"12px 22px", borderBottom:`1px solid ${T.border}`, display:"flex", gap:8, flexWrap:"wrap", flexShrink:0 }}>
          <select value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} style={sel}>
            <option value="">All Months</option>
            {MONTHS.map(m=><option key={m.val} value={m.val}>{m.label}</option>)}
          </select>
          <select value={filterYear} onChange={e=>setFilterYear(e.target.value)} style={sel}>
            <option value="">All Years</option>
            {years.map(y=><option key={y} value={y}>{y}</option>)}
          </select>
          {["All","Performance","Attendance","Attrition Risk"].map(t=>(
            <button key={t} onClick={()=>setFilterType(t)} style={{ padding:"4px 10px", borderRadius:6, border:`1px solid ${filterType===t?(TYPE_COLOR[t]||T.accent):T.border}`, background:filterType===t?(TYPE_COLOR[t]||T.accent)+"18":"transparent", color:filterType===t?(TYPE_COLOR[t]||T.accent):T.muted, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>{t}</button>
          ))}
          {["All","Green","Yellow","Red","Imminent"].map(e=>{
            const ec=EWS_STYLE[e]||{text:T.muted,bg:"transparent"};
            return <button key={e} onClick={()=>setFilterEws(e)} style={{ padding:"4px 10px", borderRadius:6, border:`1px solid ${filterEws===e?(ec.text):T.border}`, background:filterEws===e?ec.bg:"transparent", color:filterEws===e?ec.text:T.muted, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>{e}</button>;
          })}
        </div>
        {/* Table */}
        <div style={{ overflowY:"auto", flex:1 }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead style={{ position:"sticky", top:0, background:T.card }}>
              <tr style={{ borderBottom:`1px solid ${T.border}` }}>
                {["Specialist","Type","Date","EWS","Status","Rating"].map(h=>(
                  <th key={h} style={{ padding:"9px 14px", textAlign:"left", fontSize:10, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:"0.05em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length===0
                ? <tr><td colSpan={6} style={{ textAlign:"center", padding:36, color:T.muted, fontSize:13 }}>No coachings found.</td></tr>
                : filtered.map((c,i)=>{
                  const ss=STATUS_STYLE[c.status]||{};
                  const ews=EWS_STYLE[c.ews]||{};
                  const tc=TYPE_COLOR[c.type]||"#64748b";
                  return (
                    <tr key={c.id} style={{ borderBottom:i<filtered.length-1?`1px solid ${T.border}`:"none", cursor:"pointer" }}
                      onClick={()=>{onOpenCoaching(c);onClose();}}
                      onMouseEnter={e=>e.currentTarget.style.background=T.hover}
                      onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <td style={{ padding:"11px 14px" }}>
                        <div style={{ fontSize:12, color:T.text, fontWeight:500 }}>{c.agentName}</div>
                        <div style={{ fontSize:10, color:T.muted }}>{c.dept}</div>
                      </td>
                      <td style={{ padding:"11px 14px" }}><span style={{ fontSize:10, fontWeight:700, color:tc, background:tc+"18", padding:"3px 8px", borderRadius:99 }}>{c.type}</span></td>
                      <td style={{ padding:"11px 14px", fontSize:11, color:T.muted }}>{c.date}</td>
                      <td style={{ padding:"11px 14px" }}>{c.ews&&<span style={{ fontSize:10, fontWeight:700, color:ews.text, background:ews.bg, padding:"3px 8px", borderRadius:99 }}>{c.ews}</span>}</td>
                      <td style={{ padding:"11px 14px" }}><span style={{ fontSize:10, fontWeight:600, color:ss.text, background:ss.bg, padding:"3px 8px", borderRadius:99 }}>{c.status}</span></td>
                      <td style={{ padding:"11px 14px" }}>
                        {c.agentRating
                          ? <div style={{ display:"flex", gap:1 }}>{[1,2,3,4,5].map(s=><span key={s} style={{ fontSize:11, color:s<=c.agentRating?"#f59e0b":T.border }}>★</span>)}</div>
                          : <span style={{ color:T.muted, fontSize:11 }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        <div style={{ padding:"12px 22px", borderTop:`1px solid ${T.border}`, fontSize:11, color:T.muted, flexShrink:0 }}>
          Showing {filtered.length} of {coachings.length} coachings
        </div>
      </div>
    </div>
  );
}

// ── TRIAD DETAIL MODAL (TL acknowledges) ─────────────────────────────────────
function TriadDetailModal({ triad, onClose, onAcknowledge, T = THEMES.dark }) {
  const [rating, setRating] = useState(0);
  const [hover,  setHover]  = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const acked = !!triad.acknowledgedAt || submitted;

  const handleAcknowledge = () => {
    onAcknowledge(triad.id, rating, comment);
    setSubmitted(true);
  };

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"#000000cc", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, padding:20 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:18, width:"100%", maxWidth:620, maxHeight:"92vh", display:"flex", flexDirection:"column" }}>
        <div style={{ padding:"20px 26px 16px", borderBottom:`1px solid ${T.border}`, display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexShrink:0 }}>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:"#14b8a6", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4 }}>Manager Triad</div>
            <h3 style={{ margin:0, fontSize:16, fontWeight:700, color:T.text }}>Triad Review</h3>
            <div style={{ fontSize:12, color:T.muted, marginTop:3 }}>{triad.date} · {triad.agentName || "—"}</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:T.muted, cursor:"pointer", fontSize:20 }}>×</button>
        </div>
        <div style={{ overflowY:"auto", flex:1, padding:"22px 26px" }}>
          <div style={{ display:"flex", gap:16, marginBottom:20 }}>
            <div style={{ flex:1, background:T.bg, borderRadius:10, padding:14 }}>
              <div style={{ fontSize:10, color:T.muted, fontWeight:700, textTransform:"uppercase", marginBottom:4 }}>Manager</div>
              <div style={{ fontSize:13, color:T.text, fontWeight:600 }}>{triad.managerName||"—"}</div>
            </div>
            <div style={{ flex:1, background:T.bg, borderRadius:10, padding:14 }}>
              <div style={{ fontSize:10, color:T.muted, fontWeight:700, textTransform:"uppercase", marginBottom:4 }}>Coaching Reviewed</div>
              <div style={{ fontSize:13, color:T.text, fontWeight:600 }}>{triad.agentName||"—"}</div>
            </div>
          </div>
          {[
            { label:"Strengths Observed", content:triad.strengths },
            { label:"Areas of Improvement", content:triad.areasOfImprovement },
            { label:"Action Plan", content:triad.actionPlan },
          ].map(({ label, content }) => content ? (
            <div key={label} style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#14b8a6", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:8 }}>{label}</div>
              <ul style={{ margin:0, paddingLeft:18 }}>
                {content.split("\n").filter(l=>l.trim()).map((l,i)=>(
                  <li key={i} style={{ fontSize:13, color:T.sub, lineHeight:1.7 }}>{l}</li>
                ))}
              </ul>
            </div>
          ) : null)}
          {(triad.followUpDate || triad.notes) && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:20 }}>
              {triad.followUpDate && (
                <div style={{ background:T.bg, borderRadius:10, padding:14 }}>
                  <div style={{ fontSize:10, color:T.muted, fontWeight:700, textTransform:"uppercase", marginBottom:4 }}>Follow-Up Date</div>
                  <div style={{ fontSize:13, color:T.sub }}>{triad.followUpDate}</div>
                </div>
              )}
              {triad.notes && (
                <div style={{ background:T.bg, borderRadius:10, padding:14 }}>
                  <div style={{ fontSize:10, color:T.muted, fontWeight:700, textTransform:"uppercase", marginBottom:4 }}>Notes</div>
                  <div style={{ fontSize:13, color:T.sub }}>{triad.notes}</div>
                </div>
              )}
            </div>
          )}
          {acked ? (
            <div style={{ background:"#10b98115", border:"1px solid #10b98130", borderRadius:12, padding:16, textAlign:"center" }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#10b981", marginBottom:4 }}>✓ Triad Acknowledged</div>
              {triad.tlRating && <div style={{ display:"flex", justifyContent:"center", gap:2, marginBottom:4 }}>{[1,2,3,4,5].map(s=><span key={s} style={{ fontSize:16, color:s<=triad.tlRating?"#f59e0b":T.border }}>★</span>)}</div>}
              {triad.tlComment && <div style={{ fontSize:12, color:T.muted }}>{triad.tlComment}</div>}
            </div>
          ) : (
            <div style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:12, padding:18 }}>
              <div style={{ fontSize:12, fontWeight:700, color:T.text, marginBottom:14 }}>Your Feedback</div>
              <div style={{ fontSize:11, color:T.muted, marginBottom:8, textTransform:"uppercase", letterSpacing:"0.05em" }}>Rate this triad session</div>
              <div style={{ display:"flex", gap:6, marginBottom:16 }}>
                {[1,2,3,4,5].map(s=>(
                  <span key={s} onClick={()=>setRating(s)} onMouseEnter={()=>setHover(s)} onMouseLeave={()=>setHover(0)}
                    style={{ fontSize:28, cursor:"pointer", color:s<=(hover||rating)?"#f59e0b":T.border, transition:"color 0.1s" }}>★</span>
                ))}
              </div>
              <div style={{ fontSize:11, color:T.muted, marginBottom:6, textTransform:"uppercase", letterSpacing:"0.05em" }}>Comments (optional)</div>
              <textarea value={comment} onChange={e=>setComment(e.target.value)} placeholder="Add your comments..."
                style={{ ...taStyle(T), minHeight:80 }} />
              <button onClick={handleAcknowledge} disabled={!rating}
                style={{ width:"100%", marginTop:14, padding:12, borderRadius:10, border:"none", background:rating?"linear-gradient(135deg,#14b8a6,#0d9488)":T.border, color:rating?"#fff":T.muted, fontSize:14, fontWeight:700, cursor:rating?"pointer":"default", fontFamily:"inherit" }}>
                ✓ Acknowledge & Submit
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── TRIAD MODAL (Manager creates) ─────────────────────────────────────────────
function TriadModal({ onClose, onSave, profiles = [], coachings = [], selfName = "", T = THEMES.dark }) {
  const defaultForm = {
    tlName: "", agentName: "", coachingId: "",
    date: new Date().toISOString().split("T")[0],
    strengths: "", areasOfImprovement: "", actionPlan: "",
    followUpDate: "", notes: "",
  };
  const [form, setForm] = useState(defaultForm);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const allTLs = profiles.filter(p => p.role === "Team Lead");
  const tlCoachings = coachings.filter(c => form.tlName && c.tlName === form.tlName);
  const canSave = form.tlName && form.date && form.strengths;

  const handleSelectCoaching = (coachingId) => {
    const c = coachings.find(c => c.id === coachingId);
    set("coachingId", coachingId);
    if (c) set("agentName", c.agentName);
  };

  return (
    <div style={{ padding:"24px 26px", maxWidth:700, margin:"0 auto" }}>
      <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:24 }}>
        <button onClick={onClose} style={{ padding:"6px 14px", borderRadius:8, border:`1px solid ${T.border}`, background:"transparent", color:T.muted, fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>← Back</button>
        <h2 style={{ fontSize:18, fontWeight:700, color:T.text, margin:0 }}>New Manager Triad</h2>
      </div>

      <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, padding:24, marginBottom:16 }}>
        <div style={{ fontSize:12, fontWeight:700, color:T.accent, marginBottom:18, textTransform:"uppercase", letterSpacing:"0.05em" }}>Basic Info</div>

        <Field label="Team Lead" required>
          <select value={form.tlName} onChange={e=>{ set("tlName", e.target.value); set("coachingId",""); set("agentName",""); }} style={inpStyle(T)}>
            <option value="">Select a Team Lead...</option>
            {allTLs.map(tl=><option key={tl.id} value={tl.full_name}>{tl.full_name}</option>)}
          </select>
        </Field>

        {form.tlName && (
          <Field label="Coaching Reviewed" hint="Select the coaching session being triaded (optional)">
            <select value={form.coachingId} onChange={e=>handleSelectCoaching(e.target.value)} style={inpStyle(T)}>
              <option value="">— Select a coaching —</option>
              {tlCoachings.map(c=><option key={c.id} value={c.id}>{c.agentName} · {c.date} · {c.type}</option>)}
            </select>
          </Field>
        )}

        {form.agentName && (
          <Field label="Specialist Coached">
            <input value={form.agentName} readOnly style={{ ...inpStyle(T), color:T.muted }} />
          </Field>
        )}

        <Field label="Triad Date" required>
          <input type="date" value={form.date} onChange={e=>set("date",e.target.value)} style={inpStyle(T)} />
        </Field>
      </div>

      <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, padding:24, marginBottom:16 }}>
        <div style={{ fontSize:12, fontWeight:700, color:T.accent, marginBottom:18, textTransform:"uppercase", letterSpacing:"0.05em" }}>Observations</div>

        <Field label="Strengths Observed" required hint="What did the Team Lead do well in the coaching?">
          <BulletInput T={T} value={form.strengths} onChange={v=>set("strengths",v)} placeholder="Strength observed..." />
        </Field>

        <Field label="Areas of Improvement" hint="What can the Team Lead improve?">
          <BulletInput T={T} value={form.areasOfImprovement} onChange={v=>set("areasOfImprovement",v)} placeholder="Area of improvement..." />
        </Field>

        <Field label="Action Plan" hint="Concrete steps for improvement">
          <BulletInput T={T} value={form.actionPlan} onChange={v=>set("actionPlan",v)} placeholder="Action step..." />
        </Field>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <Field label="Follow-Up Date">
            <input type="date" value={form.followUpDate} onChange={e=>set("followUpDate",e.target.value)} style={inpStyle(T)} />
          </Field>
          <Field label="Additional Notes">
            <input value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="Optional notes..." style={inpStyle(T)} />
          </Field>
        </div>
      </div>

      <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
        <button onClick={onClose} style={{ padding:"10px 22px", borderRadius:10, border:`1px solid ${T.border}`, background:"transparent", color:T.muted, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>Cancel</button>
        <button onClick={()=>canSave&&onSave(form)} disabled={!canSave}
          style={{ padding:"10px 22px", borderRadius:10, border:"none", background:canSave?"linear-gradient(135deg,#379AAB,#2a7a89)":"#1e2130", color:canSave?"#fff":"#64748b", fontSize:13, fontWeight:700, cursor:canSave?"pointer":"default", fontFamily:"inherit" }}>
          Save Triad →
        </button>
      </div>
    </div>
  );
}

// ── TL TRIAD VIEW ─────────────────────────────────────────────────────────────
function TLTriadView({ triads, T, onOpenTriad }) {
  const [search, setSearch] = useState("");
  const filtered = triads.filter(t =>
    (t.managerName||"").toLowerCase().includes(search.toLowerCase()) ||
    (t.date||"").includes(search)
  );
  const pending = triads.filter(t => !t.acknowledgedAt).length;

  return (
    <div style={{ padding:"20px 26px" }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:20 }}>
        {[
          { label:"Total Triads", val:triads.length, color:T.accent },
          { label:"Pending", val:pending, color:"#f59e0b" },
          { label:"Acknowledged", val:triads.filter(t=>t.acknowledgedAt).length, color:"#10b981" },
        ].map((s,i)=>(
          <div key={i} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:"16px 18px" }}>
            <div style={{ fontSize:10, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:8 }}>{s.label}</div>
            <div style={{ fontSize:28, fontWeight:800, color:T.text }}>{s.val}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom:14 }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by manager or date..."
          style={{ padding:"9px 14px", borderRadius:9, border:`1px solid ${T.border}`, background:T.card, color:T.text, fontSize:13, outline:"none", fontFamily:"inherit", width:"100%", maxWidth:340, boxSizing:"border-box" }} />
      </div>

      <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, overflow:"hidden" }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ borderBottom:`1px solid ${T.border}` }}>
              {["Date","Manager","Specialist Reviewed","Follow-Up","Status"].map(h=>(
                <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:10, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:"0.05em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length===0
              ? <tr><td colSpan={5} style={{ textAlign:"center", padding:36, color:T.muted, fontSize:13 }}>No triads yet.</td></tr>
              : filtered.map((t,i)=>{
                const acked = !!t.acknowledgedAt;
                return (
                  <tr key={t.id} onClick={()=>onOpenTriad(t)} style={{ borderBottom:i<filtered.length-1?`1px solid ${T.border}`:"none", cursor:"pointer" }}
                    onMouseEnter={e=>e.currentTarget.style.background=T.hover}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <td style={{ padding:"12px 14px", fontSize:12, color:T.text, fontWeight:500 }}>{t.date}</td>
                    <td style={{ padding:"12px 14px", fontSize:12, color:T.text }}>{t.managerName||"—"}</td>
                    <td style={{ padding:"12px 14px", fontSize:12, color:T.muted }}>{t.agentName||"—"}</td>
                    <td style={{ padding:"12px 14px", fontSize:11, color:T.muted }}>{t.followUpDate||"—"}</td>
                    <td style={{ padding:"12px 14px" }}>
                      <span style={{ fontSize:11, fontWeight:600, color:acked?"#10b981":"#f59e0b", background:acked?"#10b98115":"#f59e0b15", padding:"3px 10px", borderRadius:99 }}>
                        {acked?"✓ Acknowledged":"Pending"}
                      </span>
                      {!acked && <span style={{ marginLeft:6, fontSize:10, color:"#ef4444" }}>● review needed</span>}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── DASHBOARD VIEW (TL/SPECIALIST) ───────────────────────────────────────────
function DashboardView({ coachings, warnings, role, T, onOpenCoaching, targets, isSpecialist = false }) {
  const now   = new Date();
  const [filterMonth, setFilterMonth] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [drilldownModal, setDrilldownModal] = useState(null); // shared drilldown for specialist + TL
  
  const thisMonth = String(now.getMonth()+1).padStart(2,"0");
  const thisYear  = String(now.getFullYear());
  const tlName    = coachings[0]?.tlName || "";
  const years = [...new Set(coachings.map(c => c.date?.slice(0,4)))].filter(Boolean).sort((a,b)=>b-a);
  if (!years.includes(thisYear)) years.unshift(thisYear);

  const sel={ padding:"6px 10px", borderRadius:8, border:`1px solid ${T.border}`, background:T.inputBg, color:T.text, fontSize:11, outline:"none", fontFamily:"inherit", cursor:"pointer" };

  // compliance this month (Acknowledged only)
  const target  = targets?.[tlName] || 0;
  const displayMonth = filterMonth || thisMonth;
  const displayYear = filterYear || thisYear;
  const compliance = calcCompliance(coachings, displayMonth, displayYear, target);

  // prev month
  const prevDate  = new Date((filterYear||thisYear), (displayMonth)-2, 1);
  const prevMonth = String(prevDate.getMonth()+1).padStart(2,"0");
  const prevYear  = String(prevDate.getFullYear());
  const prevCompliance = calcCompliance(coachings, prevMonth, prevYear, target);

  // alert: days remaining vs pace
  const daysInMonth  = new Date(displayYear, displayMonth, 0).getDate();
  const daysLeft     = daysInMonth - now.getDate();
  const ackedSoFar   = compliance?.acked || 0;
  const needed       = target - ackedSoFar;
  const showAlert    = displayMonth === thisMonth && target > 0 && needed > 0 && daysLeft <= 10;

  // Count unread warnings for badge
  const unreadWarnings = warnings.filter(w => !w.acknowledgedAt).length;

  // EWS breakdown
  const ewsData = ["Green","Yellow","Red","Imminent"].map(e=>({
    label:e, val:coachings.filter(c=>c.ews===e).length,
    color:EWS_STYLE[e]?.text||"#64748b", bg:EWS_STYLE[e]?.bg||"#64748b18",
  }));

  // Type breakdown
  const typeData = ["Performance","Attendance","Attrition Risk"].map(t=>({
    label:t, val:coachings.filter(c=>c.type===t).length, color:TYPE_COLOR[t]||"#64748b",
  }));

  // Weekly trending
  const weeklyData = [3,2,1,0].map(wa=>{
    const ws=new Date(now); ws.setDate(now.getDate()-(wa*7)-now.getDay());
    const we=new Date(ws); we.setDate(ws.getDate()+6);
    return { week:wa===0?"This wk":`${wa}w ago`, val:coachings.filter(c=>{const d=new Date(c.date);return d>=ws&&d<=we;}).length };
  });
  const maxW = Math.max(...weeklyData.map(w=>w.val),1);

  // Top Agent nominations
  const nominationMap={};
  coachings.forEach(c=>{
    if(c.topAgent==="Yes") {
      if(!nominationMap[c.agentName]) nominationMap[c.agentName]={nominations:0,rating:[]};
      nominationMap[c.agentName].nominations++;
      if(c.agentRating) nominationMap[c.agentName].rating.push(c.agentRating);
    }
  });
  const top3=Object.entries(nominationMap)
    .map(([name,d])=>({name,nominations:d.nominations,avg:d.rating.length?(d.rating.reduce((a,b)=>a+b,0)/d.rating.length).toFixed(1):"—"}))
    .sort((a,b)=>b.nominations-a.nominations).slice(0,3);

  // Overdue — only agents with at least one non-acknowledged coaching
  const lastNonAckedByAgent={};
  coachings.filter(c=>c.status!=="Acknowledged").forEach(c=>{
    if(!lastNonAckedByAgent[c.agentName]||c.date>lastNonAckedByAgent[c.agentName]) lastNonAckedByAgent[c.agentName]=c.date;
  });
  const overdue=Object.entries(lastNonAckedByAgent)
    .map(([name,date])=>({name,date,days:Math.floor((now-new Date(date))/86400000)}))
    .sort((a,b)=>b.days-a.days).slice(0,3);

  const allAgents=[...new Set(coachings.map(c=>c.agentName))];
  const coachedThisMonth=new Set(getMonthCoachings(coachings,displayMonth,displayYear).map(c=>c.agentName));
  const notThisMonth=allAgents.filter(a=>!coachedThisMonth.has(a));

  const medals=["🥇","🥈","🥉"];
  const cpct = compliance?.pct || 0;
  const cColor = complianceColor(cpct);

  // For Specialist: show coachings and warnings
  if (isSpecialist) {
    const filteredCoachings = coachings
      .filter(c => !filterMonth || c.date?.slice(5,7) === filterMonth)
      .filter(c => !filterYear || c.date?.slice(0,4) === filterYear);
    
    const filteredWarnings = warnings
      .filter(w => !filterMonth || w.date?.slice(5,7) === filterMonth)
      .filter(w => !filterYear || w.date?.slice(0,4) === filterYear);

    return (
      <div style={{ padding:"20px 26px" }}>
        {/* Specialist drilldown */}
        {drilldownModal && (
          <DrilldownModal title={drilldownModal.title} coachings={drilldownModal.coachings} T={T} onClose={()=>setDrilldownModal(null)} onOpenCoaching={c=>{onOpenCoaching(c);setDrilldownModal(null);}} />
        )}
        {/* Filter Row */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8, marginBottom:20 }}>
          <h2 style={{ fontSize:14, fontWeight:700, color:T.text, margin:0 }}>My Coaching Dashboard</h2>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
            <select value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} style={sel}>
              <option value="">All Months</option>
              {MONTHS.map(m=><option key={m.val} value={m.val}>{m.label}</option>)}
            </select>
            <select value={filterYear} onChange={e=>setFilterYear(e.target.value)} style={sel}>
              <option value="">All Years</option>
              {years.map(y=><option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {/* KPI Cards */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:20 }}>
          {[
            { label:"My Coachings", val:filteredCoachings.length, icon:"📋", color:T.accent, list:filteredCoachings, title:"All My Coachings" },
            { label:"Pending Review", val:filteredCoachings.filter(c=>c.status==="Delivered").length, icon:"⏳", color:"#f59e0b", list:filteredCoachings.filter(c=>c.status==="Delivered"), title:"Pending Review" },
            { label:"Acknowledged", val:filteredCoachings.filter(c=>c.status==="Acknowledged").length, icon:"✅", color:"#10b981", list:filteredCoachings.filter(c=>c.status==="Acknowledged"), title:"Acknowledged" },
          ].map((s,i)=>(
            <div key={i} onClick={()=>setDrilldownModal({title:s.title,coachings:s.list})}
              style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:"16px 18px", cursor:"pointer" }}
              onMouseEnter={e=>e.currentTarget.style.borderColor=s.color+"60"}
              onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                <div style={{ fontSize:10, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:"0.05em" }}>{s.label}</div>
                <span style={{ fontSize:18 }}>{s.icon}</span>
              </div>
              <div style={{ fontSize:30, fontWeight:800, color:s.color }}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* Two Column Layout */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>
          {/* Coachings Section */}
          <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:18 }}>
            <div style={{ fontSize:12, fontWeight:700, color:T.text, marginBottom:14 }}>📋 My Coachings</div>
            {filteredCoachings.length===0
              ? <div style={{ fontSize:12, color:T.muted, textAlign:"center", padding:"20px 0" }}>No coachings yet.</div>
              : filteredCoachings.slice(0,5).map((c,i) => {
                const ss = STATUS_STYLE[c.status] || {};
                const tc = TYPE_COLOR[c.type] || "#64748b";
                return (
                  <div key={c.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", paddingBottom:"12px", borderBottom:i<Math.min(4,filteredCoachings.length-1)?`1px solid ${T.border}`:"none", cursor:"pointer" }}
                    onClick={() => onOpenCoaching(c)}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:11, fontWeight:600, color:T.text, marginBottom:4 }}>{c.date}</div>
                    </div>
                    <span style={{ fontSize:10, fontWeight:600, color:ss.text, background:ss.bg, padding:"3px 8px", borderRadius:99 }}>{c.status}</span>
                  </div>
                );
              })}
            {filteredCoachings.length > 5 && <div style={{ fontSize:10, color:T.accent, marginTop:10, textAlign:"center", cursor:"pointer" }}>View all →</div>}
          </div>

          {/* Warnings Section */}
          <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:18 }}>
            <div style={{ fontSize:12, fontWeight:700, color:T.text, marginBottom:14 }}>🚨 My Warnings</div>
            {filteredWarnings.length===0
              ? <div style={{ fontSize:12, color:T.muted, textAlign:"center", padding:"20px 0" }}>No warnings.</div>
              : filteredWarnings.slice(0,5).map((w,i) => {
                const ws = WARNING_STYLE[w.warningType] || {};
                return (
                  <div key={w.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", paddingBottom:"12px", borderBottom:i<Math.min(4,filteredWarnings.length-1)?`1px solid ${T.border}`:"none" }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:11, fontWeight:600, color:T.text, marginBottom:4 }}>{w.date}</div>
                      <div style={{ fontSize:10, color:T.muted }}><span style={{ fontSize:9, fontWeight:700, color:ws.color, background:ws.bg, padding:"2px 6px", borderRadius:99 }}>{ws.icon} {w.warningType}</span></div>
                    </div>
                    <span style={{ fontSize:10, fontWeight:600, color:w.acknowledgedAt?"#10b981":"#f59e0b" }}>
                      {w.acknowledgedAt ? "✓" : "!"}
                    </span>
                  </div>
                );
              })}
            {filteredWarnings.length > 5 && <div style={{ fontSize:10, color:T.accent, marginTop:10, textAlign:"center", cursor:"pointer" }}>View all →</div>}
          </div>
        </div>

      </div>
    );
  }

  const drilldown = drilldownModal;
  const setDrilldown = setDrilldownModal;

  // For Team Lead (original dashboard)
  return (
    <div style={{ padding:"20px 26px" }}>
      {drilldown && drilldown.coachings && (
        <DrilldownModal
          title={drilldown.title}
          coachings={drilldown.coachings}
          T={T}
          onClose={() => setDrilldown(null)}
          onOpenCoaching={c => { onOpenCoaching(c); setDrilldown(null); }}
        />
      )}
      {drilldown && drilldown.warnings && (
        <div onClick={()=>setDrilldown(null)} style={{ position:"fixed", inset:0, background:"#00000099", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, padding:20 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:18, width:"100%", maxWidth:620, maxHeight:"85vh", display:"flex", flexDirection:"column", boxShadow:"0 32px 80px #00000070" }}>
            <div style={{ padding:"18px 22px 14px", borderBottom:`1px solid ${T.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontSize:15, fontWeight:700, color:T.text }}>{drilldown.title}</div>
              <button onClick={() => setDrilldown(null)} style={{ background:"none", border:"none", color:T.muted, cursor:"pointer", fontSize:20 }}>×</button>
            </div>
            <div style={{ overflowY:"auto", flex:1 }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead style={{ position:"sticky", top:0, background:T.card }}>
                  <tr style={{ borderBottom:`1px solid ${T.border}` }}>
                    {["Specialist","Dept","Type","Date","Status"].map(h => (
                      <th key={h} style={{ padding:"9px 14px", textAlign:"left", fontSize:10, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:"0.05em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {drilldown.warnings.length === 0
                    ? <tr><td colSpan={5} style={{ textAlign:"center", padding:36, color:T.muted, fontSize:13 }}>No warnings found.</td></tr>
                    : drilldown.warnings.map((w, i) => {
                      const ws = WARNING_STYLE[w.warningType] || {};
                      return (
                        <tr key={w.id} style={{ borderBottom:i<drilldown.warnings.length-1?`1px solid ${T.border}`:"none" }}
                          onMouseEnter={e=>e.currentTarget.style.background=T.hover}
                          onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                          <td style={{ padding:"11px 14px", fontSize:12, color:T.text, fontWeight:500 }}>{w.agentName}</td>
                          <td style={{ padding:"11px 14px", fontSize:11, color:T.muted }}>{w.dept}</td>
                          <td style={{ padding:"11px 14px" }}><span style={{ fontSize:10, fontWeight:700, color:ws.color, background:ws.bg, padding:"3px 8px", borderRadius:99 }}>{ws.icon} {w.warningType}</span></td>
                          <td style={{ padding:"11px 14px", fontSize:11, color:T.muted }}>{w.date}</td>
                          <td style={{ padding:"11px 14px", fontSize:11, fontWeight:600, color:w.acknowledgedAt?"#10b981":"#f59e0b" }}>{w.acknowledgedAt?"✓ Acknowledged":"Pending"}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            <div style={{ padding:"12px 22px", borderTop:`1px solid ${T.border}`, fontSize:11, color:T.muted }}>
              {drilldown.warnings.length} warning{drilldown.warnings.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
      )}

      {/* Alert banner */}
      {showAlert && (
        <div style={{ background:"#f59e0b12", border:"1px solid #f59e0b40", borderRadius:12, padding:"12px 16px", marginBottom:16, display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:20 }}>⚠️</span>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:"#f59e0b" }}>Coaching compliance alert</div>
            <div style={{ fontSize:12, color:T.muted }}>You need <strong style={{color:"#f59e0b"}}>{needed} more acknowledged coaching{needed>1?"s":""}</strong> to hit your target. Only <strong style={{color:"#f59e0b"}}>{daysLeft} days</strong> left this month.</div>
          </div>
        </div>
      )}

      {/* KPI row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>

        {/* Compliance card */}
        <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:"16px 18px", gridColumn:"span 1" }}>
          <div style={{ fontSize:10, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:8 }}>Monthly Compliance</div>
          {target===0
            ? <div style={{ fontSize:13, color:T.muted }}>No target set</div>
            : <>
              <div style={{ fontSize:30, fontWeight:800, color:cColor }}>{cpct}%</div>
              <div style={{ margin:"8px 0 6px", height:6, borderRadius:99, background:T.border }}>
                <div style={{ height:"100%", width:`${cpct}%`, borderRadius:99, background:cColor, transition:"width 0.4s" }} />
              </div>
              <div style={{ fontSize:11, color:T.muted }}>{ackedSoFar} of {target} coachings acknowledged</div>
              {prevCompliance && (
                <div style={{ fontSize:11, color:T.muted, marginTop:4 }}>
                  vs last month: <span style={{ fontWeight:700, color: prevCompliance.pct<=cpct?"#10b981":"#ef4444" }}>
                    {prevCompliance.pct<=cpct?"↑":"↓"} {Math.abs(cpct-prevCompliance.pct)}%
                  </span>
                </div>
              )}
            </>}
        </div>

        {[
          { label:"Total Coachings", val:coachings.length, icon:"📋", color:T.accent, onClick:()=>setDrilldown({ title:"All Coachings", coachings }) },
          { label:"Pending", val:coachings.filter(c=>c.status==="Pending").length, icon:"⏳", color:"#f59e0b", onClick:()=>setDrilldown({ title:"Pending Coachings", coachings:coachings.filter(c=>c.status==="Pending") }) },
          { label:"Warnings Delivered", val:coachings.filter(c=>c.warningDelivered==="Yes").length, icon:"🚨", color:"#ef4444", onClick:()=>setDrilldown({ title:"Coachings with Warning Delivered", coachings:coachings.filter(c=>c.warningDelivered==="Yes") }) },
        ].map((s,i)=>(
          <div key={i} onClick={s.onClick} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:"16px 18px", cursor:"pointer" }}
            onMouseEnter={e=>e.currentTarget.style.borderColor=s.color+"60"}
            onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
              <div style={{ fontSize:10, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:"0.05em" }}>{s.label}</div>
              <span style={{ fontSize:18 }}>{s.icon}</span>
            </div>
            <div style={{ fontSize:30, fontWeight:800, color:T.text }}>{s.val}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>
        {/* EWS */}
        <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:18 }}>
          <div style={{ fontSize:12, fontWeight:700, color:T.text, marginBottom:14 }}>EWS Breakdown</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:14 }}>
            {ewsData.map((e,i)=>(
              <div key={i} onClick={()=>setDrilldown({ title:`EWS: ${e.label}`, coachings:coachings.filter(c=>c.ews===e.label) })}
                style={{ background:e.bg, borderRadius:10, padding:"12px 14px", cursor:"pointer", transition:"opacity 0.15s" }}
                onMouseEnter={ev=>ev.currentTarget.style.opacity="0.75"}
                onMouseLeave={ev=>ev.currentTarget.style.opacity="1"}>
                <div style={{ fontSize:22, fontWeight:800, color:e.color }}>{e.val}</div>
                <div style={{ fontSize:11, color:e.color, fontWeight:600 }}>{e.label}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize:12, fontWeight:700, color:T.text, marginBottom:10 }}>By Type</div>
          {typeData.map((t,i)=>(
            <div key={i} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
              <div style={{ fontSize:11, color:T.muted, width:110, flexShrink:0 }}>{t.label}</div>
              <div style={{ flex:1, height:7, borderRadius:99, background:T.border }}>
                <div style={{ height:"100%", width:`${coachings.length>0?(t.val/coachings.length)*100:0}%`, borderRadius:99, background:t.color }} />
              </div>
              <div style={{ fontSize:11, fontWeight:700, color:t.color, width:18 }}>{t.val}</div>
            </div>
          ))}
        </div>

        {/* Weekly */}
        <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:18 }}>
          <div style={{ fontSize:12, fontWeight:700, color:T.text, marginBottom:14 }}>Weekly Trending</div>
          <div style={{ display:"flex", alignItems:"flex-end", gap:10, height:90, marginBottom:8 }}>
            {weeklyData.map((w,i)=>(
              <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                <div style={{ fontSize:11, fontWeight:700, color:T.accent }}>{w.val}</div>
                <div style={{ width:"100%", background:i===3?T.accent:T.accent+"55", borderRadius:"4px 4px 0 0", height:`${(w.val/maxW)*65}px`, minHeight:4 }} />
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:10 }}>
            {weeklyData.map((w,i)=><div key={i} style={{ flex:1, textAlign:"center", fontSize:9, color:T.muted }}>{w.week}</div>)}
          </div>
          <div style={{ marginTop:16, paddingTop:14, borderTop:`1px solid ${T.border}` }}>
            <div style={{ fontSize:12, fontWeight:700, color:T.text, marginBottom:10 }}>Warnings Delivered by Type</div>
            {["Verbal Warning","Written Warning","Final Warning"].map(wt=>{
              const ws=WARNING_STYLE[wt];
              const count = coachings.filter(c=>c.warningDelivered==="Yes"&&c.warningType===wt).length;
              return (
                <div key={wt} style={{ display:"flex", justifyContent:"space-between", marginBottom:7 }}>
                  <span style={{ fontSize:11, color:T.muted }}>{wt}</span>
                  <span style={{ fontSize:11, fontWeight:700, color:ws?.color||T.muted, background:ws?.bg||T.border, padding:"2px 8px", borderRadius:99 }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        {/* Top 3 */}
        <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:18 }}>
          <div style={{ fontSize:12, fontWeight:700, color:T.text, marginBottom:14 }}>⭐ Top Agent Nominations</div>
          {top3.length===0
            ? <div style={{ fontSize:12, color:T.muted, textAlign:"center", padding:"20px 0" }}>No nominations yet. Mark agents as Top Agent when creating a coaching.</div>
            : top3.map((a,i)=>(
              <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:i<top3.length-1?`1px solid ${T.border}`:"none" }}>
                <div style={{ fontSize:22, width:32 }}>{medals[i]}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:T.text }}>{a.name}</div>
                  <div style={{ fontSize:11, color:T.muted }}>{a.nominations} nomination{a.nominations!==1?"s":""} · ⭐ {a.avg}</div>
                </div>
                <div style={{ fontSize:20, fontWeight:800, color:"#f59e0b" }}>{a.nominations}</div>
              </div>
            ))}
        </div>

        {/* Overdue */}
        <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:18 }}>
          <div style={{ fontSize:12, fontWeight:700, color:T.text, marginBottom:4 }}>⏰ Coaching Overdue</div>
          <div style={{ fontSize:11, color:T.muted, marginBottom:14 }}>Agents without recent coaching</div>
          {notThisMonth.length>0 && (
            <div style={{ background:"#f59e0b10", border:"1px solid #f59e0b25", borderRadius:10, padding:"10px 12px", marginBottom:12 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#f59e0b", marginBottom:6 }}>Not coached this month ({notThisMonth.length})</div>
              {notThisMonth.slice(0,3).map((name,i)=><div key={i} style={{ fontSize:11, color:"#f59e0b", marginBottom:3 }}>• {name}</div>)}
              {notThisMonth.length>3 && <div style={{ fontSize:10, color:T.muted }}>+{notThisMonth.length-3} more</div>}
            </div>
          )}
          {overdue.length===0
            ? <div style={{ fontSize:12, color:T.muted, textAlign:"center", padding:"10px 0" }}>All agents coached recently ✓</div>
            : overdue.map((a,i)=>(
              <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 0", borderBottom:i<overdue.length-1?`1px solid ${T.border}`:"none" }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:500, color:T.text }}>{a.name}</div>
                  <div style={{ fontSize:10, color:T.muted }}>Last: {a.date}</div>
                </div>
                <div style={{ fontSize:11, fontWeight:700, color:a.days>14?"#ef4444":"#f59e0b", background:a.days>14?"#ef444415":"#f59e0b15", padding:"3px 9px", borderRadius:99 }}>{a.days}d ago</div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

// ── COACHINGS LIST VIEW ───────────────────────────────────────────────────────
function CoachingsListView({ coachings, isSpecialist, T, onOpenCoaching, onDeliver, onDeleteCoaching }) {
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterType,   setFilterType]   = useState("All");
  const [filterMonth,  setFilterMonth]  = useState("");
  const [filterYear,   setFilterYear]   = useState("");

  const years=[...new Set(coachings.map(c=>c.date?.slice(0,4)))].filter(Boolean).sort((a,b)=>b-a);
  const sel={ padding:"6px 10px", borderRadius:8, border:`1px solid ${T.border}`, background:T.inputBg, color:T.text, fontSize:11, outline:"none", fontFamily:"inherit", cursor:"pointer" };

  const filtered = coachings
    .filter(c=>filterStatus==="All"||c.status===filterStatus)
    .filter(c=>filterType==="All"||c.type===filterType)
    .filter(c=>!filterYear||c.date?.slice(0,4)===filterYear)
    .filter(c=>!filterMonth||c.date?.slice(5,7)===filterMonth);

  return (
    <div style={{ padding:"20px 26px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8, marginBottom:14 }}>
        <h2 style={{ fontSize:14, fontWeight:700, color:T.text, margin:0 }}>{isSpecialist?"My Coachings":"All Coachings"}</h2>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
          <select value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} style={sel}>
            <option value="">All Months</option>
            {MONTHS.map(m=><option key={m.val} value={m.val}>{m.label}</option>)}
          </select>
          <select value={filterYear} onChange={e=>setFilterYear(e.target.value)} style={sel}>
            <option value="">All Years</option>
            {years.map(y=><option key={y} value={y}>{y}</option>)}
          </select>
          {["All","Pending","Delivered","Acknowledged"].map(s=>(
            <button key={s} onClick={()=>setFilterStatus(s)} style={{ padding:"5px 11px", borderRadius:6, border:`1px solid ${filterStatus===s?T.accent:T.border}`, background:filterStatus===s?T.accent+"18":"transparent", color:filterStatus===s?T.accent:T.muted, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>{s}</button>
          ))}
          {["All","Performance","Attendance","Attrition Risk"].map(t=>(
            <button key={t} onClick={()=>setFilterType(t)} style={{ padding:"5px 11px", borderRadius:6, border:`1px solid ${filterType===t?(TYPE_COLOR[t]||T.accent):T.border}`, background:filterType===t?(TYPE_COLOR[t]||T.accent)+"18":"transparent", color:filterType===t?(TYPE_COLOR[t]||T.accent):T.muted, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>{t}</button>
          ))}
        </div>
      </div>

      <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, overflow:"hidden" }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ borderBottom:`1px solid ${T.border}` }}>
              {(isSpecialist?["Type","Date","Status","Rating","Action"]:["Specialist","Type","Date","EWS","Status","Rating","Action"]).map(h=>(
                <th key={h} style={{ padding:"10px 13px", textAlign:"left", fontSize:10, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:"0.05em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length===0
              ? <tr><td colSpan={isSpecialist?5:7} style={{ textAlign:"center", padding:40, color:T.muted, fontSize:13 }}>No coachings found.</td></tr>
              : filtered.map((c,i)=>{
                const ss=STATUS_STYLE[c.status]||{};
                const ews=EWS_STYLE[c.ews]||{};
                const tc=TYPE_COLOR[c.type]||"#64748b";
                return (
                  <tr key={c.id} style={{ borderBottom:i<filtered.length-1?`1px solid ${T.border}`:"none", cursor:"pointer" }}
                    onClick={()=>onOpenCoaching(c)}
                    onMouseEnter={e=>e.currentTarget.style.background=T.hover}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    {!isSpecialist&&(
                      <td style={{ padding:"12px 13px" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                          <Avatar name={c.agentName} size={24} color="#6366f1" />
                          <div>
                            <div style={{ fontSize:12, color:T.text, fontWeight:500 }}>{c.agentName}</div>
                            <div style={{ fontSize:10, color:T.muted }}>{c.dept}</div>
                          </div>
                        </div>
                      </td>
                    )}
                    <td style={{ padding:"12px 13px" }}><span style={{ fontSize:10, fontWeight:700, color:tc, background:tc+"18", padding:"3px 8px", borderRadius:99 }}>{c.type}</span></td>
                    <td style={{ padding:"12px 13px", fontSize:11, color:T.muted }}>{c.date}</td>
                    {!isSpecialist&&<td style={{ padding:"12px 13px" }}>{c.ews&&<span style={{ fontSize:10, fontWeight:700, color:ews.text, background:ews.bg, padding:"3px 8px", borderRadius:99 }}>{c.ews}</span>}</td>}
                    <td style={{ padding:"12px 13px" }}><span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"3px 8px", borderRadius:99, fontSize:10, fontWeight:600, background:ss.bg, color:ss.text }}><span style={{ width:4, height:4, borderRadius:"50%", background:ss.dot }} />{c.status}</span></td>
                    <td style={{ padding:"12px 13px" }}>{c.agentRating?<div style={{ display:"flex", gap:1 }}>{[1,2,3,4,5].map(s=><span key={s} style={{ fontSize:12, color:s<=c.agentRating?"#f59e0b":T.border }}>★</span>)}</div>:<span style={{ color:T.muted,fontSize:11 }}>—</span>}</td>
                    <td style={{ padding:"12px 13px" }} onClick={e=>e.stopPropagation()}>
                      {isSpecialist&&c.status==="Delivered"
                        ? <button onClick={()=>onOpenCoaching(c)} style={{ padding:"4px 10px", borderRadius:6, border:`1px solid ${T.accent}`, background:T.accent+"15", color:T.accent, fontSize:10, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Review</button>
                        : !isSpecialist&&c.status==="Pending"
                        ? <div style={{ display:"flex", gap:4 }}>
                            <button onClick={()=>onDeliver(c.id)} style={{ padding:"4px 10px", borderRadius:6, border:"1px solid #3b82f6", background:"#3b82f615", color:"#3b82f6", fontSize:10, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Deliver</button>
                            {onDeleteCoaching && c.status !== "Acknowledged" && (
                              <button onClick={()=>{if(window.confirm("¿Estás seguro de que quieres eliminar este coaching?")) onDeleteCoaching(c.id);}} style={{ padding:"4px 10px", borderRadius:6, border:"1px solid #ef4444", background:"#ef444415", color:"#ef4444", fontSize:10, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Delete</button>
                            )}
                          </div>
                        : (c.status !== "Acknowledged" && onDeleteCoaching && !isSpecialist)
                        ? <button onClick={()=>{if(window.confirm("¿Estás seguro de que quieres eliminar este coaching?")) onDeleteCoaching(c.id);}} style={{ padding:"4px 10px", borderRadius:6, border:"1px solid #ef4444", background:"#ef444415", color:"#ef4444", fontSize:10, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Delete</button>
                        : <span style={{ color:T.border,fontSize:11 }}>—</span>}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── HR VIEW ───────────────────────────────────────────────────────────────────
function HRView({ warnings, onNewWarning, T, onDeleteWarning = null, isTeamLead = false }) {
  const [filterType, setFilterType] = useState("All");
  const [search,     setSearch]     = useState("");
  const [drilldown,  setDrilldown]  = useState(null); // { title, warnings }
  const allAgents=[...new Set(warnings.map(w=>w.agentName))];
  const filtered=warnings
    .filter(w=>filterType==="All"||w.warningType===filterType)
    .filter(w=>(w.agentName||"").toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ padding:"20px 26px" }}>
      {/* Warnings drilldown modal */}
      {drilldown && (
        <div onClick={()=>setDrilldown(null)} style={{ position:"fixed", inset:0, background:"#00000099", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, padding:20 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:18, width:"100%", maxWidth:660, maxHeight:"85vh", display:"flex", flexDirection:"column", boxShadow:"0 32px 80px #00000070" }}>
            <div style={{ padding:"18px 22px 14px", borderBottom:`1px solid ${T.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontSize:15, fontWeight:700, color:T.text }}>{drilldown.title}</div>
              <button onClick={()=>setDrilldown(null)} style={{ background:"none", border:"none", color:T.muted, cursor:"pointer", fontSize:20 }}>×</button>
            </div>
            <div style={{ overflowY:"auto", flex:1 }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead style={{ position:"sticky", top:0, background:T.card }}>
                  <tr style={{ borderBottom:`1px solid ${T.border}` }}>
                    {["Specialist","Dept","Type","Date","Status"].map(h=>(
                      <th key={h} style={{ padding:"9px 14px", textAlign:"left", fontSize:10, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:"0.05em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {drilldown.warnings.length===0
                    ? <tr><td colSpan={5} style={{ textAlign:"center", padding:36, color:T.muted, fontSize:13 }}>No warnings.</td></tr>
                    : drilldown.warnings.map((w,i)=>{
                      const ws=WARNING_STYLE[w.warningType]||{};
                      return (
                        <tr key={w.id} style={{ borderBottom:i<drilldown.warnings.length-1?`1px solid ${T.border}`:"none" }}
                          onMouseEnter={e=>e.currentTarget.style.background=T.hover}
                          onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                          <td style={{ padding:"11px 14px", fontSize:12, color:T.text, fontWeight:500 }}>{w.agentName}</td>
                          <td style={{ padding:"11px 14px", fontSize:11, color:T.muted }}>{w.dept}</td>
                          <td style={{ padding:"11px 14px" }}><span style={{ fontSize:10, fontWeight:700, color:ws.color, background:ws.bg, padding:"3px 8px", borderRadius:99 }}>{ws.icon} {w.warningType}</span></td>
                          <td style={{ padding:"11px 14px", fontSize:11, color:T.muted }}>{w.date}</td>
                          <td style={{ padding:"11px 14px", fontSize:11, fontWeight:600, color:w.acknowledgedAt?"#10b981":"#f59e0b" }}>{w.acknowledgedAt?"✓ Acknowledged":"Pending"}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            <div style={{ padding:"12px 22px", borderTop:`1px solid ${T.border}`, fontSize:11, color:T.muted }}>
              {drilldown.warnings.length} warning{drilldown.warnings.length!==1?"s":""}
            </div>
          </div>
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
        {[
          { label:"Total Warnings", val:warnings.length,                                               color:T.accent,   list:warnings },
          { label:"Verbal",  val:warnings.filter(w=>w.warningType==="Verbal Warning").length,  color:"#f59e0b",  list:warnings.filter(w=>w.warningType==="Verbal Warning") },
          { label:"Written", val:warnings.filter(w=>w.warningType==="Written Warning").length, color:"#ef4444",  list:warnings.filter(w=>w.warningType==="Written Warning") },
          { label:"Final",   val:warnings.filter(w=>w.warningType==="Final Warning").length,   color:"#7c3aed",  list:warnings.filter(w=>w.warningType==="Final Warning") },
        ].map((s,i)=>(
          <div key={i} onClick={()=>setDrilldown({ title:s.label+" Warnings", warnings:s.list })}
            style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:"16px 18px", cursor:"pointer" }}
            onMouseEnter={e=>e.currentTarget.style.borderColor=s.color+"60"}
            onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
            <div style={{ fontSize:10, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:8 }}>{s.label}</div>
            <div style={{ fontSize:28, fontWeight:800, color:T.text }}>{s.val}</div>
          </div>
        ))}
      </div>
      {search===""&&filterType==="All"&&allAgents.length>0&&(
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:13, fontWeight:700, color:T.text, marginBottom:10 }}>History by Agent</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:10 }}>
            {allAgents.map(name=>{
              const aw=warnings.filter(w=>w.agentName===name);
              return (
                <div key={name} onClick={()=>setSearch(name)} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:12, cursor:"pointer" }}
                  onMouseEnter={e=>e.currentTarget.style.borderColor=T.accent}
                  onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
                  <div style={{ fontSize:12, fontWeight:600, color:T.text, marginBottom:8 }}>{name}</div>
                  <div style={{ display:"flex", gap:5 }}>
                    {[["V",aw.filter(w=>w.warningType==="Verbal Warning").length,"#f59e0b"],
                      ["W",aw.filter(w=>w.warningType==="Written Warning").length,"#ef4444"],
                      ["F",aw.filter(w=>w.warningType==="Final Warning").length,"#7c3aed"]].map(([l,v,c])=>(
                      <div key={l} style={{ flex:1, textAlign:"center", background:c+"18", borderRadius:6, padding:"4px 2px" }}>
                        <div style={{ fontSize:13, fontWeight:700, color:c }}>{v}</div>
                        <div style={{ fontSize:9, color:T.muted }}>{l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8, marginBottom:12 }}>
        <div style={{ fontSize:13, fontWeight:700, color:T.text }}>
          {search?`Warnings — ${search}`:"All Warnings"}
          {search&&<button onClick={()=>setSearch("")} style={{ marginLeft:8, fontSize:11, color:T.accent, background:"none", border:"none", cursor:"pointer" }}>← Back</button>}
        </div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search agent..." style={{ padding:"5px 10px", borderRadius:7, border:`1px solid ${T.border}`, background:T.inputBg, color:T.text, fontSize:11, outline:"none", fontFamily:"inherit" }} />
          {["All","Verbal Warning","Written Warning","Final Warning"].map(t=>{
            const ws=WARNING_STYLE[t];
            return <button key={t} onClick={()=>setFilterType(t)} style={{ padding:"4px 11px", borderRadius:6, border:`1px solid ${filterType===t?(ws?.color||T.accent):T.border}`, background:filterType===t?(ws?.color||T.accent)+"18":"transparent", color:filterType===t?(ws?.color||T.accent):T.muted, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>{t==="All"?"All":t.replace(" Warning","")}</button>;
          })}
          <button onClick={onNewWarning} style={{ padding:"5px 13px", borderRadius:7, border:"1px solid #ef444440", background:"#ef444412", color:"#ef4444", fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>+ New</button>
        </div>
      </div>
      <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, overflow:"hidden" }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ borderBottom:`1px solid ${T.border}` }}>
              {[...(isTeamLead?["Specialist","Dept","Warning Type","Date","TL","Status","Action"]:["Specialist","Dept","Warning Type","Date","TL","Status"])].map(h=>(
                <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:10, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:"0.05em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length===0
              ? <tr><td colSpan={isTeamLead ? 7 : 6} style={{ textAlign:"center", padding:36, color:T.muted, fontSize:13 }}>No warnings found.</td></tr>
              : filtered.map((w,i,arr)=>{
                const ws=WARNING_STYLE[w.warningType]||{};
                return (
                  <tr key={w.id} style={{ borderBottom:i<arr.length-1?`1px solid ${T.border}`:"none" }}
                    onMouseEnter={e=>e.currentTarget.style.background=T.hover}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <td style={{ padding:"12px 14px", fontSize:12, color:T.text, fontWeight:500 }}>{w.agentName}</td>
                    <td style={{ padding:"12px 14px", fontSize:11, color:T.muted }}>{w.dept}</td>
                    <td style={{ padding:"12px 14px" }}><span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"3px 9px", borderRadius:99, fontSize:10, fontWeight:700, background:ws.bg, color:ws.color }}>{ws.icon} {w.warningType}</span></td>
                    <td style={{ padding:"12px 14px", fontSize:11, color:T.muted }}>{w.date}</td>
                    <td style={{ padding:"12px 14px", fontSize:11, color:T.muted }}>{w.createdBy||"—"}</td>
                    <td style={{ padding:"12px 14px" }}>
                      {w.acknowledgedAt?<span style={{ fontSize:11, color:"#10b981", fontWeight:600 }}>✓ Acknowledged</span>
                        :w.deliveredAt?<span style={{ fontSize:11, color:"#3b82f6", fontWeight:600 }}>Delivered</span>
                        :<span style={{ fontSize:11, color:T.muted }}>Pending</span>}
                    </td>
                    {isTeamLead && (
                      <td style={{ padding:"12px 14px" }}>
                        <button onClick={(e)=>{e.stopPropagation(); if(window.confirm("¿Estás seguro de que quieres eliminar este warning?")) onDeleteWarning(w.id);}} style={{ padding:"4px 10px", borderRadius:6, border:"1px solid #ef4444", background:"#ef444415", color:"#ef4444", fontSize:10, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Delete</button>
                      </td>
                    )}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── MANAGER VIEW ──────────────────────────────────────────────────────────────
function ManagerView({ coachings, warnings, T, onOpenCoaching, targets, onSetTargets, profiles }) {
  const now      = new Date();
  const [filterMonth, setFilterMonth] = useState(String(now.getMonth()+1).padStart(2,"0"));
  const [filterYear,  setFilterYear]  = useState(String(now.getFullYear()));
  const [drilldown, setDrilldown]       = useState(null); // {title, coachings}
  const [warnDrill, setWarnDrill]       = useState(null); // warnings drilldown
  const [editingTargets, setEditingTargets] = useState(false);
  const [localTargets, setLocalTargets]     = useState({ ...targets });
  const [targetTL, setTargetTL]         = useState("");
  const [targetVal, setTargetVal]       = useState("");

  const years=[...new Set(coachings.map(c=>c.date?.slice(0,4)))].filter(Boolean).sort((a,b)=>b-a);
  if (!years.includes(filterYear)) years.unshift(filterYear);

  const filteredAll = coachings
    .filter(c=>!filterMonth||c.date?.slice(5,7)===filterMonth)
    .filter(c=>!filterYear||c.date?.slice(0,4)===filterYear);

  const agentsByClient = {};
  profiles.forEach(p => { if (p.role === "Agent") agentsByClient[p.client] = (agentsByClient[p.client] || 0) + 1; });
  const allTLs = profiles
    .filter(p => p.role === "Team Lead")
    .map(p => ({ id: p.id, name: p.full_name, client: p.client || "—", agentCount: agentsByClient[p.client] || 0 }));

  // Per-TL compliance (Acknowledged only)
  const tlStats = allTLs.map(tl=>{
    const tlC = filteredAll.filter(c=>c.tlName===tl.name);
    const acked = tlC.filter(c=>c.status==="Acknowledged").length;
    const target = targets[tl.name] || 0;
    const pct = target>0 ? Math.min(Math.round((acked/target)*100),100) : null;
    return { ...tl, coachings:tlC, acked, target, pct };
  });

  // EWS breakdown (clickable)
  const ewsData=["Green","Yellow","Red","Imminent"].map(e=>({
    label:e, val:filteredAll.filter(c=>c.ews===e).length,
    color:EWS_STYLE[e]?.text||"#64748b", bg:EWS_STYLE[e]?.bg||"#64748b18",
    coachings:filteredAll.filter(c=>c.ews===e),
  }));

  const typeData=["Performance","Attendance","Attrition Risk"].map(t=>({
    label:t, val:filteredAll.filter(c=>c.type===t).length, color:TYPE_COLOR[t]||"#64748b",
  }));

  const attrByDept={};
  filteredAll.filter(c=>c.type==="Attrition Risk").forEach(c=>{attrByDept[c.dept]=(attrByDept[c.dept]||0)+1;});
  const attrDepts=Object.entries(attrByDept).sort((a,b)=>b[1]-a[1]);
  const maxAttr=Math.max(...Object.values(attrByDept),1);

  const weeklyData=[3,2,1,0].map(wa=>{
    const ws=new Date(now); ws.setDate(now.getDate()-(wa*7)-now.getDay());
    const we=new Date(ws); we.setDate(ws.getDate()+6);
    return { week:wa===0?"This wk":`${wa}w ago`, val:coachings.filter(c=>{const d=new Date(c.date);return d>=ws&&d<=we;}).length };
  });
  const maxW=Math.max(...weeklyData.map(w=>w.val),1);

  const sel={ padding:"6px 10px", borderRadius:8, border:`1px solid ${T.border}`, background:T.inputBg, color:T.text, fontSize:11, outline:"none", fontFamily:"inherit", cursor:"pointer" };

  return (
    <div style={{ padding:"20px 26px" }}>
      {/* Month filter */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <h2 style={{ fontSize:14, fontWeight:700, color:T.text, margin:0 }}>Operations Overview</h2>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <select value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} style={sel}>
            {MONTHS.map(m=><option key={m.val} value={m.val}>{m.label}</option>)}
          </select>
          <select value={filterYear} onChange={e=>setFilterYear(e.target.value)} style={sel}>
            {years.map(y=><option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={()=>setEditingTargets(t=>!t)} style={{ padding:"6px 14px", borderRadius:8, border:`1px solid ${T.accent}40`, background:T.accent+"12", color:T.accent, fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
            {editingTargets?"✓ Save Targets":"🎯 Set Targets"}
          </button>
          {editingTargets && (
            <button onClick={()=>{onSetTargets(localTargets);setEditingTargets(false);}} style={{ padding:"6px 14px", borderRadius:8, border:"none", background:T.accent, color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
              Save
            </button>
          )}
        </div>
      </div>

      {/* Targets editor */}
      {editingTargets && (
        <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:18, marginBottom:20 }}>
          <div style={{ fontSize:12, fontWeight:700, color:T.text, marginBottom:14 }}>🎯 Monthly Coaching Targets per TL</div>
          {/* Dropdown + input row */}
          <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:16 }}>
            <select
              value={targetTL}
              onChange={e=>{ setTargetTL(e.target.value); setTargetVal(localTargets[e.target.value]||""); }}
              style={{ ...sel, flex:1, maxWidth:260 }}
            >
              <option value="">Select a Team Lead...</option>
              {allTLs.map(tl=>(
                <option key={tl.id} value={tl.name}>{tl.name} — {tl.client}</option>
              ))}
            </select>
            <input
              type="number" min="0" max="999"
              value={targetVal}
              onChange={e=>setTargetVal(e.target.value)}
              placeholder="Target #"
              disabled={!targetTL}
              style={{ width:90, padding:"6px 10px", borderRadius:8, border:`1px solid ${T.accent}60`, background:T.inputBg, color:T.accent, fontSize:13, fontWeight:700, outline:"none", textAlign:"center", fontFamily:"inherit" }}
            />
            <span style={{ fontSize:11, color:T.muted }}>/ mo</span>
            <button
              disabled={!targetTL}
              onClick={()=>{ if(targetTL) { setLocalTargets(t=>({...t,[targetTL]:Number(targetVal)||0})); setTargetTL(""); setTargetVal(""); } }}
              style={{ padding:"6px 16px", borderRadius:8, border:"none", background:targetTL?T.accent:"#1e2130", color:targetTL?"#fff":T.muted, fontSize:12, fontWeight:700, cursor:targetTL?"pointer":"default", fontFamily:"inherit" }}
            >Set</button>
          </div>
          {/* Current targets summary */}
          {Object.entries(localTargets).filter(([,v])=>v>0).length > 0 && (
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {Object.entries(localTargets).filter(([,v])=>v>0).map(([name,val])=>(
                <div key={name} style={{ display:"flex", alignItems:"center", gap:6, background:T.bg, border:`1px solid ${T.border}`, borderRadius:8, padding:"6px 10px" }}>
                  <span style={{ fontSize:12, color:T.text, fontWeight:600 }}>{name}</span>
                  <span style={{ fontSize:12, color:T.accent, fontWeight:700 }}>{val}/mo</span>
                  <button onClick={()=>setLocalTargets(t=>{ const n={...t}; delete n[name]; return n; })}
                    style={{ background:"none", border:"none", color:T.muted, cursor:"pointer", fontSize:14, lineHeight:1, padding:"0 2px" }}>×</button>
                </div>
              ))}
            </div>
          )}
          {Object.entries(localTargets).filter(([,v])=>v>0).length === 0 && (
            <div style={{ fontSize:12, color:T.muted }}>No targets set yet.</div>
          )}
        </div>
      )}

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
        {[
          { label:"Total Coachings",  val:filteredAll.length, icon:"📋", color:T.accent,   onClick:()=>setDrilldown({title:"All Coachings", coachings:filteredAll}) },
          { label:"Acknowledged",     val:filteredAll.filter(c=>c.status==="Acknowledged").length, icon:"✅", color:"#10b981", onClick:()=>setDrilldown({title:"Acknowledged Coachings", coachings:filteredAll.filter(c=>c.status==="Acknowledged")}) },
          { label:"Attrition Risks",  val:filteredAll.filter(c=>c.ews==="Red"||c.ews==="Imminent").length, icon:"⚠️", color:"#ef4444", onClick:()=>setDrilldown({title:"Attrition Risks (Red + Imminent)", coachings:filteredAll.filter(c=>c.ews==="Red"||c.ews==="Imminent")}) },
          { label:"Warnings Delivered", val:filteredAll.filter(c=>c.warningDelivered==="Yes").length, icon:"🚨", color:"#f59e0b", onClick:()=>setDrilldown({title:"Coachings with Warning Delivered", coachings:filteredAll.filter(c=>c.warningDelivered==="Yes")}) },
        ].map((s,i)=>(
          <div key={i} onClick={s.onClick} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:"16px 18px", cursor:"pointer" }}
            onMouseEnter={e=>e.currentTarget.style.borderColor=s.color+"60"}
            onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
              <div style={{ fontSize:10, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:"0.05em" }}>{s.label}</div>
              <span style={{ fontSize:18 }}>{s.icon}</span>
            </div>
            <div style={{ fontSize:28, fontWeight:800, color:T.text }}>{s.val}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>
        {/* TL Compliance — clickable rows */}
        <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:18 }}>
          <div style={{ fontSize:12, fontWeight:700, color:T.text, marginBottom:14 }}>Coaching Compliance per TL
            <span style={{ fontSize:10, color:T.muted, fontWeight:400, marginLeft:6 }}>(Acknowledged only · click to drill down)</span>
          </div>
          {tlStats.map((tl,i)=>{
            const cc=complianceColor(tl.pct||0);
            return (
              <div key={i} onClick={()=>setDrilldown({title:`${tl.name} — Coachings (${MONTHS.find(m=>m.val===filterMonth)?.label} ${filterYear})`, coachings:tl.coachings})}
                style={{ marginBottom:14, cursor:"pointer", borderRadius:8, padding:"8px 10px", border:`1px solid transparent`, transition:"border-color 0.15s" }}
                onMouseEnter={e=>e.currentTarget.style.borderColor=T.accent+"60"}
                onMouseLeave={e=>e.currentTarget.style.borderColor="transparent"}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                  <div>
                    <span style={{ fontSize:12, color:T.text, fontWeight:600 }}>{tl.name}</span>
                    <span style={{ fontSize:10, color:T.muted, marginLeft:6 }}>{tl.client}</span>
                  </div>
                  <span style={{ fontSize:12, fontWeight:700, color: tl.pct===null ? T.muted : cc }}>
                    {tl.pct===null ? "No target" : `${tl.pct}%`}
                  </span>
                </div>
                <div style={{ height:6, borderRadius:99, background:T.border }}>
                  {tl.pct!==null && <div style={{ height:"100%", width:`${tl.pct}%`, borderRadius:99, background:cc, transition:"width 0.4s" }} />}
                </div>
                <div style={{ fontSize:10, color:T.muted, marginTop:3 }}>
                  {tl.acked} acknowledged {tl.target>0?`of ${tl.target} target`:""} · {tl.coachings.length} total this period
                </div>
              </div>
            );
          })}
        </div>

        {/* EWS — clickable numbers */}
        <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:18 }}>
          <div style={{ fontSize:12, fontWeight:700, color:T.text, marginBottom:12 }}>EWS Breakdown
            <span style={{ fontSize:10, color:T.muted, fontWeight:400, marginLeft:6 }}>(click to drill down)</span>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:14 }}>
            {ewsData.map((e,i)=>(
              <div key={i} onClick={()=>setDrilldown({title:`EWS: ${e.label} Coachings`, coachings:e.coachings})}
                style={{ background:e.bg, borderRadius:10, padding:"12px 14px", cursor:"pointer", transition:"opacity 0.15s" }}
                onMouseEnter={el=>el.currentTarget.style.opacity="0.8"}
                onMouseLeave={el=>el.currentTarget.style.opacity="1"}>
                <div style={{ fontSize:24, fontWeight:800, color:e.color }}>{e.val}</div>
                <div style={{ fontSize:11, color:e.color, fontWeight:600 }}>{e.label}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize:12, fontWeight:700, color:T.text, marginBottom:10 }}>By Type</div>
          {typeData.map((t,i)=>(
            <div key={i} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
              <div style={{ fontSize:11, color:T.muted, width:100, flexShrink:0 }}>{t.label}</div>
              <div style={{ flex:1, height:7, borderRadius:99, background:T.border }}>
                <div style={{ height:"100%", width:`${filteredAll.length>0?(t.val/filteredAll.length)*100:0}%`, borderRadius:99, background:t.color }} />
              </div>
              <div style={{ fontSize:11, fontWeight:700, color:t.color, width:18 }}>{t.val}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>
        {/* Weekly trending */}
        <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:18 }}>
          <div style={{ fontSize:12, fontWeight:700, color:T.text, marginBottom:14 }}>Weekly Trending</div>
          <div style={{ display:"flex", alignItems:"flex-end", gap:10, height:80 }}>
            {weeklyData.map((w,i)=>(
              <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                <div style={{ fontSize:11, fontWeight:700, color:T.accent }}>{w.val}</div>
                <div style={{ width:"100%", background:i===3?T.accent:T.accent+"55", borderRadius:"4px 4px 0 0", height:`${(w.val/maxW)*60}px`, minHeight:4 }} />
                <div style={{ fontSize:9, color:T.muted }}>{w.week}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Attrition by dept */}
        <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:18 }}>
          <div style={{ fontSize:12, fontWeight:700, color:T.text, marginBottom:14 }}>Attrition Risk by Dept</div>
          {attrDepts.length===0
            ? <div style={{ fontSize:12, color:T.muted, textAlign:"center", paddingTop:20 }}>No attrition risk coachings this period.</div>
            : attrDepts.map(([dept,count],i)=>(
              <div key={i} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                <div style={{ fontSize:11, color:T.muted, width:100, flexShrink:0 }}>{dept}</div>
                <div style={{ flex:1, height:7, borderRadius:99, background:T.border }}>
                  <div style={{ height:"100%", width:`${(count/maxAttr)*100}%`, borderRadius:99, background:"#ef4444" }} />
                </div>
                <div style={{ fontSize:11, fontWeight:700, color:"#ef4444", width:16 }}>{count}</div>
              </div>
            ))}
        </div>
      </div>


      {/* Drilldown modal — coachings */}
      {drilldown && (
        <DrilldownModal
          title={drilldown.title}
          coachings={drilldown.coachings}
          T={T}
          onClose={()=>setDrilldown(null)}
          onOpenCoaching={onOpenCoaching}
        />
      )}

      {/* Drilldown modal — warnings */}
      {warnDrill && (
        <div onClick={()=>setWarnDrill(null)} style={{ position:"fixed", inset:0, background:"#00000099", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, padding:20 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:18, width:"100%", maxWidth:680, maxHeight:"85vh", display:"flex", flexDirection:"column", boxShadow:"0 32px 80px #00000070" }}>
            <div style={{ padding:"18px 22px 14px", borderBottom:`1px solid ${T.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontSize:15, fontWeight:700, color:T.text }}>{warnDrill.title}</div>
              <button onClick={()=>setWarnDrill(null)} style={{ background:"none", border:"none", color:T.muted, cursor:"pointer", fontSize:20 }}>×</button>
            </div>
            <div style={{ overflowY:"auto", flex:1 }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead style={{ position:"sticky", top:0, background:T.card }}>
                  <tr style={{ borderBottom:`1px solid ${T.border}` }}>
                    {["Specialist","Dept","Type","Date","TL","Status"].map(h=>(
                      <th key={h} style={{ padding:"9px 14px", textAlign:"left", fontSize:10, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:"0.05em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {warnDrill.warnings.length===0
                    ? <tr><td colSpan={6} style={{ textAlign:"center", padding:36, color:T.muted, fontSize:13 }}>No warnings.</td></tr>
                    : warnDrill.warnings.map((w,i)=>{
                      const ws=WARNING_STYLE[w.warningType]||{};
                      return (
                        <tr key={w.id} style={{ borderBottom:i<warnDrill.warnings.length-1?`1px solid ${T.border}`:"none" }}
                          onMouseEnter={e=>e.currentTarget.style.background=T.hover}
                          onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                          <td style={{ padding:"11px 14px", fontSize:12, color:T.text, fontWeight:500 }}>{w.agentName}</td>
                          <td style={{ padding:"11px 14px", fontSize:11, color:T.muted }}>{w.dept}</td>
                          <td style={{ padding:"11px 14px" }}><span style={{ fontSize:10, fontWeight:700, color:ws.color, background:ws.bg, padding:"3px 8px", borderRadius:99 }}>{ws.icon} {w.warningType}</span></td>
                          <td style={{ padding:"11px 14px", fontSize:11, color:T.muted }}>{w.date}</td>
                          <td style={{ padding:"11px 14px", fontSize:11, color:T.muted }}>{w.createdBy||"—"}</td>
                          <td style={{ padding:"11px 14px", fontSize:11, fontWeight:600, color:w.acknowledgedAt?"#10b981":"#f59e0b" }}>{w.acknowledgedAt?"✓ Acknowledged":"Pending"}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            <div style={{ padding:"12px 22px", borderTop:`1px solid ${T.border}`, fontSize:11, color:T.muted }}>
              {warnDrill.warnings.length} warning{warnDrill.warnings.length!==1?"s":""}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function CoachingHub({ userProfile, onLogout, onOpenAdmin }) {
  const [darkMode, setDarkMode] = useState(true);
  const T = darkMode ? THEMES.dark : THEMES.light;

  const role       = (userProfile?.role || "").trim();
  const selfName   = userProfile?.full_name || "User";
  const isSpecialist = role === "Agent";
  const isTL         = role === "Team Lead";
  const isHR         = role === "HR";
  const isManager    = role === "Manager";

  const [activeTab,          setActiveTab]          = useState("dashboard");
  const [showCoachingModal,  setShowCoachingModal]  = useState(false);
  const [showWarningModal,   setShowWarningModal]   = useState(false);
  const [coachingDraft,      setCoachingDraft]      = useState(null);
  const [warningDraft,       setWarningDraft]       = useState(null);
  const [selectedCoaching,   setSelectedCoaching]   = useState(null);
  const [showTriadModal,     setShowTriadModal]     = useState(false);
  const [selectedTriad,      setSelectedTriad]      = useState(null);
  const [profiles,           setProfiles]           = useState([]);
  const [coachings,          setCoachings]          = useState([]);
  const [warnings,           setWarnings]           = useState([]);
  const [triads,             setTriads]             = useState([]);
  const [loadingCoachings,   setLoadingCoachings]   = useState(true);

  // Targets: { [tlName]: number } — persisted in localStorage
  const [targets, setTargets] = useState(() => {
    try { return JSON.parse(localStorage.getItem("coaching_targets") || "{}"); }
    catch { return {}; }
  });

  const handleSetTargets = (newTargets) => {
    setTargets(newTargets);
    try { localStorage.setItem("coaching_targets", JSON.stringify(newTargets)); } catch {}
  };

  // Fetch profiles to group agents by client
  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .order("full_name");
        if (!error && data) {
          setProfiles(data);
        }
      } catch (e) {
        console.error("Error fetching profiles:", e);
      }
    };
    fetchProfiles();
  }, []);

  // Fetch coachings and warnings from Supabase
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoadingCoachings(true);
        
        // Fetch coachings
        const { data: coachingsData, error: coachingsError } = await supabase
          .from("coachings")
          .select("*")
          .order("created_at", { ascending: false });

        if (!coachingsError && coachingsData) {
          setCoachings(coachingsData.map(normCoaching));
        }

        // Fetch warnings
        const { data: warningsData, error: warningsError } = await supabase
          .from("warnings")
          .select("*")
          .order("created_at", { ascending: false });

        if (!warningsError && warningsData) {
          setWarnings(warningsData.map(normWarning));
        }
      } catch (e) {
        console.error("Error fetching data:", e);
      } finally {
        setLoadingCoachings(false);
      }
    };
    
    fetchData();
  }, []);

  // Fetch triads
  useEffect(() => {
    const fetchTriads = async () => {
      try {
        const { data, error } = await supabase
          .from("triads")
          .select("*")
          .order("created_at", { ascending: false });
        if (!error && data) setTriads(data.map(normTriad));
      } catch (e) {
        console.error("Error fetching triads:", e);
      }
    };
    fetchTriads();
  }, []);

  const visibleCoachings = isSpecialist
    ? coachings.filter(c=>(c.agentName||"").toLowerCase()===selfName.toLowerCase())
    : coachings;

  const visibleWarnings = isSpecialist
    ? warnings.filter(w=>(w.agentName||"").toLowerCase()===selfName.toLowerCase())
    : warnings;

  const handleSaveCoaching = async (form) => {
    await saveCoaching(form);
    setCoachingDraft(null);
  };

  const handleSaveWarning = async (form) => {
    await saveWarning(form);
    setWarningDraft(null);
  };

  const saveCoaching = async (form) => {
    try {
      const warningFields = { warningDelivered: form.warningDelivered, warningType: form.warningDelivered === "Yes" ? form.warningType : "" };
      const topAgentField = { topAgent: form.topAgent };
      const buildExtraData = () => {
        switch (form.coachingReason) {
          case "General coaching":
            return { kpiPerformance: form.kpiPerformance, kpisDiscussed: form.kpisDiscussed, kpiRiskFlag: form.kpiRiskFlag, kpiRiskDetail: form.kpiRiskDetail, prodQualityNotes: form.prodQualityNotes, prodRiskFlag: form.prodRiskFlag, prodRiskDetail: form.prodRiskDetail, genAttNotes: form.genAttNotes, genAttRiskFlag: form.genAttRiskFlag, genAttRiskDetail: form.genAttRiskDetail, ...warningFields, ...topAgentField };
          case "Productivity":
            return { currentProductivity: form.currentProductivity, productivityQuality: form.productivityQuality, rootCause: form.rootCause, prodComment: form.prodComment, agentCommit: form.agentCommit, tlCommit: form.tlCommit, ...warningFields, ...topAgentField };
          case "Attendance":
            return { attendanceProblem: form.attendanceProblem, attRootCause: form.attRootCause, agentCommit: form.agentCommit, tlCommit: form.tlCommit, ...warningFields, ...topAgentField };
          case "Attrition risk":
            return { redFlag: form.redFlag, otherReason: form.otherReason, companyActions: form.companyActions, agentCommit: form.agentCommit, ...warningFields, ...topAgentField };
          default: return {};
        }
      };

      const newCoaching = {
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        tl_name: selfName,
        status: "Pending",
        client: form.client,
        agent_name: form.agentName,
        dept: form.dept,
        date: form.date,
        type: form.coachingReason,
        mood: form.mood,
        ews: form.ews,
        notes: form.notes,
        extra_data: buildExtraData(),
      };
      
      const { data, error } = await supabase
        .from("coachings")
        .insert([newCoaching])
        .select();
      
      if (!error && data) {
        setCoachings(cs => [normCoaching(data[0]), ...cs]);
      } else {
        console.error("Error saving coaching:", error);
      }
    } catch (e) {
      console.error("Error in saveCoaching:", e);
    }
  };

  const saveWarning = async (form) => {
    try {
      const newWarning = {
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        created_by: selfName,
        client: form.client,
        agent_name: form.agentName,
        dept: form.dept,
        date: form.date,
        warning_type: form.warningType,
        situation_desc: form.situationDesc,
        unfulfilled_exp: form.unfulfilledExp,
        follow_up_period: form.followUpPeriod,
        areas_of_concern: form.areasOfConcern,
        recommended_actions: form.recommendedActions,
        facts: form.facts,
        employee_statement: form.employeeStatement,
        witness1_name: form.witness1Name,
        witness2_name: form.witness2Name,
        status: "Pending",
      };
      
      const { data, error } = await supabase
        .from("warnings")
        .insert([newWarning])
        .select();
      
      if (!error && data) {
        setWarnings(ws => [normWarning(data[0]), ...ws]);
      } else {
        console.error("Error saving warning:", error);
      }
    } catch (e) {
      console.error("Error in saveWarning:", e);
    }
  };

  const deliverCoaching = async (id) => {
    try {
      const { error } = await supabase
        .from("coachings")
        .update({ status: "Delivered" })
        .eq("id", id);
      
      if (!error) {
        setCoachings(cs=>cs.map(c=>c.id===id?{...c,status:"Delivered"}:c));
      }
    } catch (e) {
      console.error("Error delivering coaching:", e);
    }
  };

  const acknowledgeCoaching = async (id, rating, comment) => {
    try {
      const { error } = await supabase
        .from("coachings")
        .update({
          status: "Acknowledged",
          agent_rating: rating,
          agent_comment: comment
        })
        .eq("id", id);
      
      if (!error) {
        setCoachings(cs=>cs.map(c=>c.id===id?{...c,status:"Acknowledged",agentRating:rating,agentComment:comment}:c));
      }
    } catch (e) {
      console.error("Error acknowledging coaching:", e);
    }
  };

  const deleteCoaching = async (id) => {
    try {
      const { error } = await supabase
        .from("coachings")
        .delete()
        .eq("id", id);
      
      if (!error) {
        setCoachings(cs=>cs.filter(c=>c.id!==id));
      }
    } catch (e) {
      console.error("Error deleting coaching:", e);
    }
  };

  const deleteWarning = async (id) => {
    try {
      const { error } = await supabase
        .from("warnings")
        .delete()
        .eq("id", id);
      
      if (!error) {
        setWarnings(ws=>ws.filter(w=>w.id!==id));
      }
    } catch (e) {
      console.error("Error deleting warning:", e);
    }
  };

  const saveTriad = async (form) => {
    try {
      const newTriad = {
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        manager_name: selfName,
        tl_name: form.tlName,
        agent_name: form.agentName,
        coaching_id: form.coachingId || null,
        date: form.date,
        strengths: form.strengths,
        areas_of_improvement: form.areasOfImprovement,
        action_plan: form.actionPlan,
        follow_up_date: form.followUpDate,
        notes: form.notes,
        status: "Pending",
      };
      const { data, error } = await supabase.from("triads").insert([newTriad]).select();
      if (!error && data) {
        setTriads(ts => [normTriad(data[0]), ...ts]);
        setShowTriadModal(false);
      } else {
        console.error("Error saving triad:", error);
      }
    } catch (e) {
      console.error("Error in saveTriad:", e);
    }
  };

  const acknowledgeTriad = async (id, rating, comment) => {
    try {
      const { error } = await supabase.from("triads").update({
        status: "Acknowledged",
        tl_rating: rating,
        tl_comment: comment,
        acknowledged_at: new Date().toISOString(),
      }).eq("id", id);
      if (!error) {
        setTriads(ts => ts.map(t => t.id === id ? { ...t, status:"Acknowledged", tlRating:rating, tlComment:comment, acknowledgedAt:new Date().toISOString() } : t));
        setSelectedTriad(null);
      }
    } catch (e) {
      console.error("Error acknowledging triad:", e);
    }
  };

  const visibleTriads = isTL
    ? triads.filter(t => (t.tlName||"").toLowerCase() === selfName.toLowerCase())
    : triads;

  const navItems = [
    { id:"dashboard", icon:"⊞", label:"Dashboard" },
    ...(isTL||isManager   ? [{ id:"coachings", icon:"📋", label:"Coachings" }] : []),
    ...(isSpecialist       ? [{ id:"coachings", icon:"📋", label:"My Coachings" }] : []),
    ...(isManager          ? [{ id:"triads",    icon:"🤝", label:"Manager Triad" }] : []),
    ...(isTL               ? [{ id:"triads",    icon:"🤝", label:"My Triads" }] : []),
  ];

  return (
    <div style={{ fontFamily:"'Poppins','Questrial',sans-serif", background:T.bg, minHeight:"100vh", display:"flex", color:T.text, transition:"background 0.25s,color 0.25s" }}>

      {/* Sidebar */}
      <div style={{ width:228, background:T.sidebar, borderRight:`1px solid ${T.border}`, display:"flex", flexDirection:"column", flexShrink:0, transition:"background 0.25s" }}>
        <div style={{ padding:"18px 18px 14px", borderBottom:`1px solid ${T.border}` }}>
          <div style={{ fontSize:15, fontWeight:800, color:T.accent, letterSpacing:"0.02em" }}>Amalga</div>
          <div style={{ fontSize:9, color:T.muted, letterSpacing:"0.12em", textTransform:"uppercase", marginTop:2 }}>Coaching Hub</div>
        </div>

        <nav style={{ flex:1, padding:"12px 10px" }}>
          {navItems.map(item=>(
            <button key={item.id} type="button" onClick={()=>setActiveTab(item.id)}
              style={{ width:"100%", display:"flex", alignItems:"center", gap:9, padding:"8px 11px", borderRadius:8, border:"none", cursor:"pointer", marginBottom:2,
                background:activeTab===item.id?T.accent+"18":"transparent",
                color:activeTab===item.id?T.accent:T.muted,
                fontWeight:activeTab===item.id?700:500, fontSize:13, textAlign:"left", fontFamily:"inherit" }}>
              <span>{item.icon}</span>{item.label}
            </button>
          ))}
          {(isTL || isManager) && (
            <div style={{ marginTop:10, display:"flex", flexDirection:"column", gap:5 }}>
              <button type="button" onClick={()=>setShowCoachingModal(true)}
                style={{ width:"100%", display:"flex", alignItems:"center", gap:8, padding:"8px 11px", borderRadius:8, border:`1px solid ${T.accent}40`, background:T.accent+"12", color:T.accent, fontWeight:600, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
                <span>+</span> New Coaching
                {coachingDraft && <span style={{ marginLeft:"auto", fontSize:9, background:T.accent, color:"#fff", borderRadius:99, padding:"1px 6px" }}>draft</span>}
              </button>
            </div>
          )}
          {isManager && (
            <div style={{ marginTop:5 }}>
              <button type="button" onClick={()=>{ setActiveTab("triads"); setShowTriadModal(true); }}
                style={{ width:"100%", display:"flex", alignItems:"center", gap:8, padding:"8px 11px", borderRadius:8, border:`1px solid #14b8a640`, background:"#14b8a612", color:"#14b8a6", fontWeight:600, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
                <span>+</span> New Triad
              </button>
            </div>
          )}
        </nav>

        <div style={{ padding:"12px 16px", borderTop:`1px solid ${T.border}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:10 }}>
            <div style={{ width:30, height:30, borderRadius:"50%", background:T.accent+"22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:T.accent, flexShrink:0 }}>
              {selfName.split(" ").slice(0,2).map(n=>n[0]).join("").toUpperCase()}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:600, color:T.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{selfName}</div>
              <div style={{ fontSize:10, color:T.muted }}>{role} · {userProfile?.client||"Amalga"}</div>
            </div>
          </div>
          <button type="button" onClick={()=>setDarkMode(d=>!d)}
            style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"7px 10px", borderRadius:8, border:`1px solid ${T.border}`, background:"transparent", cursor:"pointer", color:T.muted, fontSize:11, fontFamily:"inherit", marginBottom:6 }}>
            <span>{darkMode?"🌙 Dark":"☀️ Light"}</span>
            <div style={{ width:32, height:18, borderRadius:99, background:darkMode?T.accent:T.border, position:"relative", transition:"background 0.2s", flexShrink:0 }}>
              <div style={{ width:14, height:14, borderRadius:"50%", background:"#fff", position:"absolute", top:2, left:darkMode?16:2, transition:"left 0.2s" }} />
            </div>
          </button>
          {onOpenAdmin && (
            <button type="button" onClick={onOpenAdmin}
              style={{ width:"100%", padding:"7px 10px", borderRadius:8, border:`1px solid ${T.accent}40`, background:T.accent+"12", color:T.accent, fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"inherit", marginBottom:6 }}>
              ⚙️ Manage Users
            </button>
          )}
          <button type="button" onClick={onLogout}
            style={{ width:"100%", padding:"7px 10px", borderRadius:8, border:`1px solid ${T.border}`, background:"transparent", color:T.muted, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>
            Sign Out
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex:1, overflow:"auto" }}>
        <div style={{ padding:"14px 26px", borderBottom:`1px solid ${T.border}`, display:"flex", justifyContent:"space-between", alignItems:"center", position:"sticky", top:0, background:T.headerBg, zIndex:10, transition:"background 0.25s" }}>
          <div>
            <h1 style={{ fontSize:18, fontWeight:700, color:T.text, margin:0 }}>
              {getGreeting()}, {selfName.split(" ")[0]} 👋
            </h1>
            <p style={{ fontSize:11, color:T.muted, margin:"3px 0 0" }}>
              {new Date().toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"})} · {role}
            </p>
          </div>
          <div style={{ fontSize:11, color:T.muted, background:T.card, border:`1px solid ${T.border}`, borderRadius:8, padding:"5px 12px" }}>
            {userProfile?.client||"Amalga Group"}
          </div>
        </div>

        {/* Route views */}
        {showCoachingModal ? (
          <CoachingModal T={T} onClose={()=>setShowCoachingModal(false)} onSave={handleSaveCoaching} clientProfiles={profiles} initialForm={coachingDraft} onDraftChange={setCoachingDraft} />
        ) : showWarningModal ? (
          <WarningModal T={T} onClose={()=>setShowWarningModal(false)} onSave={handleSaveWarning} clientProfiles={profiles} initialForm={warningDraft} onDraftChange={setWarningDraft} />
        ) : (activeTab==="triads" && isManager && showTriadModal) ? (
          <TriadModal onClose={()=>setShowTriadModal(false)} onSave={saveTriad} profiles={profiles} coachings={coachings} selfName={selfName} T={T} />
        ) : (
          <>
            {activeTab==="dashboard" && (isTL||isSpecialist) && (
              <DashboardView coachings={visibleCoachings} warnings={visibleWarnings} role={role} T={T} onOpenCoaching={setSelectedCoaching} targets={targets} isSpecialist={isSpecialist} />
            )}
            {activeTab==="dashboard" && isManager && (
              <ManagerView coachings={coachings} warnings={warnings} T={T} onOpenCoaching={setSelectedCoaching} targets={targets} onSetTargets={handleSetTargets} profiles={profiles} />
            )}
            {activeTab==="dashboard" && isHR && (
              <HRView warnings={visibleWarnings} onNewWarning={()=>setShowWarningModal(true)} T={T} />
            )}
            {activeTab==="coachings" && (
              <CoachingsListView coachings={visibleCoachings} isSpecialist={isSpecialist} T={T} onOpenCoaching={setSelectedCoaching} onDeliver={deliverCoaching} onDeleteCoaching={!isSpecialist ? deleteCoaching : null} />
            )}
            {activeTab==="triads" && isManager && !showTriadModal && (
              <TLTriadView triads={triads} T={T} onOpenTriad={setSelectedTriad} />
            )}
            {activeTab==="triads" && isTL && (
              <TLTriadView triads={visibleTriads} T={T} onOpenTriad={setSelectedTriad} />
            )}
          </>
        )}
      </div>

      {selectedCoaching && <CoachingDetailModal coaching={selectedCoaching} onClose={()=>setSelectedCoaching(null)} onAcknowledge={acknowledgeCoaching} isAgent={isSpecialist} T={T} />}
      {selectedTriad && <TriadDetailModal triad={selectedTriad} onClose={()=>setSelectedTriad(null)} onAcknowledge={acknowledgeTriad} T={T} />}
    </div>
  );
}