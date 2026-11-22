import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "@/components/Layout";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Inbox from "@/pages/Inbox";
import HRInbox from "@/pages/HRInbox";
import Compose from "@/pages/Compose";
import Templates from "@/pages/Templates";
import Contacts from "@/pages/Contacts";
import Applications from "@/pages/Applications";
import ApplyStudio from "@/pages/ApplyStudio";
import Hub from "@/pages/Hub";
import ResumeBuilder from "@/pages/ResumeBuilder";
import Settings from "@/pages/Settings";
import { useS, loadInitialData } from "@/lib/store";
import { tokens } from "@/api/client";
import "./index.css";

function Protected({ children }: { children: JSX.Element }) {
  const user = useS((s) => s.user);
  const [checking, setChecking] = useState(!user && Boolean(tokens.access));

  useEffect(() => {
    if (!user && tokens.access) {
      loadInitialData().finally(() => {
        setChecking(false);
      });
    } else {
      setChecking(false);
    }
  }, [user]);

  if (checking) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          <p className="text-xs font-medium text-slate-500">Restoring session...</p>
        </div>
      </div>
    );
  }

  return user || tokens.access ? children : <Navigate to="/login" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Auth mode="login" />} /><Route path="/signup" element={<Auth mode="signup" />} />
        <Route element={<Protected><Layout /></Protected>}>
          <Route path="/" element={<Dashboard />} /><Route path="/apply-studio" element={<ApplyStudio />} /><Route path="/hub" element={<Hub />} /><Route path="/hr-inbox" element={<HRInbox />} /><Route path="/inbox" element={<Inbox />} /><Route path="/compose" element={<Compose />} />
          <Route path="/templates" element={<Templates />} /><Route path="/contacts" element={<Contacts />} /><Route path="/applications" element={<Applications />} />
          <Route path="/resume" element={<ResumeBuilder />} /><Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
