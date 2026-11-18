import { Link, NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, Inbox, PenSquare, FileText, Users, Briefcase, FileBadge, Settings, Moon, Sun, LogOut, AlertTriangle } from "lucide-react";
import { logout, toggleDark, useS } from "@/lib/store";
import { Toaster } from "./ui";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/inbox", label: "Inbox", icon: Inbox },
  { to: "/compose", label: "Compose", icon: PenSquare },
  { to: "/templates", label: "Templates", icon: FileText },
  { to: "/contacts", label: "Contacts", icon: Users },
  { to: "/applications", label: "Applications", icon: Briefcase },
  { to: "/resume", label: "Resume Builder", icon: FileBadge },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function Layout() {
  const unread = useS((s) => s.threads.filter((t) => t.unread).length);
  const dark = useS((s) => s.dark);
  const user = useS((s) => s.user);
  const reauth = useS((s) => s.accounts.some((a) => a.status !== "connected"));

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex-col md:flex-row">
      {/* Sidebar: Fixed on left on desktop, top bar on mobile */}
      <aside className="shrink-0 border-b border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900 md:w-56 md:border-b-0 md:border-r md:p-3 md:h-screen md:overflow-y-auto flex flex-col justify-between z-20">
        <div>
          <div className="mb-3 hidden items-center gap-2 px-2 md:flex">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 font-bold text-white text-sm shadow-sm">
              J
            </div>
            <span className="text-lg font-bold tracking-tight">JobMail</span>
          </div>
          <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
            {nav.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  `flex shrink-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 font-semibold"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  }`
                }
              >
                <Icon size={17} />
                <span>{label}</span>
                {label === "Inbox" && unread > 0 && (
                  <span className="ml-auto rounded-full bg-indigo-600 px-1.5 py-0.2 text-xs font-semibold text-white">
                    {unread}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="hidden border-t border-slate-100 pt-3 dark:border-slate-800 md:block">
          <div className="flex items-center gap-2 px-2 py-1 text-xs text-slate-500">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0"></span>
            <span className="truncate">{user?.email || "Connected"}</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area: header fixed at top, content scrolls cleanly */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="shrink-0 flex items-center justify-between border-b border-slate-200 px-4 py-2 text-sm dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur z-10">
          <div className="flex items-center gap-2 md:hidden">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-600 font-bold text-white text-xs">
              J
            </div>
            <span className="font-bold text-slate-900 dark:text-white">JobMail</span>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <span className="hidden text-xs text-slate-500 sm:inline">{user?.email}</span>
            <button
              onClick={toggleDark}
              aria-label="Toggle dark mode"
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
            >
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              onClick={logout}
              aria-label="Log out"
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-rose-400 transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {reauth && (
          <Link
            to="/settings"
            className="shrink-0 flex items-center gap-2 bg-amber-100 px-4 py-2 text-sm text-amber-900"
          >
            <AlertTriangle size={14} />
            <span>A mailbox needs to be reconnected. Fix it in Settings.</span>
          </Link>
        )}

        <main className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 flex flex-col">
          <Outlet />
        </main>
      </div>

      <Toaster />
    </div>
  );
}
