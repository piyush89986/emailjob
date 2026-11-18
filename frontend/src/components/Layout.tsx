import { Link, NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, Inbox, PenSquare, FileText, Users, Briefcase, FileBadge, Settings, Moon, Sun, LogOut, AlertTriangle } from "lucide-react";
import { logout, toggleDark, useS } from "@/lib/store";
import { Toaster } from "./ui";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard }, { to: "/inbox", label: "Inbox", icon: Inbox },
  { to: "/compose", label: "Compose", icon: PenSquare }, { to: "/templates", label: "Templates", icon: FileText },
  { to: "/contacts", label: "Contacts", icon: Users }, { to: "/applications", label: "Applications", icon: Briefcase },
  { to: "/resume", label: "Resume Builder", icon: FileBadge }, { to: "/settings", label: "Settings", icon: Settings },
];

export default function Layout() {
  const unread = useS((s) => s.threads.filter((t) => t.unread).length);
  const dark = useS((s) => s.dark);
  const user = useS((s) => s.user);
  const reauth = useS((s) => s.accounts.some((a) => a.status !== "connected"));
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 md:flex-row">
      <aside className="shrink-0 border-b border-slate-200 p-2 dark:border-slate-800 md:w-56 md:border-b-0 md:border-r md:p-3">
        <div className="mb-2 hidden px-2 text-lg font-semibold md:block">JobMail</div>
        <nav className="flex gap-1 overflow-x-auto md:flex-col">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `flex shrink-0 items-center gap-2 rounded-md px-2 py-2 text-sm ${isActive ? "bg-slate-200 dark:bg-slate-800" : "hover:bg-slate-100 dark:hover:bg-slate-900"}`}>
              <Icon size={16} /> {label}
              {label === "Inbox" && unread > 0 && <span className="ml-auto rounded-full bg-indigo-600 px-1.5 text-xs text-white">{unread}</span>}
            </NavLink>))}
        </nav>
      </aside>
      <div className="flex-1">
        <header className="flex items-center justify-end gap-3 border-b border-slate-200 px-4 py-2 text-sm dark:border-slate-800">
          <span className="text-slate-500">{user?.email}</span>
          <button onClick={toggleDark} aria-label="Toggle dark mode">{dark ? <Sun size={16} /> : <Moon size={16} />}</button>
          <button onClick={logout} aria-label="Log out"><LogOut size={16} /></button>
        </header>
        {reauth && <Link to="/settings" className="flex items-center gap-2 bg-amber-100 px-4 py-2 text-sm text-amber-900"><AlertTriangle size={14} /> A mailbox needs to be reconnected. Fix it in Settings.</Link>}
        <main className="p-4 md:p-6"><Outlet /></main>
      </div>
      <Toaster />
    </div>
  );
}
