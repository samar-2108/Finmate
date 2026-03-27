// src/App.jsx
import { useState } from "react";
import Chat from "./components/Chat";

export default function App() {
  const [step, setStep] = useState("onboarding"); // "onboarding" | "chat"
  const [userProfile, setUserProfile] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState(null);

  function handleOnboardingComplete(profile, answers) {
    setUserProfile(profile);
    setQuizAnswers(answers);
    setStep("chat");
  }

  if (step === "chat") {
    return <Chat userProfile={userProfile} quizAnswers={quizAnswers} />;
  }

  return <OnboardingForm onComplete={handleOnboardingComplete} />;
}