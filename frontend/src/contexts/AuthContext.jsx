// src/contexts/AuthContext.jsx
// ─────────────────────────────────────────────────────────────
// Global auth state. Wraps the whole app so any component can:
//   const { user, token, login, logout } = useAuth()
//
// On mount, restores session from localStorage if token exists.
// ─────────────────────────────────────────────────────────────

import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export function AuthProvider({ children }) {
  const [token, setToken]     = useState(() => localStorage.getItem("fm_token"));
  const [user, setUser]       = useState(null);
  const [profile, setProfile] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState(null);
  const [persona, setPersona] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);

  // FIX: initialize loading=true only when a token actually exists.
  // This avoids the synchronous setLoading(true) call inside the effect
  // (which the React linter flags as causing cascading renders).
  // If there is no token we are definitively not loading — start false.
  const [loading, setLoading] = useState(() => !!localStorage.getItem("fm_token"));

  // ── Restore session whenever token changes ──────────────────
  useEffect(() => {
    if (!token) {
      // No token — nothing to fetch, not loading.
      setLoading(false);
      return;
    }

    // token changed to a new value mid-session (i.e. login() was just called).
    // We need setLoading(true) here only for that case — on the initial mount
    // the lazy initializer above already set loading=true so no extra render fires.
    setLoading(true);

    fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        setUser({
          user_id:     data.user_id,
          name:        data.name,
          email:       data.email,
          has_profile: data.has_profile,
        });
        if (data.has_profile) {
          setProfile(data.profile);
          setQuizAnswers(data.quiz_answers);
          setPersona(data.persona);
          setChatHistory(data.chat_history || []);
        }
      })
      .catch(() => {
        localStorage.removeItem("fm_token");
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  // ── Called after successful login or signup ─────────────────
  // Only set the token — the effect above is the single source of
  // truth for user state, fetched fresh from /auth/me.
  function login(tokenResp) {
    const { access_token } = tokenResp;
    localStorage.setItem("fm_token", access_token);
    setToken(access_token);
  }

  // ── Called after onboarding is complete ────────────────────
  function saveProfile(financialData, answers, personaData) {
    setProfile(financialData);
    setQuizAnswers(answers);
    setPersona(personaData);
    setUser((u) => ({ ...u, has_profile: true }));
  }

  // ── Append a chat turn to local state ──────────────────────
  function appendChatTurn(userMsg, aiReply) {
    setChatHistory((prev) => [
      ...prev,
      { role: "user", content: userMsg },
      { role: "model", content: aiReply },
    ]);
  }

  function logout() {
    localStorage.removeItem("fm_token");
    setToken(null);
    setUser(null);
    setProfile(null);
    setQuizAnswers(null);
    setPersona(null);
    setChatHistory([]);
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        profile,
        quizAnswers,
        persona,
        chatHistory,
        loading,
        login,
        logout,
        saveProfile,
        appendChatTurn,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}