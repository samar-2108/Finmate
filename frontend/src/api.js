// src/api.js
// ─────────────────────────────────────────────────────────────
// All API calls in one place.
// Every call now automatically attaches the JWT token from
// localStorage via the authFetch helper.
// ─────────────────────────────────────────────────────────────

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ── Authenticated fetch wrapper ───────────────────────────────
function authFetch(path, options = {}) {
  const token = localStorage.getItem("fm_token");
  return fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
}


// ── Auth ──────────────────────────────────────────────────────
export async function apiSignup(email, password, name) {
  const res = await fetch(`${BASE_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Signup failed");
  return data;   // TokenResponse { access_token, user_id, name, email, has_profile }
}

export async function apiLogin(email, password) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Login failed");
  return data;
}

export async function apiGetMe() {
  const res = await authFetch("/auth/me");
  if (!res.ok) throw new Error("Session expired");
  return res.json();
}


// ── Profile ───────────────────────────────────────────────────
export async function apiSaveProfile(financialData, quizAnswers, experienceSpendPct = 20) {
  const res = await authFetch("/profile/save", {
    method: "PUT",
    body: JSON.stringify({
      financial_data: financialData,
      quiz_answers: quizAnswers,
      experience_spend_pct: experienceSpendPct,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Profile save failed");
  return data;   // { status, persona_type }
}


// ── Chat ──────────────────────────────────────────────────────
export async function sendChat(message, overrideUser = null, overrideQuiz = null) {
  const body = { message };
  if (overrideUser)  body.user = overrideUser;
  if (overrideQuiz)  body.quiz_answers = overrideQuiz;

  const res = await authFetch("/chat", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Chat request failed");
  return data;   // { reply, persona, calculations, market }
}


// ── Calculations ──────────────────────────────────────────────
export async function getCalculations(userProfile) {
  const res = await authFetch("/calculate", {
    method: "POST",
    body: JSON.stringify(userProfile),
  });
  if (!res.ok) throw new Error("Calculations failed");
  return res.json();
}
