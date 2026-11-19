import { Link, NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, Inbox, PenSquare, FileText, Users, Briefcase, FileBadge, Settings, Moon, Sun, LogOut, AlertTriangle, Sparkles } from "lucide-react";
import { logout, toggleDark, useS } from "@/lib/store";
import { Toaster } from "./ui";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/apply-studio", label: "Apply Studio", icon: Sparkles },
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
      <aside className="shrink-0 border-b border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 md:w-60 md:border-b-0 md:border-r md:p-4 md:h-screen md:overflow-y-auto flex flex-col justify-between z-20">
        <div>
          {/* Header row: on desktop JobMail; on mobile JobMail + actions */}
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 font-bold text-white text-sm shadow-sm">
                J
              </div>
              <span className="text-lg font-bold tracking-tight">BJob</span>
            </div>

            {/* Mobile-only action buttons */}
            <div className="flex items-center gap-1.5 md:hidden">
              <button
                onClick={toggleDark}
                aria-label="Toggle dark mode"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
              >
                {dark ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <button
                onClick={logout}
                aria-label="Log out"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-rose-400 transition-colors"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>

          {/* Navigation links */}
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

        {/* Desktop-only footer in sidebar with User info, Theme toggle, and Logout */}
        <div className="hidden border-t border-slate-200 pt-3 dark:border-slate-800 md:flex md:items-center md:justify-between md:gap-2 mt-auto">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 text-xs font-bold">
              {user?.email ? user.email[0].toUpperCase() : "U"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-slate-800 dark:text-slate-200">
                {user?.email || "Account"}
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                <span>Active</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={toggleDark}
              aria-label="Toggle dark mode"
              title={dark ? "Switch to light mode" : "Switch to dark mode"}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
            >
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              onClick={logout}
              aria-label="Log out"
              title="Log out"
              className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area (No top header!) */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {reauth && (
          <Link
            to="/settings"
            className="shrink-0 flex items-center gap-2 bg-amber-100 px-4 py-2 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-300"
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
