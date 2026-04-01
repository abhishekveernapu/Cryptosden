import { useEffect } from "react";
import { useSocket } from "../../context/SocketContext.jsx";

export default function AlertToast() {
  const { notifications, clearNotification } = useSocket();
  const recent = notifications.filter((n) => !n.read).slice(0, 3);

  return (
    <div
      style={{
        position: "fixed",
        top: "80px",
        right: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        zIndex: 999
      }}
    >
      {recent.map((n) => (
        <Toast
          key={n.id}
          notification={n}
          onClose={() => clearNotification(n.id)}
        />
      ))}
    </div>
  );
}

function Toast({ notification, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [onClose]);

  const isCritical = notification.severity === "critical";
  const isPump = notification.type === "pump";

  return (
    <div
      style={{
        background: "var(--bg-secondary)",
        border: `1px solid ${
          isCritical ? "var(--red)" : "var(--yellow)"
        }`,
        borderRadius: "12px",
        padding: "14px 16px",
        minWidth: "300px",
        maxWidth: "360px",
        boxShadow: "var(--shadow)",
        animation: "slideUp 0.3s ease",
        display: "flex",
        gap: "12px",
        alignItems: "flex-start"
      }}
    >
      <span style={{ fontSize: "20px" }}>
        {isPump
          ? "🚀"
          : notification.type === "whale_transfer"
          ? "🐳"
          : "📉"}
      </span>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: "13px",
            marginBottom: "4px"
          }}
        >
          {notification.coinName}
          <span
            style={{
              marginLeft: "8px",
              fontSize: "11px",
              padding: "2px 6px",
              borderRadius: "4px",
              background: isCritical ? "var(--red)" : "var(--yellow)",
              color: "#fff"
            }}
          >
            {notification.severity?.toUpperCase()}
          </span>
        </div>
        <div
          style={{
            color: "var(--text-secondary)",
            fontSize: "12px"
          }}
        >
          {notification.message}
        </div>
      </div>
      <button
        onClick={onClose}
        style={{
          background: "none",
          border: "none",
          color: "var(--text-muted)",
          cursor: "pointer",
          fontSize: "14px",
          padding: 0
        }}
      >
        ✕
      </button>
    </div>
  );
}
