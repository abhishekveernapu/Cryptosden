import { useState, useRef, useEffect } from "react";
import { sendChat } from "../../api/chat";
import { useAuth } from "../../context/AuthContext.jsx";

export default function ChatWindow({ onClose }) {
  const { isAuth } = useAuth();
  const [messages, setMessages] = useState([
    {
      role: "model",
      parts: [{ text: "👋 Hi! I'm CryptosDen AI. Ask me anything about crypto markets, coins, or predictions." }]
    }
  ]);
  const [input,   setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const [puterReady, setPuterReady] = useState(false);
  const bottomRef = useRef(null);

  // ── Wait for Puter.js to load ──────────────────────────────────
  useEffect(() => {
    const check = () => {
      if (window.puter?.ai) {
        setPuterReady(true);
      } else {
        setTimeout(check, 300);
      }
    };
    check();
  }, []);

  // ── Auto scroll ────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // ── Send ───────────────────────────────────────────────────────
  const send = async () => {
    if (!input.trim() || loading) return;

    if (!isAuth) {
      setMessages(prev => [
        ...prev,
        { role: "model", parts: [{ text: "🔒 Please log in to use the AI assistant." }] }
      ]);
      return;
    }

    if (!puterReady) {
      setMessages(prev => [
        ...prev,
        { role: "model", parts: [{ text: "⏳ AI is initialising, please try again in a moment." }] }
      ]);
      return;
    }

    const userMsg = { role: "user", parts: [{ text: input.trim() }] };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);

    try {
      const res = await sendChat(updated);
      setMessages(prev => [
        ...prev,
        { role: "model", parts: [{ text: res.data.reply }] }
      ]);
    } catch (err) {
      const errMsg = err?.message || "Something went wrong. Please try again.";
      setMessages(prev => [
        ...prev,
        { role: "model", parts: [{ text: `⚠️ ${errMsg}` }] }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-window">

      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-avatar">🤖</div>
        <div className="chat-header-info">
          <strong>CryptosDen AI</strong>
          <span>
            {!puterReady ? "⏳ Initialising..." : "● GPT-4 Mini"}
          </span>
        </div>
        <button className="chat-close-btn" onClick={onClose}>✕</button>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg ${m.role}`}>
            <div className="chat-msg-avatar">
              {m.role === "user" ? "👤" : "🤖"}
            </div>
            <div className="chat-bubble">{m.parts[0].text}</div>
          </div>
        ))}

        {loading && (
          <div className="chat-msg model">
            <div className="chat-msg-avatar">🤖</div>
            <div className="chat-bubble">
              <div className="chat-typing">
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <textarea
          className="chat-input"
          rows={1}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e =>
            e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())
          }
          placeholder={puterReady ? "Ask about Bitcoin, trends..." : "Initialising AI..."}
          disabled={loading || !puterReady}
        />
        <button
          className="chat-send-btn"
          onClick={send}
          disabled={loading || !input.trim() || !puterReady}
        >
          ➤
        </button>
      </div>
    </div>
  );
}
