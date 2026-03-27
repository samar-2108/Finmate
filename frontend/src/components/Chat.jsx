// src/components/Chat.jsx
import { useState } from "react";
import { sendChat } from "../api";

export default function Chat({ userProfile, quizAnswers }) {
  const [messages, setMessages] = useState([]);   // {role, content}
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [persona, setPersona] = useState(null);

  async function handleSend() {
    if (!input.trim()) return;

    const userMsg = { role: "user", content: input };
    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setInput("");
    setLoading(true);

    try {
      // Convert to Gemini format before sending
      const geminiHistory = messages.map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        content: m.content,
      }));

      const data = await sendChat(userProfile, quizAnswers, input, geminiHistory);

      setMessages([...updatedHistory, { role: "assistant", content: data.reply }]);
      setPersona(data.persona);
    } catch (err) {
      setMessages([...updatedHistory, {
        role: "assistant",
        content: "Something went wrong. Please try again.",
      }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-screen p-4">
      <div className="flex-1 overflow-y-auto space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`p-3 rounded-lg max-w-xl ${
            m.role === "user" ? "bg-blue-100 ml-auto" : "bg-gray-100"
          }`}>
            {m.content}
          </div>
        ))}
        {loading && <div className="text-gray-400">FinMentor is thinking...</div>}
      </div>

      <div className="flex gap-2 mt-4">
        <input
          className="flex-1 border rounded-lg p-2"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSend()}
          placeholder="Ask your finance question..."
        />
        <button
          onClick={handleSend}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}