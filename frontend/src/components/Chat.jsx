import { useState, useEffect, useRef } from "react";
import { sendChat } from "../api";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtINR(n) {
  if (n === undefined || n === null || isNaN(n)) return "—";
  const v = Math.abs(parseFloat(n));
  if (v >= 10_000_000) return `₹${(v / 10_000_000).toFixed(2)} Cr`;
  if (v >= 100_000)    return `₹${(v / 100_000).toFixed(1)} L`;
  if (v >= 1_000)      return `₹${(v / 1000).toFixed(0)}K`;
  return `₹${v.toFixed(0)}`;
}

function pct(v) {
  if (v === undefined || v === null) return "—";
  return `${parseFloat(v).toFixed(1)}%`;
}

// Simple markdown → HTML renderer
function renderMarkdown(text) {
  if (!text) return "";
  // Split into lines and process
  const lines = text.split("\n");
  let html = "";
  let inList = false;

  for (const line of lines) {
    // Headers
    if (line.startsWith("### ")) {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<h3>${line.slice(4)}</h3>`;
    } else if (line.startsWith("## ")) {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<h2>${line.slice(3)}</h2>`;
    } else if (line.startsWith("# ")) {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<h1>${line.slice(2)}</h1>`;
    // List items
    } else if (/^[-•*] /.test(line)) {
      if (!inList) { html += "<ul>"; inList = true; }
      html += `<li>${applyInline(line.slice(2))}</li>`;
    // Horizontal rule
    } else if (/^---+$/.test(line.trim())) {
      if (inList) { html += "</ul>"; inList = false; }
      html += "<hr>";
    // Empty line = paragraph break
    } else if (line.trim() === "") {
      if (inList) { html += "</ul>"; inList = false; }
      html += "<br>";
    // Regular paragraph
    } else {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<p>${applyInline(line)}</p>`;
    }
  }

  if (inList) html += "</ul>";
  return html;
}

function applyInline(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

// ─── Persona colours ───────────────────────────────────────────────────────────
const PERSONA_COLORS = {
  "FIRE Seeker":          { bg: "#F5A62318", border: "#F5A62344", color: "#F5A623", label: "🔥" },
  "YOLO Traveller":       { bg: "#FF6B9D18", border: "#FF6B9D44", color: "#FF6B9D", label: "✈️" },
  "Family-First Planner": { bg: "#4D9EFF18", border: "#4D9EFF44", color: "#4D9EFF", label: "👨‍👩‍👧" },
  "Debt Slayer":          { bg: "#FF5C5C18", border: "#FF5C5C44", color: "#FF5C5C", label: "⚔️" },
  "Wealth Builder":       { bg: "#00D68F18", border: "#00D68F44", color: "#00D68F", label: "💎" },
  "Balanced Builder":     { bg: "#A78BFA18", border: "#A78BFA44", color: "#A78BFA", label: "⚖️" },
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function MetricCard({ label, value, valueColor, icon, sub }) {
  return (
    <div style={{ background: "#0C1526", border: "1px solid #1A2B45", borderRadius: "10px", padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
        {icon && <span style={{ fontSize: "0.85rem" }}>{icon}</span>}
        <span style={{ color: "#5A7096", fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase" }}>{label}</span>
      </div>
      <p className="font-mono" style={{ color: valueColor || "#DDE6F5", fontSize: "1rem", fontWeight: 700, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ color: "#3A506B", fontSize: "0.72rem", marginTop: "4px" }}>{sub}</p>}
    </div>
  );
}

function Typing() {
  return (
    <div style={{ display: "flex", gap: "5px", padding: "14px 18px", alignItems: "center" }}>
      {[0, 0.2, 0.4].map((d, i) => (
        <div key={i} style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#00D68F", animation: `pulse-dot 1.2s ${d}s infinite` }} />
      ))}
    </div>
  );
}

function MessageBubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: "16px", animation: "fadeUp 0.3s ease forwards" }}>
      {!isUser && (
        <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: "linear-gradient(135deg, #00D68F, #4D9EFF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem", flexShrink: 0, marginRight: "10px", marginTop: "4px" }}>₹</div>
      )}
      <div style={{ maxWidth: "76%", padding: "14px 18px", borderRadius: isUser ? "18px 18px 4px 18px" : "4px 18px 18px 18px", background: isUser ? "linear-gradient(135deg, #0E2A4A, #0A1E38)" : "#0C1526", border: `1px solid ${isUser ? "#24375A" : "#1A2B45"}`, color: "#DDE6F5", fontSize: "0.9rem", lineHeight: 1.65 }}>
        {isUser ? (
          <p style={{ margin: 0 }}>{msg.content}</p>
        ) : (
          <div className="chat-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
        )}
        <p style={{ color: "#3A506B", fontSize: "0.68rem", marginTop: "8px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>{msg.time}</p>
      </div>
    </div>
  );
}

// ─── Initial Loading Placeholder ──────────────────────────────────────────────
function GreetingLoader() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "20px", padding: "40px" }}>
      <div style={{ width: "56px", height: "56px", background: "linear-gradient(135deg, #00D68F, #4D9EFF)", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem", boxShadow: "0 0 32px rgba(0,214,143,0.3)" }}>₹</div>
      <div style={{ textAlign: "center" }}>
        <p style={{ color: "#DDE6F5", fontSize: "1rem", fontWeight: 600, marginBottom: "8px" }}>Analysing your financial profile…</p>
        <p style={{ color: "#5A7096", fontSize: "0.85rem" }}>Crunching your numbers and preparing a personalised snapshot</p>
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        {[0, 0.2, 0.4].map((d, i) => (
          <div key={i} style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#00D68F", animation: `pulse-dot 1.2s ${d}s infinite` }} />
        ))}
      </div>
    </div>
  );
}

// ─── Main Chat Component ───────────────────────────────────────────────────────
export default function Chat({ userProfile, quizAnswers, experiencePct = 20 }) {
  // UI messages (what the user sees in the chat)
  const [messages, setMessages]     = useState([]);
  // ✅ FIX: Separate API history that correctly tracks both sides of every exchange.
  //         This prevents the "history starts with model" Gemini error.
  const [apiHistory, setApiHistory] = useState([]);
  const [input, setInput]           = useState("");
  const [isLoading, setIsLoading]   = useState(false);
  const [persona, setPersona]       = useState(null);
  const [calculations, setCalcs]    = useState(null);
  const [market, setMarket]         = useState(null);
  const [sidebarOpen, setSidebar]   = useState(true);
  // ✅ FIX: Track if the error is network-level vs quota/content
  const [lastError, setLastError]   = useState(null);

  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);

  // ── Initial greeting ──
  useEffect(() => {
    async function greet() {
      setIsLoading(true);
      setLastError(null);

      // This is the internal prompt we send to seed the conversation.
      // It is stored in apiHistory but NOT shown in the UI messages list.
      const greetingPrompt = `Hello! I'm ready. Please introduce yourself as FinMate, give ${userProfile?.name || "the user"} a quick personalised financial snapshot based on their profile, and ask what they'd like to work on today. Be warm, specific, and use the ₹ numbers you have.`;

      try {
        // First call: no history yet, just the greeting prompt
        const res = await sendChat(greetingPrompt, userProfile, quizAnswers, [], experiencePct);
        const now = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

        // Show only the model's reply in the UI
        setMessages([{ role: "model", content: res.reply, time: now }]);

        // ✅ CRITICAL FIX: Store BOTH the user prompt AND the model reply in
        //    apiHistory so future calls always start with a "user" turn.
        setApiHistory([
          { role: "user",  content: greetingPrompt },
          { role: "model", content: res.reply },
        ]);

        if (res.persona)       setPersona(res.persona);
        if (res.calculations)  setCalcs(res.calculations);
        if (res.market)        setMarket(res.market);
      } catch (err) {
        const now = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
        const isQuota = err.message?.includes("429");
        const errorMsg = isQuota
          ? `Hi ${userProfile?.name || "there"}! FinMate is a bit busy right now. Please wait a moment and refresh. 🙏`
          : `Hi ${userProfile?.name || "there"}! I'm having trouble connecting. Please make sure the backend is running at http://localhost:8000 and try again. 🙏`;
        setMessages([{ role: "model", content: errorMsg, time: now }]);
        setLastError(err.message);
      } finally {
        setIsLoading(false);
      }
    }
    greet();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-scroll ──
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // ── Send message ──
  async function handleSend() {
    const text = input.trim();
    if (!text || isLoading) return;

    const now = () => new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    const userMsg = { role: "user", content: text, time: now() };

    // Add user message to UI immediately
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    setLastError(null);

    try {
      // ✅ FIX: Pass apiHistory (which correctly starts with "user") — not the
      //         UI messages array which starts with a "model" greeting message.
      const res = await sendChat(text, userProfile, quizAnswers, apiHistory, experiencePct);

      const botMsg = { role: "model", content: res.reply, time: now() };
      setMessages((prev) => [...prev, botMsg]);

      // ✅ FIX: Append both sides to apiHistory after each exchange.
      setApiHistory((prev) => [
        ...prev,
        { role: "user",  content: text },
        { role: "model", content: res.reply },
      ]);

      if (res.persona)      setPersona(res.persona);
      if (res.calculations) setCalcs(res.calculations);
      if (res.market)       setMarket(res.market);
    } catch (err) {
      const isQuota = err.message?.includes("429");
      const errContent = isQuota
        ? "FinMate is a bit busy — please wait a moment and try again."
        : "Sorry, I ran into an issue connecting to the server. Please try again!";

      setMessages((prev) => [...prev, { role: "model", content: errContent, time: now() }]);
      setLastError(err.message);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }
  async function downloadPDF() {
  const elements = document.querySelectorAll(".chat-content");
  const element = elements[elements.length - 1];

  if (!element) return;

  // 🟢 Save original styles
  const originalBg = element.style.background;
  const originalColor = element.style.color;

  // 🟢 Force white theme for PDF
  element.style.background = "#ffffff";
  element.style.color = "#000000";

  const canvas = await html2canvas(element, { scale: 2 });
  const imgData = canvas.toDataURL("image/png");

  const doc = new jsPDF();

  const imgWidth = 190;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  doc.addImage(imgData, "PNG", 10, 10, imgWidth, imgHeight);
  doc.save("finmate.pdf");

  // 🔴 Restore original styles (IMPORTANT)
  element.style.background = originalBg;
  element.style.color = originalColor;
}
  function handleLogout() {
  localStorage.removeItem("fm_token");
  window.location.href = "/login";
}
  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  const pc = persona ? (PERSONA_COLORS[persona.type] || PERSONA_COLORS["Balanced Builder"]) : null;
  const savings = calculations?.savings_rate;
  const fire    = calculations?.fire_date;
  const emergency = calculations?.emergency_fund;
  const insurance = calculations?.insurance_gap;
  const alloc   = calculations?.asset_allocation;

  // ─── Suggested questions ───
  const suggestions = [
    "Show me my emergency fund gap",
    "How much SIP do I need for retirement?",
    "Am I underinsured?",
    "How can I save more tax this year?",
    "Break down my FIRE plan",
  ];

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#060B18", overflow: "hidden" }}>

      {/* ── Top Nav ── */}
      <div style={{ height: "56px", flexShrink: 0, background: "#0A1220", borderBottom: "1px solid #1A2B45", display: "flex", alignItems: "center", padding: "0 20px", gap: "16px" }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginRight: "8px" }}>
          <div style={{ width: "28px", height: "28px", background: "linear-gradient(135deg, #00D68F, #4D9EFF)", borderRadius: "7px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem", fontWeight: 700, color: "#060B18" }}>₹</div>
          <span className="font-display" style={{ fontSize: "1.15rem", color: "#DDE6F5" }}>FinMate</span>
        </div>

        {/* Live market ticker */}
        {market && (
          <div style={{ display: "flex", gap: "20px", flex: 1 }}>
            {[
              { label: "NIFTY", value: market.nifty_price?.toLocaleString("en-IN"), sub: market.nifty_change_pct >= 0 ? `+${market.nifty_change_pct?.toFixed(2)}%` : `${market.nifty_change_pct?.toFixed(2)}%`, up: market.nifty_change_pct >= 0 },
              { label: "P/E", value: market.nifty_pe?.toFixed(1), sub: market.market_signal?.replace(/_/g, " "), up: market.nifty_pe < 22 },
              { label: "REPO", value: `${market.repo_rate}%`, sub: "RBI", up: true },
              { label: "₹/$", value: market.usd_inr?.toFixed(1), sub: "USD/INR", up: false },
              { label: "FD", value: `${market.fd_best_rate}%`, sub: "Best rate", up: true },
            ].map((t) => (
              <div key={t.label} style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ color: "#3A506B", fontSize: "0.62rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>{t.label}</span>
                <span className="font-mono" style={{ color: t.up ? "#00D68F" : "#FF5C5C", fontSize: "0.8rem", fontWeight: 600, lineHeight: 1 }}>{t.value}</span>
                <span style={{ color: "#3A506B", fontSize: "0.62rem" }}>{t.sub}</span>
              </div>
            ))}
          </div>
        )}

        {/* User + sidebar toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginLeft: "auto" }}>
          {userProfile?.name && (
            <span style={{ color: "#5A7096", fontSize: "0.82rem" }}>👤 {userProfile.name}</span>
          )}
          <button
  onClick={downloadPDF}
  style={{
    background: "#4D9EFF",
    border: "none",
    borderRadius: "7px",
    padding: "5px 10px",
    color: "white",
    fontSize: "0.78rem",
    cursor: "pointer"
  }}
>
  PDF
</button>
                  {/* ✅ ADD THIS LOGOUT BUTTON */}
          <button
            onClick={handleLogout}
            style={{
              background: "#FF5C5C",
              border: "none",
              borderRadius: "7px",
              padding: "5px 10px",
              color: "white",
              fontSize: "0.78rem",
              cursor: "pointer"
            }}
          >
            Logout
          </button>
          <button onClick={() => setSidebar(s => !s)}
            style={{ background: sidebarOpen ? "rgba(0,214,143,0.1)" : "rgba(26,43,69,0.5)", border: `1px solid ${sidebarOpen ? "rgba(0,214,143,0.3)" : "#1A2B45"}`, borderRadius: "7px", padding: "5px 10px", color: sidebarOpen ? "#00D68F" : "#5A7096", fontSize: "0.78rem", cursor: "pointer" }}>
            {sidebarOpen ? "◀ Dashboard" : "▶ Dashboard"}
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ── Chat Main ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>

            {/* ✅ FIX: Show a proper loading screen while the initial greeting is loading
                instead of a blank screen. */}
            {messages.length === 0 && isLoading && <GreetingLoader />}

            {/* Persona badge — only show once messages have loaded */}
            {messages.length > 0 && persona && pc && (
              <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
                <div style={{ background: pc.bg, border: `1px solid ${pc.border}`, borderRadius: "20px", padding: "6px 16px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>{pc.label}</span>
                  <span style={{ color: pc.color, fontWeight: 600, fontSize: "0.82rem" }}>{persona.type}</span>
                  <span style={{ color: "#3A506B", fontSize: "0.75rem" }}>· Risk {persona.risk_score}/10 · {persona.risk_profile}</span>
                </div>
              </div>
            )}

            {messages.map((m, i) => <MessageBubble key={i} msg={m} />)}

            {/* Typing indicator — only show when there are already messages */}
            {isLoading && messages.length > 0 && (
              <div style={{ display: "flex", marginBottom: "16px" }}>
                <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: "linear-gradient(135deg, #00D68F, #4D9EFF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem", flexShrink: 0, marginRight: "10px" }}>₹</div>
                <div style={{ background: "#0C1526", border: "1px solid #1A2B45", borderRadius: "4px 18px 18px 18px" }}><Typing /></div>
              </div>
            )}

            {/* Suggestions (show only after first greeting and before any user message) */}
            {messages.length === 1 && !isLoading && (
              <div style={{ marginTop: "16px" }}>
                <p style={{ color: "#3A506B", fontSize: "0.75rem", textAlign: "center", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Or try asking</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center" }}>
                  {suggestions.map((s) => (
                    <button key={s} onClick={() => setInput(s)}
                      style={{ padding: "7px 14px", background: "rgba(26,43,69,0.6)", border: "1px solid #1A2B45", borderRadius: "20px", color: "#8AA3C2", fontSize: "0.82rem", cursor: "pointer", transition: "all 0.2s" }}
                      onMouseEnter={e => { e.target.style.borderColor = "#00D68F55"; e.target.style.color = "#DDE6F5"; }}
                      onMouseLeave={e => { e.target.style.borderColor = "#1A2B45"; e.target.style.color = "#8AA3C2"; }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Network error banner */}
            {lastError && !isLoading && (
              <div style={{ margin: "8px 0", padding: "8px 14px", background: "rgba(255,92,92,0.08)", border: "1px solid rgba(255,92,92,0.25)", borderRadius: "8px", color: "#FF5C5C", fontSize: "0.78rem", textAlign: "center" }}>
                ⚠️ Connection issue — check that the backend is running on port 8000
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input area */}
          <div style={{ padding: "16px 24px", borderTop: "1px solid #1A2B45", background: "#0A1220" }}>
            <div style={{ display: "flex", gap: "10px", alignItems: "flex-end", background: "#0C1526", border: "1px solid #1A2B45", borderRadius: "14px", padding: "10px 14px", transition: "border-color 0.2s" }}
              onFocusCapture={e => e.currentTarget.style.borderColor = "rgba(0,214,143,0.4)"}
              onBlurCapture={e => e.currentTarget.style.borderColor = "#1A2B45"}>
              <textarea
                ref={inputRef}
                value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
                placeholder={`Ask FinMate anything, ${userProfile?.name || ""}… e.g. "Should I prepay my home loan or invest?"`}
                disabled={isLoading}
                rows={1}
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#DDE6F5", fontSize: "0.92rem", resize: "none", fontFamily: "inherit", lineHeight: 1.5, maxHeight: "120px", overflowY: "auto" }}
                onInput={e => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
              />
              <button onClick={handleSend} disabled={isLoading || !input.trim()}
                style={{ width: "38px", height: "38px", borderRadius: "10px", background: (isLoading || !input.trim()) ? "#1A2B45" : "linear-gradient(135deg, #00D68F, #00B87A)", border: "none", cursor: (isLoading || !input.trim()) ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke={isLoading || !input.trim() ? "#3A506B" : "#060B18"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            <p style={{ color: "#1A2B45", fontSize: "0.68rem", marginTop: "6px", textAlign: "center" }}>FinMate provides educational guidance only · Not SEBI-registered advice</p>
          </div>
        </div>

        {/* ── Sidebar Dashboard ── */}
        {sidebarOpen && (
          <div style={{ width: "290px", flexShrink: 0, borderLeft: "1px solid #1A2B45", background: "#080E1C", overflowY: "auto", padding: "20px 16px" }}>

            {/* Persona card */}
            {persona && pc ? (
              <div style={{ background: pc.bg, border: `1px solid ${pc.border}`, borderRadius: "14px", padding: "16px", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                  <span style={{ fontSize: "1.6rem" }}>{pc.label}</span>
                  <div>
                    <p style={{ color: pc.color, fontWeight: 700, fontSize: "0.88rem", lineHeight: 1 }}>{persona.type}</p>
                    <p style={{ color: "#5A7096", fontSize: "0.7rem", marginTop: "2px" }}>{persona.emoji_label}</p>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: "8px", padding: "8px 10px" }}>
                    <p style={{ color: "#3A506B", fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Risk Score</p>
                    <p className="font-mono" style={{ color: pc.color, fontWeight: 700, fontSize: "1.1rem" }}>{persona.risk_score}<span style={{ fontSize: "0.7rem", color: "#5A7096" }}>/10</span></p>
                  </div>
                  <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: "8px", padding: "8px 10px" }}>
                    <p style={{ color: "#3A506B", fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Profile</p>
                    <p style={{ color: "#DDE6F5", fontWeight: 600, fontSize: "0.78rem", marginTop: "2px", textTransform: "capitalize" }}>{persona.risk_profile}</p>
                  </div>
                </div>
              </div>
            ) : (
              /* Skeleton loader while persona is being fetched */
              <div style={{ background: "#0C1526", border: "1px solid #1A2B45", borderRadius: "14px", padding: "20px", marginBottom: "16px", textAlign: "center" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "50%", border: "3px solid #00D68F", borderTopColor: "transparent", margin: "0 auto 10px", animation: "spin 0.8s linear infinite" }} />
                <p style={{ color: "#5A7096", fontSize: "0.8rem" }}>Detecting your persona…</p>
              </div>
            )}

            {/* Key Metrics */}
            {calculations ? (
              <>
                <p style={{ color: "#3A506B", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "10px" }}>Financial Snapshot</p>
                <div style={{ display: "grid", gap: "8px", marginBottom: "16px" }}>
                  <MetricCard
                    label="Savings Rate" icon="📊"
                    value={pct(savings?.rate_percent)}
                    valueColor={savings?.rate_percent >= 30 ? "#00D68F" : savings?.rate_percent >= 15 ? "#F5A623" : "#FF5C5C"}
                    sub={savings?.assessment?.replace(/_/g, " ")}
                  />
                  <MetricCard
                    label="Monthly Surplus" icon="💵"
                    value={fmtINR(savings?.monthly_surplus)}
                    valueColor="#00D68F"
                  />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <MetricCard
                      label="FIRE Age" icon="🔥"
                      value={fire?.achievable ? `${fire.fire_age} yrs` : "—"}
                      valueColor="#F5A623"
                      sub={fire?.achievable ? `${fire.years_to_fire}y away` : "Not yet"}
                    />
                    <MetricCard
                      label="FIRE Target" icon="🎯"
                      value={fmtINR(fire?.fire_corpus_target)}
                      valueColor="#F5A623"
                    />
                  </div>
                </div>

                <p style={{ color: "#3A506B", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "10px" }}>Safety Net</p>
                <div style={{ display: "grid", gap: "8px", marginBottom: "16px" }}>
                  <MetricCard
                    label="Emergency Fund" icon="🛡️"
                    value={emergency?.is_sufficient ? "✓ Covered" : fmtINR(emergency?.shortfall) + " gap"}
                    valueColor={emergency?.is_sufficient ? "#00D68F" : "#FF5C5C"}
                    sub={`${emergency?.months_covered}mo covered of 6mo`}
                  />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <MetricCard
                      label="Term Gap" icon="🔰"
                      value={insurance?.term_sufficient ? "✓ OK" : fmtINR(insurance?.term_gap)}
                      valueColor={insurance?.term_sufficient ? "#00D68F" : "#FF5C5C"}
                    />
                    <MetricCard
                      label="Health Gap" icon="🏥"
                      value={insurance?.health_sufficient ? "✓ OK" : fmtINR(insurance?.health_gap)}
                      valueColor={insurance?.health_sufficient ? "#00D68F" : "#FF5C5C"}
                    />
                  </div>
                </div>

                {/* Asset Allocation */}
                {alloc && (
                  <>
                    <p style={{ color: "#3A506B", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "10px" }}>Recommended Allocation</p>
                    <div style={{ background: "#0C1526", border: "1px solid #1A2B45", borderRadius: "10px", padding: "14px", marginBottom: "16px" }}>
                      {[
                        { label: "Equity",  val: alloc.equity,  color: "#00D68F" },
                        { label: "Debt",    val: alloc.debt,    color: "#4D9EFF" },
                        { label: "Gold",    val: alloc.gold,    color: "#F5A623" },
                        { label: "Liquid",  val: alloc.liquid,  color: "#A78BFA" },
                      ].map((a) => (
                        <div key={a.label} style={{ marginBottom: "10px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                            <span style={{ color: "#8AA3C2", fontSize: "0.75rem" }}>{a.label}</span>
                            <span className="font-mono" style={{ color: a.color, fontSize: "0.75rem", fontWeight: 700 }}>{Math.round((a.val || 0) * 100)}%</span>
                          </div>
                          <div style={{ height: "4px", background: "#1A2B45", borderRadius: "2px" }}>
                            <div style={{ height: "100%", width: `${Math.round((a.val || 0) * 100)}%`, background: a.color, borderRadius: "2px", transition: "width 0.6s ease" }} />
                          </div>
                        </div>
                      ))}
                      {alloc.market_note && (
                        <p style={{ color: "#5A7096", fontSize: "0.7rem", marginTop: "6px", fontStyle: "italic" }}>{alloc.market_note}</p>
                      )}
                    </div>
                  </>
                )}

                {/* SIP */}
                {calculations.sip_for_retirement > 0 && (
                  <div style={{ background: "rgba(0,214,143,0.06)", border: "1px solid rgba(0,214,143,0.2)", borderRadius: "10px", padding: "12px 14px" }}>
                    <p style={{ color: "#5A7096", fontSize: "0.7rem", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.07em" }}>Retirement SIP needed</p>
                    <p className="font-mono" style={{ color: "#00D68F", fontSize: "1.2rem", fontWeight: 700 }}>{fmtINR(calculations.sip_for_retirement)}<span style={{ color: "#5A7096", fontWeight: 400, fontSize: "0.8rem" }}>/mo</span></p>
                  </div>
                )}
              </>
            ) : (
              /* Skeleton loader for metrics while calculations load */
              <div>
                {[1, 2, 3].map(i => (
                  <div key={i} style={{ background: "#0C1526", border: "1px solid #1A2B45", borderRadius: "10px", padding: "14px", marginBottom: "8px" }} className="loading-shimmer">
                    <div style={{ height: "10px", width: "60%", background: "#1A2B45", borderRadius: "4px", marginBottom: "8px" }} />
                    <div style={{ height: "18px", width: "40%", background: "#1A2B45", borderRadius: "4px" }} />
                  </div>
                ))}
              </div>
            )}

            {/* Goals */}
            {userProfile?.goals?.length > 0 && (
              <div style={{ marginTop: "16px" }}>
                <p style={{ color: "#3A506B", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "10px" }}>Your Goals</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {userProfile.goals.map((g) => (
                    <span key={g} style={{ background: "rgba(77,158,255,0.1)", border: "1px solid rgba(77,158,255,0.25)", borderRadius: "6px", padding: "3px 10px", color: "#4D9EFF", fontSize: "0.72rem" }}>
                      {g.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}