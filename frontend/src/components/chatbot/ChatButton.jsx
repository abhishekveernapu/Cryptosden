import { useState } from "react";
import ChatWindow from "./ChatWindow.jsx";
import "../../styles/chatbot.css";

export default function ChatButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {open && <ChatWindow onClose={() => setOpen(false)} />}
      <button
        className="chat-fab"
        onClick={() => setOpen((o) => !o)}
        title="CryptosDen AI"
        aria-label="Open AI Chat"
      >
        {open ? "✕" : "🤖"}
      </button>
    </>
  );
}
