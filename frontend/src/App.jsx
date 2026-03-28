// src/App.jsx
// ─────────────────────────────────────────────────────────────
// Root component — handles the 3-step routing:
//
//   1. Not logged in          → <AuthPage />
//   2. Logged in, no profile  → <OnboardingForm />
//   3. Logged in, has profile → <Chat /> (with welcome back banner)
//
// AuthProvider wraps everything so auth state is global.
// ─────────────────────────────────────────────────────────────

import { useState } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import AuthPage from "./components/AuthPage";
import Chat from "./components/Chat";
import OnboardingForm from "./components/OnboardingForm";

// Inner component so it can call useAuth() (must be inside Provider)
function AppContent() {
  const { user, profile, quizAnswers, loading, saveProfile, logout } = useAuth();

  // ── Loading state while session is being restored ──────────
  if (loading) {
    return (
      <div style={loadingStyles.root}>
        <div style={loadingStyles.spinner} />
        <p style={loadingStyles.text}>Restoring your session…</p>
      </div>
    );
  }

  // ── Step 1: Not authenticated ──────────────────────────────
  if (!user) {
    return <AuthPage />;
  }

  // ── Step 2: Authenticated but no financial profile yet ─────
  if (!user.has_profile) {
    return (
      <OnboardingForm
        userName={user.name}
        onComplete={(financialData, answers, personaData) => {
          saveProfile(financialData, answers, personaData);
        }}
      />
    );
  }

  // ── Step 3: Fully set up — go to chat ─────────────────────
  return (
    <Chat
      userProfile={profile}
      quizAnswers={quizAnswers}
      userName={user.name}
      onLogout={logout}
    />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

// ── Loading screen styles ──────────────────────────────────────
const loadingStyles = {
  root: {
    minHeight: "100vh",
    background: "#0f1117",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  spinner: {
    width: 40,
    height: 40,
    border: "3px solid #2a2d3e",
    borderTopColor: "#d4a853",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  text: {
    color: "#7a7a8c",
    fontSize: 14,
    fontFamily: "system-ui, sans-serif",
  },
};

// Inject the spin keyframe globally (needed for the spinner)
if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.textContent = "@keyframes spin { to { transform: rotate(360deg); } }";
  document.head.appendChild(style);
}
