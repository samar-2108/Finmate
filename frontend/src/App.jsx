import { useState } from "react";
import Chat from "./components/Chat";
import OnboardingForm from "./components/OnboardingForm";

export default function App() {
  const [step, setStep] = useState("onboarding"); // "onboarding" | "chat"
  const [userProfile, setUserProfile] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState(null);
  const [experiencePct, setExperiencePct] = useState(20);

  function handleOnboardingComplete(profile, answers, expPct) {
    setUserProfile(profile);
    setQuizAnswers(answers);
    setExperiencePct(expPct);
    setStep("chat");
  }

  if (step === "chat") {
    return (
      <Chat
        userProfile={userProfile}
        quizAnswers={quizAnswers}
        experiencePct={experiencePct}
      />
    );
  }

  return <OnboardingForm onComplete={handleOnboardingComplete} />;
}