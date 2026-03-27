const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function sendChat(userProfile, quizAnswers, message, history = []) {
  const res = await fetch(`${BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user: userProfile,
      quiz_answers: quizAnswers,
      message,
      conversation_history: history,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Request failed");
  }
  return res.json(); // { reply, persona, calculations, market }
}

export async function getCalculations(userProfile) {
  const res = await fetch(`${BASE_URL}/calculate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(userProfile),
  });
  if (!res.ok) throw new Error("Calculations failed");
  return res.json();
}