// src/components/OnboardingForm.jsx
// ─────────────────────────────────────────────────────────────
// Multi-step onboarding.
// After the user fills everything out, it:
//   1. POSTs to /profile/save (stores in DB, runs persona detection)
//   2. Calls onComplete() to move the app to the Chat screen
//
// The profile is now permanently saved — next login skips this.
// ─────────────────────────────────────────────────────────────

import { useState } from "react";
import { apiSaveProfile, apiGetMe } from "../api";

const QUIZ_OPTIONS = {
  q1: [
    { value: "invest_all",          label: "Invest all of it 📈" },
    { value: "invest_half_travel",  label: "Half invest, half travel ✈️" },
    { value: "pay_off_debt",        label: "Pay off debt first 💳" },
    { value: "buy_something_wanted",label: "Buy something I've wanted 🛍️" },
    { value: "save_for_family_goal",label: "Save for a family goal 👨‍👩‍👧" },
  ],
  q2: [
    { value: "not_having_enough_to_retire", label: "Not having enough to retire 😰" },
    { value: "missing_out_on_experiences",  label: "Missing out on experiences 🌍" },
    { value: "stuck_in_debt_forever",        label: "Being stuck in debt forever 😔" },
    { value: "being_a_burden_on_family",     label: "Being a burden on family 💔" },
    { value: "losing_money_in_market",       label: "Losing money in market crash 📉" },
  ],
  q3: [
    { value: "before_45",                  label: "Before 45 🏖️" },
    { value: "at_60",                      label: "Around 60 🧘" },
    { value: "never_want_to_retire",       label: "Never — I love working 💪" },
    { value: "flexible_whenever_i_can",    label: "Flexible, whenever I can 🤷" },
  ],
};

const STEPS = ["basics", "finances", "insurance", "quiz", "saving"];

export default function OnboardingForm({ userName, onComplete }) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Financial fields
  const [form, setForm] = useState({
    age: "", city: "", city_tier: "metro", dependants: 0,
    tax_regime: "new", monthly_income: "", monthly_expenses: "",
    existing_investments: 0, outstanding_debt: 0, liquid_savings: 0,
    term_insurance_cover: 0, health_insurance_cover: 0,
    existing_80c_investments: 0, existing_nps_contribution: 0,
    health_premium_paid: 0, goals: ["retirement"],
  });

  // Quiz answers
  const [q1, setQ1] = useState("");
  const [q2, setQ2] = useState("");
  const [q3, setQ3] = useState("");
  const [expPct, setExpPct] = useState(20);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function finish() {
    setSaving(true);
    setError("");
    try {
      const financialData = {
        ...form,
        name: userName,
        age: Number(form.age),
        monthly_income: Number(form.monthly_income),
        monthly_expenses: Number(form.monthly_expenses),
        existing_investments: Number(form.existing_investments),
        outstanding_debt: Number(form.outstanding_debt),
        liquid_savings: Number(form.liquid_savings),
        term_insurance_cover: Number(form.term_insurance_cover),
        health_insurance_cover: Number(form.health_insurance_cover),
        existing_80c_investments: Number(form.existing_80c_investments),
        existing_nps_contribution: Number(form.existing_nps_contribution),
        health_premium_paid: Number(form.health_premium_paid),
        dependants: Number(form.dependants),
      };
      const quizAnswers = [q1, q2, q3];
      const result = await apiSaveProfile(financialData, quizAnswers, expPct);
      const meData = await apiGetMe();
      onComplete(
        financialData,
        quizAnswers,
        meData.persona && Object.keys(meData.persona).length > 1
          ? meData.persona
          : { type: result.persona_type }
      );
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  const pct = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <div style={s.root}>
      <div style={s.card}>
        {/* Header */}
        <div style={s.header}>
          <div style={s.logo}>₹</div>
          <h2 style={s.title}>
            {step === 0 && `Welcome, ${userName || "friend"}! 👋`}
            {step === 1 && "Your Finances"}
            {step === 2 && "Protection Check"}
            {step === 3 && "Quick Quiz"}
            {step === 4 && saving ? "Saving your profile…" : "Almost done!"}
          </h2>
          <p style={s.subtitle}>
            {step === 0 && "Let's set up your financial profile. Takes ~2 minutes."}
            {step === 1 && "Monthly numbers only — approximate is fine."}
            {step === 2 && "Insurance gaps are the #1 financial blind spot in India."}
            {step === 3 && "3 quick questions to personalise your experience."}
            {step === 4 && "Review and save your profile."}
          </p>
        </div>

        {/* Progress bar */}
        <div style={s.progressWrap}>
          <div style={{ ...s.progressBar, width: `${pct}%` }} />
        </div>
        <p style={s.progressLabel}>Step {step + 1} of {STEPS.length}</p>

        {/* ── Step 0: Basics ── */}
        {step === 0 && (
          <div style={s.fields}>
            <Field label="Age" hint="18–70">
              <input style={s.input} type="number" min={18} max={70}
                value={form.age} onChange={(e) => update("age", e.target.value)} placeholder="28" />
            </Field>
            <Field label="City">
              <input style={s.input} type="text"
                value={form.city} onChange={(e) => update("city", e.target.value)} placeholder="Mumbai" />
            </Field>
            <Field label="City type">
              <Select value={form.city_tier} onChange={(v) => update("city_tier", v)}
                options={[["metro","Metro"], ["tier2","Tier 2"], ["tier3","Tier 3"]]} />
            </Field>
            <Field label="Dependants" hint="children + elderly parents">
              <input style={s.input} type="number" min={0}
                value={form.dependants} onChange={(e) => update("dependants", e.target.value)} placeholder="0" />
            </Field>
            <Field label="Tax regime">
              <Select value={form.tax_regime} onChange={(v) => update("tax_regime", v)}
                options={[["new","New regime (default)"], ["old","Old regime"]]} />
            </Field>
          </div>
        )}

        {/* ── Step 1: Finances ── */}
        {step === 1 && (
          <div style={s.fields}>
            <Field label="Monthly take-home income (₹)" required>
              <input style={s.input} type="number" min={1}
                value={form.monthly_income} onChange={(e) => update("monthly_income", e.target.value)}
                placeholder="75000" />
            </Field>
            <Field label="Monthly expenses (₹)" required>
              <input style={s.input} type="number" min={1}
                value={form.monthly_expenses} onChange={(e) => update("monthly_expenses", e.target.value)}
                placeholder="45000" />
            </Field>
            <Field label="Existing investments (₹)" hint="MF, FD, stocks, etc.">
              <input style={s.input} type="number" min={0}
                value={form.existing_investments} onChange={(e) => update("existing_investments", e.target.value)}
                placeholder="200000" />
            </Field>
            <Field label="Liquid savings (₹)" hint="Savings account + FD redeemable in <1 month">
              <input style={s.input} type="number" min={0}
                value={form.liquid_savings} onChange={(e) => update("liquid_savings", e.target.value)}
                placeholder="50000" />
            </Field>
            <Field label="Total outstanding debt (₹)" hint="Home loan + personal loan + credit card">
              <input style={s.input} type="number" min={0}
                value={form.outstanding_debt} onChange={(e) => update("outstanding_debt", e.target.value)}
                placeholder="0" />
            </Field>
          </div>
        )}

        {/* ── Step 2: Insurance ── */}
        {step === 2 && (
          <div style={s.fields}>
            <Field label="Term insurance cover (₹)" hint="Life cover amount. 0 if none.">
              <input style={s.input} type="number" min={0}
                value={form.term_insurance_cover} onChange={(e) => update("term_insurance_cover", e.target.value)}
                placeholder="10000000" />
            </Field>
            <Field label="Health insurance cover (₹)">
              <input style={s.input} type="number" min={0}
                value={form.health_insurance_cover} onChange={(e) => update("health_insurance_cover", e.target.value)}
                placeholder="500000" />
            </Field>
            <Field label="Already invested under 80C (₹/year)" hint="EPF, PPF, ELSS, LIC etc.">
              <input style={s.input} type="number" min={0}
                value={form.existing_80c_investments} onChange={(e) => update("existing_80c_investments", e.target.value)}
                placeholder="72000" />
            </Field>
            <Field label="NPS contribution (₹/year)">
              <input style={s.input} type="number" min={0}
                value={form.existing_nps_contribution} onChange={(e) => update("existing_nps_contribution", e.target.value)}
                placeholder="0" />
            </Field>
            <Field label="Health insurance premium paid (₹/year)">
              <input style={s.input} type="number" min={0}
                value={form.health_premium_paid} onChange={(e) => update("health_premium_paid", e.target.value)}
                placeholder="15000" />
            </Field>
          </div>
        )}

        {/* ── Step 3: Quiz ── */}
        {step === 3 && (
          <div style={s.fields}>
            <div style={s.quizSection}>
              <p style={s.quizQ}>₹50,000 lands in your account unexpectedly. What do you do?</p>
              {QUIZ_OPTIONS.q1.map((o) => (
                <QuizOption key={o.value} label={o.label} selected={q1 === o.value}
                  onClick={() => setQ1(o.value)} />
              ))}
            </div>
            <div style={s.quizSection}>
              <p style={s.quizQ}>What's your single biggest financial fear?</p>
              {QUIZ_OPTIONS.q2.map((o) => (
                <QuizOption key={o.value} label={o.label} selected={q2 === o.value}
                  onClick={() => setQ2(o.value)} />
              ))}
            </div>
            <div style={s.quizSection}>
              <p style={s.quizQ}>When do you want to retire?</p>
              {QUIZ_OPTIONS.q3.map((o) => (
                <QuizOption key={o.value} label={o.label} selected={q3 === o.value}
                  onClick={() => setQ3(o.value)} />
              ))}
            </div>
            <div style={s.sliderWrap}>
              <p style={s.quizQ}>What % of your spending goes to experiences? (travel, dining, events)</p>
              <input type="range" min={0} max={100} value={expPct}
                onChange={(e) => setExpPct(Number(e.target.value))} style={s.slider} />
              <p style={s.sliderLabel}>{expPct}%</p>
            </div>
          </div>
        )}

        {/* ── Step 4: Confirm + Save ── */}
        {step === 4 && (
          <div style={s.fields}>
            <div style={s.summaryGrid}>
              <SummaryItem label="Monthly income" value={`₹${Number(form.monthly_income).toLocaleString("en-IN")}`} />
              <SummaryItem label="Monthly expenses" value={`₹${Number(form.monthly_expenses).toLocaleString("en-IN")}`} />
              <SummaryItem label="Savings rate"
                value={`${Math.round(((form.monthly_income - form.monthly_expenses) / form.monthly_income) * 100)}%`} />
              <SummaryItem label="Existing corpus" value={`₹${Number(form.existing_investments).toLocaleString("en-IN")}`} />
              <SummaryItem label="Outstanding debt" value={`₹${Number(form.outstanding_debt).toLocaleString("en-IN")}`} />
              <SummaryItem label="Term cover" value={`₹${Number(form.term_insurance_cover).toLocaleString("en-IN")}`} />
            </div>
            {error && <p style={s.error}>{error}</p>}
          </div>
        )}

        {/* Navigation */}
        <div style={s.nav}>
          {step > 0 && (
            <button style={s.backBtn} onClick={() => setStep((s) => s - 1)} disabled={saving}>
              ← Back
            </button>
          )}
          {step < STEPS.length - 1 && (
            <button
              style={{ ...s.nextBtn, marginLeft: step === 0 ? "auto" : 0 }}
              onClick={() => setStep((s) => s + 1)}
              disabled={!canAdvance(step, form, q1, q2, q3)}
            >
              Continue →
            </button>
          )}
          {step === STEPS.length - 1 && (
            <button
              style={{ ...s.nextBtn, marginLeft: "auto", background: "linear-gradient(135deg, #d4a853, #8a6a2a)" }}
              onClick={finish}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save & Start →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────
function canAdvance(step, form, q1, q2, q3) {
  if (step === 0) return form.age && form.city;
  if (step === 1) return form.monthly_income && form.monthly_expenses;
  if (step === 3) return q1 && q2 && q3;
  return true;
}

function Field({ label, hint, children }) {
  return (
    <div style={s.fieldWrap}>
      <label style={s.label}>{label}{hint && <span style={s.hint}> — {hint}</span>}</label>
      {children}
    </div>
  );
}

function Select({ value, onChange, options }) {
  return (
    <select style={s.input} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

function QuizOption({ label, selected, onClick }) {
  return (
    <button
      style={{ ...s.quizOpt, ...(selected ? s.quizOptSelected : {}) }}
      onClick={onClick} type="button"
    >
      {selected && <span style={{ marginRight: 8 }}>✓</span>}
      {label}
    </button>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div style={s.summaryItem}>
      <span style={s.summaryLabel}>{label}</span>
      <span style={s.summaryValue}>{value}</span>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────
const C = {
  bg: "#0f1117", surface: "#1a1d27", border: "#2a2d3e",
  gold: "#d4a853", goldDim: "#8a6a2a", text: "#e8e4d9",
  muted: "#7a7a8c", error: "#e05c5c", inputBg: "#13151f",
};

const s = {
  root: {
    minHeight: "100vh", background: C.bg,
    display: "flex", alignItems: "flex-start",
    justifyContent: "center", padding: "40px 24px",
    fontFamily: "system-ui, sans-serif",
  },
  card: {
    background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: 20, padding: "40px",
    width: "100%", maxWidth: 560,
    boxShadow: "0 24px 80px rgba(0,0,0,0.4)",
  },
  header: { textAlign: "center", marginBottom: 28 },
  logo: {
    display: "inline-flex", alignItems: "center",
    justifyContent: "center", width: 44, height: 44,
    borderRadius: 12, background: `linear-gradient(135deg, ${C.gold}, ${C.goldDim})`,
    color: C.bg, fontSize: 22, fontWeight: 900, marginBottom: 12,
  },
  title: { margin: 0, fontSize: 22, fontWeight: 700, color: C.text },
  subtitle: { margin: "8px 0 0", fontSize: 14, color: C.muted },
  progressWrap: {
    height: 4, background: C.border, borderRadius: 2,
    marginBottom: 8, overflow: "hidden",
  },
  progressBar: {
    height: "100%", borderRadius: 2,
    background: `linear-gradient(90deg, ${C.gold}, ${C.goldDim})`,
    transition: "width 0.3s ease",
  },
  progressLabel: { fontSize: 12, color: C.muted, textAlign: "right", margin: "0 0 24px" },
  fields: { display: "flex", flexDirection: "column", gap: 16 },
  fieldWrap: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 12, fontWeight: 600, color: C.muted, letterSpacing: "0.6px", textTransform: "uppercase" },
  hint: { fontWeight: 400, textTransform: "none", fontSize: 11 },
  input: {
    background: C.inputBg, border: `1px solid ${C.border}`,
    borderRadius: 10, padding: "11px 14px",
    color: C.text, fontSize: 15, outline: "none", width: "100%", boxSizing: "border-box",
  },
  quizSection: { display: "flex", flexDirection: "column", gap: 8 },
  quizQ: { fontSize: 14, fontWeight: 600, color: C.text, margin: "0 0 6px" },
  quizOpt: {
    background: C.inputBg, border: `1px solid ${C.border}`,
    borderRadius: 10, padding: "11px 14px",
    color: C.muted, fontSize: 14, cursor: "pointer",
    textAlign: "left", transition: "all 0.15s",
  },
  quizOptSelected: { borderColor: C.gold, color: C.text, background: "rgba(212,168,83,0.08)" },
  sliderWrap: { display: "flex", flexDirection: "column", gap: 8 },
  slider: { width: "100%", accentColor: C.gold },
  sliderLabel: { fontSize: 18, fontWeight: 700, color: C.gold, margin: 0, textAlign: "center" },
  summaryGrid: {
    display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
  },
  summaryItem: {
    background: C.inputBg, border: `1px solid ${C.border}`,
    borderRadius: 10, padding: "12px 14px",
    display: "flex", flexDirection: "column", gap: 4,
  },
  summaryLabel: { fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px" },
  summaryValue: { fontSize: 16, fontWeight: 700, color: C.text },
  nav: { display: "flex", gap: 12, marginTop: 28, alignItems: "center" },
  backBtn: {
    background: "transparent", border: `1px solid ${C.border}`,
    borderRadius: 10, padding: "12px 20px",
    color: C.muted, fontSize: 14, cursor: "pointer", fontWeight: 600,
  },
  nextBtn: {
    flex: 1, background: C.gold, border: "none",
    borderRadius: 10, padding: "13px",
    color: C.bg, fontSize: 15, fontWeight: 800,
    cursor: "pointer", transition: "opacity 0.2s",
  },
  error: {
    color: C.error, fontSize: 13,
    background: "rgba(224,92,92,0.08)",
    padding: "10px 14px", borderRadius: 8,
    border: "1px solid rgba(224,92,92,0.2)",
  },
};
