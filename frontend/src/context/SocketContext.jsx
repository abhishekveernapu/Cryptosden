import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState
} from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext.jsx";

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { isAuth } = useAuth();
  const socketRef = useRef(null);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!isAuth) return;

    const token = localStorage.getItem("token");
    socketRef.current = io(import.meta.env.VITE_SOCKET_URL, {
      auth: { token },
      reconnectionAttempts: 5
    });

    socketRef.current.on("notification", (data) => {
      setNotifications((prev) => [
        { ...data, id: Date.now(), read: false },
        ...prev.slice(0, 19)
      ]);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [isAuth]);

  const clearNotification = (id) =>
    setNotifications((prev) => prev.filter((n) => n.id !== id));

  const clearAll = () => setNotifications([]);

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        notifications,
        clearNotification,
        clearAll,
        unreadCount: notifications.filter((n) => !n.read).length
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
