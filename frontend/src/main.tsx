import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "@/components/Layout";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Inbox from "@/pages/Inbox";
import Compose from "@/pages/Compose";
import Templates from "@/pages/Templates";
import Contacts from "@/pages/Contacts";
import Applications from "@/pages/Applications";
import ApplyStudio from "@/pages/ApplyStudio";
import ResumeBuilder from "@/pages/ResumeBuilder";
import Settings from "@/pages/Settings";
import { useS } from "@/lib/store";
import "./index.css";

function Protected({ children }: { children: JSX.Element }) { const user = useS((s) => s.user); return user ? children : <Navigate to="/login" replace />; }

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Auth mode="login" />} /><Route path="/signup" element={<Auth mode="signup" />} />
        <Route element={<Protected><Layout /></Protected>}>
          <Route path="/" element={<Dashboard />} /><Route path="/apply-studio" element={<ApplyStudio />} /><Route path="/inbox" element={<Inbox />} /><Route path="/compose" element={<Compose />} />
          <Route path="/templates" element={<Templates />} /><Route path="/contacts" element={<Contacts />} /><Route path="/applications" element={<Applications />} />
          <Route path="/resume" element={<ResumeBuilder />} /><Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
