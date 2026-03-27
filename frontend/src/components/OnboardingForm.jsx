import { useState } from "react";

// ─── Quiz answer data ─────────────────────────────────────────────────────────
const Q1_OPTIONS = [
  { value: "invest_all",           label: "Invest all of it immediately",  emoji: "📈" },
  { value: "invest_half_travel",   label: "Half in SIPs, half on a trip",  emoji: "✈️" },
  { value: "pay_off_debt",         label: "Pay off my loans first",        emoji: "💳" },
  { value: "buy_something_wanted", label: "Buy something I've wanted",     emoji: "🛍️" },
  { value: "save_for_family_goal", label: "Save for a family goal",        emoji: "👨‍👩‍👧" },
];
const Q2_OPTIONS = [
  { value: "not_having_enough_to_retire", label: "Not having enough to retire",    emoji: "😰" },
  { value: "missing_out_on_experiences",  label: "Missing out on life experiences", emoji: "🌍" },
  { value: "stuck_in_debt_forever",       label: "Being stuck in debt forever",     emoji: "⛓️" },
  { value: "being_a_burden_on_family",    label: "Being a burden on my family",     emoji: "💔" },
  { value: "losing_money_in_market",      label: "Losing money in the market",      emoji: "📉" },
];
const Q3_OPTIONS = [
  { value: "before_45",                label: "Before 45 — FIRE is the goal!", emoji: "🔥" },
  { value: "at_60",                    label: "Around 60 — traditional age",   emoji: "📅" },
  { value: "never_want_to_retire",     label: "Never — I love what I do",      emoji: "❤️" },
  { value: "flexible_whenever_i_can", label: "Whenever I can afford to",       emoji: "🎯" },
];
const GOAL_OPTIONS = [
  { value: "retirement",      label: "Retirement",        emoji: "🏖️" },
  { value: "buy_home",        label: "Buy a Home",        emoji: "🏠" },
  { value: "child_education", label: "Child's Education", emoji: "🎓" },
  { value: "child_marriage",  label: "Child's Wedding",   emoji: "💍" },
  { value: "travel",          label: "Travel",            emoji: "🌏" },
  { value: "emergency_fund",  label: "Emergency Fund",    emoji: "🛡️" },
  { value: "car_purchase",    label: "Car Purchase",      emoji: "🚗" },
  { value: "wealth_building", label: "Wealth Building",   emoji: "💎" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const numVal = (v) => (v === "" || v === null || v === undefined || isNaN(v) ? 0 : Number(v));
const floatDefault = (v) => (v === "" || v === undefined || isNaN(v) ? 0 : parseFloat(v));

// ─── Reusable input components ────────────────────────────────────────────────
function Label({ children }) {
  return (
    <label style={{ color: "#8AA3C2", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "6px", display: "block" }}>
      {children}
    </label>
  );
}
function TextInput({ label, value, onChange, placeholder, type = "text", min, max, required }) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type={type} value={value} onChange={onChange}
        placeholder={placeholder} min={min} max={max} required={required}
        style={{
          width: "100%", padding: "10px 14px",
          background: "rgba(26,43,69,0.6)", border: "1px solid #1A2B45",
          borderRadius: "8px", color: "#DDE6F5", fontSize: "0.95rem",
          outline: "none", transition: "border-color 0.2s",
          fontFamily: type === "number" ? "'JetBrains Mono', monospace" : "inherit",
        }}
        onFocus={e => (e.target.style.borderColor = "#00D68F")}
        onBlur={e => (e.target.style.borderColor = "#1A2B45")}
      />
    </div>
  );
}
function SelectInput({ label, value, onChange, options }) {
  return (
    <div>
      <Label>{label}</Label>
      <select
        value={value} onChange={onChange}
        style={{
          width: "100%", padding: "10px 14px",
          background: "#0C1526", border: "1px solid #1A2B45",
          borderRadius: "8px", color: "#DDE6F5", fontSize: "0.95rem",
          outline: "none", cursor: "pointer",
        }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
function MoneyInput({ label, value, onChange, placeholder }) {
  return (
    <div>
      <Label>{label}</Label>
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: "13px", top: "50%", transform: "translateY(-50%)", color: "#00D68F", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: "0.9rem" }}>₹</span>
        <input
          type="number" value={value} onChange={onChange} placeholder={placeholder} min="0"
          style={{
            width: "100%", padding: "10px 14px 10px 28px",
            background: "rgba(26,43,69,0.6)", border: "1px solid #1A2B45",
            borderRadius: "8px", color: "#DDE6F5", fontSize: "0.95rem",
            outline: "none", fontFamily: "'JetBrains Mono', monospace",
          }}
          onFocus={e => (e.target.style.borderColor = "#00D68F")}
          onBlur={e => (e.target.style.borderColor = "#1A2B45")}
        />
      </div>
    </div>
  );
}
function RadioCard({ option, selected, onSelect }) {
  return (
    <button
      type="button" onClick={() => onSelect(option.value)}
      style={{
        width: "100%", textAlign: "left", padding: "11px 14px",
        background: selected ? "rgba(0,214,143,0.08)" : "rgba(26,43,69,0.4)",
        border: `1px solid ${selected ? "#00D68F" : "#1A2B45"}`,
        borderRadius: "10px", cursor: "pointer", color: "#DDE6F5",
        display: "flex", alignItems: "center", gap: "10px",
        transition: "all 0.18s", fontSize: "0.9rem",
      }}
    >
      <span style={{ fontSize: "1.1rem" }}>{option.emoji}</span>
      <span style={{ color: selected ? "#DDE6F5" : "#8AA3C2" }}>{option.label}</span>
      {selected && (
        <span style={{ marginLeft: "auto", color: "#00D68F", fontSize: "0.85rem", fontWeight: 700 }}>✓</span>
      )}
    </button>
  );
}

// ─── Step panels ──────────────────────────────────────────────────────────────
const STEP_META = [
  {
    step: 1, title: "Your Story",
    subtitle: "Tell us a bit about yourself",
    tagline: "Personalised advice starts with knowing who you are.",
    icon: "👤",
    color: "#4D9EFF",
  },
  {
    step: 2, title: "Your Money",
    subtitle: "Paint your financial picture",
    tagline: "Every rupee tracked is a rupee working for you.",
    icon: "💰",
    color: "#00D68F",
  },
  {
    step: 3, title: "Your Shield",
    subtitle: "How protected are you?",
    tagline: "Insurance and tax savings are the foundation of every solid plan.",
    icon: "🛡️",
    color: "#F5A623",
  },
  {
    step: 4, title: "Your Mindset",
    subtitle: "Help us understand what drives you",
    tagline: "Your psychology shapes your portfolio — this is FinMate's secret sauce.",
    icon: "🧠",
    color: "#FF6B9D",
  },
];

// ─── Main component ───────────────────────────────────────────────────────────
export default function OnboardingForm({ onComplete }) {
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({
    name: "", age: "", city: "Mumbai", city_tier: "metro",
    dependants: 0, tax_regime: "new",
    monthly_income: "", monthly_expenses: "",
    existing_investments: "", outstanding_debt: "",
    liquid_savings: "", term_insurance_cover: "",
    health_insurance_cover: "", existing_80c_investments: "",
    existing_nps_contribution: "", health_premium_paid: "",
    goals: ["retirement"],
  });
  const [quiz, setQuiz] = useState({ q1: "", q2: "", q3: "", exp: 20 });

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const setQ = (field) => (val) => setQuiz((q) => ({ ...q, [field]: val }));

  function toggleGoal(val) {
    setForm((f) => ({
      ...f,
      goals: f.goals.includes(val)
        ? f.goals.filter((g) => g !== val)
        : [...f.goals, val],
    }));
  }

  function validateStep() {
    const errs = {};
    if (step === 1) {
      if (!form.name.trim()) errs.name = "Name is required";
      if (!form.age || form.age < 18 || form.age > 70) errs.age = "Age must be 18–70";
    }
    if (step === 2) {
      if (!form.monthly_income || parseFloat(form.monthly_income) <= 0)
        errs.monthly_income = "Income required";
      if (!form.monthly_expenses || parseFloat(form.monthly_expenses) <= 0)
        errs.monthly_expenses = "Expenses required";
    }
    if (step === 4) {
      if (!quiz.q1) errs.q1 = "Please answer this";
      if (!quiz.q2) errs.q2 = "Please answer this";
      if (!quiz.q3) errs.q3 = "Please answer this";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleNext() {
    if (validateStep()) setStep((s) => s + 1);
  }
  function handleBack() {
    setStep((s) => s - 1);
    setErrors({});
  }

  function handleSubmit() {
    if (!validateStep()) return;
    const profile = {
      name: form.name.trim() || "Friend",
      age: parseInt(form.age),
      city: form.city.trim() || "India",
      city_tier: form.city_tier,
      dependants: parseInt(form.dependants),
      tax_regime: form.tax_regime,
      monthly_income: parseFloat(form.monthly_income),
      monthly_expenses: parseFloat(form.monthly_expenses),
      existing_investments: numVal(form.existing_investments),
      outstanding_debt: floatDefault(form.outstanding_debt),
      liquid_savings: floatDefault(form.liquid_savings),
      term_insurance_cover: floatDefault(form.term_insurance_cover),
      health_insurance_cover: floatDefault(form.health_insurance_cover),
      existing_80c_investments: floatDefault(form.existing_80c_investments),
      existing_nps_contribution: floatDefault(form.existing_nps_contribution),
      health_premium_paid: floatDefault(form.health_premium_paid),
      goals: form.goals.length > 0 ? form.goals : ["retirement"],
    };
    onComplete(profile, [quiz.q1, quiz.q2, quiz.q3], parseInt(quiz.exp));
  }

  const meta = STEP_META[step - 1];

  return (
    <div className="grid-bg" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      {/* Container */}
      <div style={{ width: "100%", maxWidth: "900px", display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 0, borderRadius: "20px", overflow: "hidden", border: "1px solid #1A2B45", boxShadow: "0 32px 80px rgba(0,0,0,0.6)" }}>

        {/* ── Left panel ── */}
        <div style={{ background: "linear-gradient(160deg, #0C1B32 0%, #060B18 100%)", padding: "48px 36px", display: "flex", flexDirection: "column", justifyContent: "space-between", borderRight: "1px solid #1A2B45", position: "relative", overflow: "hidden" }}>
          {/* Decorative orb */}
          <div style={{ position: "absolute", top: "-60px", right: "-60px", width: "200px", height: "200px", background: `radial-gradient(circle, ${meta.color}22 0%, transparent 70%)`, borderRadius: "50%", pointerEvents: "none" }} />

          {/* Logo */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "40px" }}>
              <div style={{ width: "36px", height: "36px", background: "linear-gradient(135deg, #00D68F, #4D9EFF)", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>₹</div>
              <span className="font-display" style={{ fontSize: "1.5rem", color: "#DDE6F5", letterSpacing: "-0.02em" }}>FinMate</span>
            </div>

            {/* Step icon */}
            <div style={{ fontSize: "3rem", marginBottom: "20px" }}>{meta.icon}</div>
            <h2 className="font-display" style={{ fontSize: "2rem", color: "#DDE6F5", lineHeight: 1.2, marginBottom: "12px" }}>{meta.title}</h2>
            <p style={{ color: meta.color, fontWeight: 600, marginBottom: "10px" }}>{meta.subtitle}</p>
            <p style={{ color: "#5A7096", fontSize: "0.9rem", lineHeight: 1.6 }}>{meta.tagline}</p>
          </div>

          {/* Progress dots */}
          <div>
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
              {STEP_META.map((s) => (
                <div key={s.step} style={{ height: "4px", flex: 1, borderRadius: "2px", background: step >= s.step ? meta.color : "#1A2B45", transition: "background 0.3s" }} />
              ))}
            </div>
            <p style={{ color: "#3A506B", fontSize: "0.8rem" }}>Step {step} of 4</p>
          </div>
        </div>

        {/* ── Right panel ── */}
        <div style={{ background: "#0A1220", padding: "48px 40px", overflowY: "auto", maxHeight: "90vh" }}>

          {/* Step 1 — About You */}
          {step === 1 && (
            <div className="anim-fade-up">
              <h3 style={{ color: "#DDE6F5", fontSize: "1.4rem", fontWeight: 700, marginBottom: "28px" }}>Let's start with you</h3>
              <div style={{ display: "grid", gap: "18px" }}>
                <TextInput label="Your first name" value={form.name} onChange={set("name")} placeholder="e.g. Arjun" required />
                {errors.name && <p style={{ color: "#FF5C5C", fontSize: "0.8rem", marginTop: "-12px" }}>{errors.name}</p>}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <TextInput label="Age" value={form.age} onChange={set("age")} placeholder="25" type="number" min="18" max="70" required />
                  <SelectInput label="Dependants" value={form.dependants} onChange={set("dependants")} options={[{value:0,label:"None"},{value:1,label:"1 person"},{value:2,label:"2 people"},{value:3,label:"3+ people"}]} />
                </div>
                {errors.age && <p style={{ color: "#FF5C5C", fontSize: "0.8rem", marginTop: "-12px" }}>{errors.age}</p>}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <TextInput label="City" value={form.city} onChange={set("city")} placeholder="Mumbai" />
                  <SelectInput label="City Type" value={form.city_tier} onChange={set("city_tier")} options={[{value:"metro",label:"Metro city"},{value:"tier2",label:"Tier-2 city"},{value:"tier3",label:"Tier-3 / town"}]} />
                </div>

                <div>
                  <Label>Tax Regime</Label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    {[{v:"new",label:"New Regime (default)",sub:"Higher standard deduction"},{v:"old",label:"Old Regime",sub:"More deductions (80C etc.)"}].map(r => (
                      <button key={r.v} type="button" onClick={() => setForm(f => ({...f, tax_regime: r.v}))}
                        style={{ padding:"12px", background: form.tax_regime === r.v ? "rgba(0,214,143,0.08)" : "rgba(26,43,69,0.4)", border:`1px solid ${form.tax_regime === r.v ? "#00D68F" : "#1A2B45"}`, borderRadius:"10px", cursor:"pointer", textAlign:"left", transition:"all 0.18s" }}>
                        <p style={{ color: form.tax_regime === r.v ? "#00D68F" : "#DDE6F5", fontWeight: 600, fontSize:"0.85rem" }}>{r.label}</p>
                        <p style={{ color:"#5A7096", fontSize:"0.75rem" }}>{r.sub}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2 — Money */}
          {step === 2 && (
            <div className="anim-fade-up">
              <h3 style={{ color: "#DDE6F5", fontSize: "1.4rem", fontWeight: 700, marginBottom: "6px" }}>Your financial picture</h3>
              <p style={{ color: "#5A7096", fontSize: "0.88rem", marginBottom: "28px" }}>All values are monthly in ₹ unless specified.</p>
              <div style={{ display: "grid", gap: "18px" }}>
                <MoneyInput label="Monthly take-home income *" value={form.monthly_income} onChange={set("monthly_income")} placeholder="75000" />
                {errors.monthly_income && <p style={{ color: "#FF5C5C", fontSize: "0.8rem", marginTop: "-12px" }}>{errors.monthly_income}</p>}

                <MoneyInput label="Monthly total expenses *" value={form.monthly_expenses} onChange={set("monthly_expenses")} placeholder="50000" />
                {errors.monthly_expenses && <p style={{ color: "#FF5C5C", fontSize: "0.8rem", marginTop: "-12px" }}>{errors.monthly_expenses}</p>}

                <div style={{ borderTop: "1px solid #1A2B45", paddingTop: "18px" }}>
                  <p style={{ color: "#5A7096", fontSize: "0.8rem", marginBottom: "14px" }}>Optional — add what you know, skip what you don't</p>
                  <div style={{ display: "grid", gap: "14px" }}>
                    <MoneyInput label="Existing investments (total)" value={form.existing_investments} onChange={set("existing_investments")} placeholder="300000" />
                    <MoneyInput label="Outstanding loans / debt" value={form.outstanding_debt} onChange={set("outstanding_debt")} placeholder="500000" />
                    <MoneyInput label="Liquid savings (FD + savings A/c)" value={form.liquid_savings} onChange={set("liquid_savings")} placeholder="80000" />
                  </div>
                </div>

                {/* Savings rate preview */}
                {form.monthly_income && form.monthly_expenses && (
                  <div style={{ background: "rgba(0,214,143,0.07)", border: "1px solid rgba(0,214,143,0.2)", borderRadius: "10px", padding: "12px 16px" }}>
                    <p style={{ color: "#5A7096", fontSize: "0.78rem", marginBottom: "4px" }}>Your savings rate</p>
                    <p className="font-mono" style={{ color: "#00D68F", fontSize: "1.4rem", fontWeight: 600 }}>
                      {Math.max(0, (((parseFloat(form.monthly_income)||0) - (parseFloat(form.monthly_expenses)||0)) / (parseFloat(form.monthly_income)||1) * 100)).toFixed(1)}%
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3 — Shield */}
          {step === 3 && (
            <div className="anim-fade-up">
              <h3 style={{ color: "#DDE6F5", fontSize: "1.4rem", fontWeight: 700, marginBottom: "6px" }}>Your safety net</h3>
              <p style={{ color: "#5A7096", fontSize: "0.88rem", marginBottom: "28px" }}>All optional — enter 0 if not applicable.</p>
              <div style={{ display: "grid", gap: "14px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <MoneyInput label="Term insurance cover" value={form.term_insurance_cover} onChange={set("term_insurance_cover")} placeholder="5000000" />
                  <MoneyInput label="Health insurance cover" value={form.health_insurance_cover} onChange={set("health_insurance_cover")} placeholder="1000000" />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <MoneyInput label="Existing 80C investments (annual)" value={form.existing_80c_investments} onChange={set("existing_80c_investments")} placeholder="72000" />
                  <MoneyInput label="NPS contributions (annual)" value={form.existing_nps_contribution} onChange={set("existing_nps_contribution")} placeholder="50000" />
                </div>
                <MoneyInput label="Health insurance premium (annual)" value={form.health_premium_paid} onChange={set("health_premium_paid")} placeholder="15000" />

                {/* Goals */}
                <div style={{ borderTop: "1px solid #1A2B45", paddingTop: "18px" }}>
                  <Label>Your financial goals (select all that apply)</Label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "8px" }}>
                    {GOAL_OPTIONS.map((g) => (
                      <button key={g.value} type="button" onClick={() => toggleGoal(g.value)}
                        style={{ padding: "10px 12px", background: form.goals.includes(g.value) ? "rgba(77,158,255,0.1)" : "rgba(26,43,69,0.4)", border:`1px solid ${form.goals.includes(g.value) ? "#4D9EFF" : "#1A2B45"}`, borderRadius:"8px", cursor:"pointer", display:"flex", alignItems:"center", gap:"8px", color: form.goals.includes(g.value) ? "#DDE6F5" : "#8AA3C2", fontSize:"0.85rem", transition:"all 0.15s" }}>
                        <span>{g.emoji}</span><span>{g.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4 — Mindset Quiz */}
          {step === 4 && (
            <div className="anim-fade-up">
              <h3 style={{ color: "#DDE6F5", fontSize: "1.4rem", fontWeight: 700, marginBottom: "6px" }}>Your money mindset</h3>
              <p style={{ color: "#5A7096", fontSize: "0.88rem", marginBottom: "24px" }}>3 quick questions — there are no wrong answers.</p>
              <div style={{ display: "grid", gap: "24px" }}>

                {/* Q1 */}
                <div>
                  <p style={{ color: "#DDE6F5", fontWeight: 600, marginBottom: "12px" }}>
                    <span style={{ color: "#00D68F", marginRight: "8px" }}>01.</span>
                    You get ₹50,000 extra this month. What do you do?
                  </p>
                  <div style={{ display: "grid", gap: "8px" }}>
                    {Q1_OPTIONS.map(o => <RadioCard key={o.value} option={o} selected={quiz.q1 === o.value} onSelect={setQ("q1")} />)}
                  </div>
                  {errors.q1 && <p style={{ color: "#FF5C5C", fontSize: "0.8rem", marginTop: "6px" }}>{errors.q1}</p>}
                </div>

                {/* Q2 */}
                <div>
                  <p style={{ color: "#DDE6F5", fontWeight: 600, marginBottom: "12px" }}>
                    <span style={{ color: "#00D68F", marginRight: "8px" }}>02.</span>
                    What's your single biggest financial fear?
                  </p>
                  <div style={{ display: "grid", gap: "8px" }}>
                    {Q2_OPTIONS.map(o => <RadioCard key={o.value} option={o} selected={quiz.q2 === o.value} onSelect={setQ("q2")} />)}
                  </div>
                  {errors.q2 && <p style={{ color: "#FF5C5C", fontSize: "0.8rem", marginTop: "6px" }}>{errors.q2}</p>}
                </div>

                {/* Q3 */}
                <div>
                  <p style={{ color: "#DDE6F5", fontWeight: 600, marginBottom: "12px" }}>
                    <span style={{ color: "#00D68F", marginRight: "8px" }}>03.</span>
                    When do you want to retire?
                  </p>
                  <div style={{ display: "grid", gap: "8px" }}>
                    {Q3_OPTIONS.map(o => <RadioCard key={o.value} option={o} selected={quiz.q3 === o.value} onSelect={setQ("q3")} />)}
                  </div>
                  {errors.q3 && <p style={{ color: "#FF5C5C", fontSize: "0.8rem", marginTop: "6px" }}>{errors.q3}</p>}
                </div>

                {/* Experience slider */}
                <div>
                  <p style={{ color: "#DDE6F5", fontWeight: 600, marginBottom: "12px" }}>
                    <span style={{ color: "#00D68F", marginRight: "8px" }}>04.</span>
                    What % of your spending goes to experiences?
                    <span style={{ color: "#5A7096", fontSize: "0.8rem", display: "block", fontWeight: 400, marginTop: "2px" }}>(travel, dining out, events, entertainment)</span>
                  </p>
                  <div style={{ background: "rgba(26,43,69,0.4)", borderRadius: "12px", padding: "16px 20px", border: "1px solid #1A2B45" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
                      <span style={{ color: "#5A7096", fontSize: "0.8rem" }}>Minimalist saver</span>
                      <span className="font-mono" style={{ color: "#F5A623", fontSize: "1.2rem", fontWeight: 700 }}>{quiz.exp}%</span>
                      <span style={{ color: "#5A7096", fontSize: "0.8rem" }}>Full experience mode</span>
                    </div>
                    <input type="range" min="0" max="100" value={quiz.exp}
                      onChange={e => setQuiz(q => ({...q, exp: parseInt(e.target.value)}))}
                      style={{ width: "100%", accentColor: "#00D68F", cursor: "pointer" }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Navigation buttons ── */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "32px", paddingTop: "24px", borderTop: "1px solid #1A2B45" }}>
            {step > 1 ? (
              <button type="button" onClick={handleBack}
                style={{ padding: "10px 24px", background: "transparent", border: "1px solid #1A2B45", borderRadius: "10px", color: "#8AA3C2", cursor: "pointer", fontSize: "0.9rem", transition: "all 0.2s" }}
                onMouseEnter={e => { e.target.style.borderColor = "#24375A"; e.target.style.color = "#DDE6F5"; }}
                onMouseLeave={e => { e.target.style.borderColor = "#1A2B45"; e.target.style.color = "#8AA3C2"; }}>
                ← Back
              </button>
            ) : <div />}

            {step < 4 ? (
              <button type="button" onClick={handleNext}
                style={{ padding: "10px 28px", background: "linear-gradient(135deg, #00D68F, #00B87A)", border: "none", borderRadius: "10px", color: "#060B18", fontWeight: 700, cursor: "pointer", fontSize: "0.95rem", transition: "opacity 0.2s" }}
                onMouseEnter={e => (e.target.style.opacity = "0.88")}
                onMouseLeave={e => (e.target.style.opacity = "1")}>
                Continue →
              </button>
            ) : (
              <button type="button" onClick={handleSubmit}
                style={{ padding: "12px 32px", background: "linear-gradient(135deg, #00D68F, #00B87A)", border: "none", borderRadius: "10px", color: "#060B18", fontWeight: 700, cursor: "pointer", fontSize: "1rem", boxShadow: "0 0 24px rgba(0,214,143,0.3)", transition: "all 0.2s" }}
                onMouseEnter={e => (e.target.style.boxShadow = "0 0 36px rgba(0,214,143,0.5)")}
                onMouseLeave={e => (e.target.style.boxShadow = "0 0 24px rgba(0,214,143,0.3)")}>
                🚀 Build My Plan
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}