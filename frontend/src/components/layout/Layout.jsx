import Navbar from "./Navbar.jsx";
import Footer from "./Footer.jsx";
import ChatButton from "../chatbot/ChatButton.jsx";
import AlertToast from "../alerts/AlertToast.jsx";

export default function Layout({ children }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column"
      }}
    >
      <Navbar />
      <main style={{ flex: 1 }}>{children}</main>
      <Footer />
      <ChatButton />
      <AlertToast />
    </div>
  );
}
