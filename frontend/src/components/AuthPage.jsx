// Login + Signup page.

import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function AuthPage() {
  const { login } = useAuth();
  const [mode, setMode]         = useState("login");    // "login" | "signup"
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const endpoint = mode === "login" ? "/auth/login" : "/auth/signup";
    const body = mode === "login"
      ? { email, password }
      : { email, password, name };

    try {
      const res = await fetch(`${BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Something went wrong");
      login(data);   // stores token + user in AuthContext
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.root}>
      {/* Background decorative elements */}
      <div style={styles.bgCircle1} />
      <div style={styles.bgCircle2} />

      <div style={styles.card}>
        {/* Brand */}
        <div style={styles.brand}>
          <div style={styles.brandIcon}>₹</div>
          <h1 style={styles.brandName}>FinMentor</h1>
          <p style={styles.brandTagline}>Your AI-powered wealth guide for India</p>
        </div>

        {/* Tab switcher */}
        <div style={styles.tabs}>
          <button
            style={{ ...styles.tab, ...(mode === "login" ? styles.tabActive : {}) }}
            onClick={() => { setMode("login"); setError(""); }}
          >
            Sign In
          </button>
          <button
            style={{ ...styles.tab, ...(mode === "signup" ? styles.tabActive : {}) }}
            onClick={() => { setMode("signup"); setError(""); }}
          >
            Create Account
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={styles.form}>
          {mode === "signup" && (
            <div style={styles.field}>
              <label style={styles.label}>Your Name</label>
              <input
                style={styles.input}
                type="text"
                placeholder="Arjun Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}

          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              style={styles.input}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              style={styles.input}
              type="password"
              placeholder={mode === "signup" ? "Minimum 6 characters" : "Enter password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {error && <p style={styles.error}>{error}</p>}

          <button
            type="submit"
            style={{ ...styles.submitBtn, ...(loading ? styles.submitBtnDisabled : {}) }}
            disabled={loading}
          >
            {loading
              ? "Please wait…"
              : mode === "login"
              ? "Sign In →"
              : "Create Account →"}
          </button>
        </form>

        {/* Footer switch */}
        <p style={styles.switchText}>
          {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          <button
            style={styles.switchLink}
            onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}
          >
            {mode === "login" ? "Sign up free" : "Sign in"}
          </button>
        </p>

        {/* Trust indicators */}
        <div style={styles.trustRow}>
          {["🔒 Encrypted", "🇮🇳 India-first", "✦ SEBI guidelines"].map((t) => (
            <span key={t} style={styles.trustBadge}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

//Styles 
const C = {
  bg:       "#0f1117",
  surface:  "#1a1d27",
  border:   "#2a2d3e",
  gold:     "#d4a853",
  goldDim:  "#8a6a2a",
  text:     "#e8e4d9",
  muted:    "#7a7a8c",
  error:    "#e05c5c",
  inputBg:  "#13151f",
};

const styles = {
  root: {
    minHeight: "100vh",
    background: C.bg,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Georgia', 'Times New Roman', serif",
    position: "relative",
    overflow: "hidden",
    padding: "24px",
  },
  bgCircle1: {
    position: "absolute",
    width: 600,
    height: 600,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(212,168,83,0.06) 0%, transparent 70%)",
    top: -200,
    right: -200,
    pointerEvents: "none",
  },
  bgCircle2: {
    position: "absolute",
    width: 400,
    height: 400,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(100,120,200,0.05) 0%, transparent 70%)",
    bottom: -100,
    left: -100,
    pointerEvents: "none",
  },
  card: {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 20,
    padding: "48px 40px 36px",
    width: "100%",
    maxWidth: 420,
    boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
    position: "relative",
    zIndex: 1,
  },
  brand: {
    textAlign: "center",
    marginBottom: 36,
  },
  brandIcon: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 52,
    height: 52,
    borderRadius: 14,
    background: `linear-gradient(135deg, ${C.gold}, ${C.goldDim})`,
    color: C.bg,
    fontSize: 26,
    fontWeight: 900,
    marginBottom: 14,
    boxShadow: `0 4px 20px rgba(212,168,83,0.3)`,
  },
  brandName: {
    margin: 0,
    fontSize: 28,
    fontWeight: 700,
    color: C.text,
    letterSpacing: "-0.5px",
  },
  brandTagline: {
    margin: "8px 0 0",
    fontSize: 13,
    color: C.muted,
    fontStyle: "italic",
    fontFamily: "system-ui, sans-serif",
  },
  tabs: {
    display: "flex",
    background: C.inputBg,
    borderRadius: 10,
    padding: 4,
    marginBottom: 28,
    gap: 4,
  },
  tab: {
    flex: 1,
    padding: "10px 0",
    border: "none",
    borderRadius: 8,
    background: "transparent",
    color: C.muted,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
    fontFamily: "system-ui, sans-serif",
    letterSpacing: "0.3px",
  },
  tabActive: {
    background: C.surface,
    color: C.gold,
    boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: C.muted,
    letterSpacing: "0.8px",
    textTransform: "uppercase",
    fontFamily: "system-ui, sans-serif",
  },
  input: {
    background: C.inputBg,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: "13px 16px",
    color: C.text,
    fontSize: 15,
    fontFamily: "system-ui, sans-serif",
    outline: "none",
    transition: "border-color 0.2s",
  },
  error: {
    color: C.error,
    fontSize: 13,
    margin: "4px 0 0",
    fontFamily: "system-ui, sans-serif",
    background: "rgba(224,92,92,0.08)",
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid rgba(224,92,92,0.2)",
  },
  submitBtn: {
    marginTop: 8,
    background: `linear-gradient(135deg, ${C.gold}, ${C.goldDim})`,
    color: C.bg,
    border: "none",
    borderRadius: 12,
    padding: "15px",
    fontSize: 15,
    fontWeight: 800,
    cursor: "pointer",
    fontFamily: "system-ui, sans-serif",
    letterSpacing: "0.3px",
    transition: "opacity 0.2s, transform 0.1s",
    boxShadow: `0 4px 20px rgba(212,168,83,0.25)`,
  },
  submitBtnDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
  switchText: {
    textAlign: "center",
    fontSize: 13,
    color: C.muted,
    marginTop: 24,
    fontFamily: "system-ui, sans-serif",
  },
  switchLink: {
    background: "none",
    border: "none",
    color: C.gold,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    padding: 0,
    fontFamily: "system-ui, sans-serif",
  },
  trustRow: {
    display: "flex",
    justifyContent: "center",
    gap: 12,
    marginTop: 24,
    flexWrap: "wrap",
  },
  trustBadge: {
    fontSize: 11,
    color: C.muted,
    fontFamily: "system-ui, sans-serif",
    letterSpacing: "0.3px",
  },
};
