import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Inbox,
  PenSquare,
  FileText,
  Users,
  Briefcase,
  FileBadge,
  Settings,
  Moon,
  Sun,
  LogOut,
  AlertTriangle,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
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

  // Sidebar collapse state with localStorage persistence
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem("jobmail_sidebar_collapsed") === "true";
  });

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("jobmail_sidebar_collapsed", String(next));
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex-col md:flex-row">
      {/* Sidebar: Fixed on left on desktop, top bar on mobile */}
      <aside
        className={`relative shrink-0 border-b border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 ${
          collapsed ? "md:w-16 md:p-2.5" : "md:w-60 md:p-4"
        } md:border-b-0 md:border-r md:h-screen md:overflow-y-auto flex flex-col justify-between z-20 transition-all duration-300 ease-in-out`}
      >
        {/* Desktop Expand/Collapse Arrow Button on border edge */}
        <button
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="hidden md:flex absolute -right-3 top-5 z-30 h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-100 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-all cursor-pointer"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        <div>
          {/* Header row: on desktop JobMail; on mobile JobMail + actions */}
          <div className={`mb-3 flex items-center ${collapsed ? "justify-center" : "justify-between"}`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 font-bold text-white text-sm shadow-sm shrink-0">
                J
              </div>
              {!collapsed && (
                <span className="text-lg font-bold tracking-tight truncate">BJob</span>
              )}
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
                title={collapsed ? label : undefined}
                className={({ isActive }) =>
                  `relative flex shrink-0 items-center ${
                    collapsed ? "md:justify-center md:px-2" : "gap-2.5 px-2.5"
                  } rounded-lg py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 font-semibold"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  }`
                }
              >
                <Icon size={18} className="shrink-0" />
                {!collapsed && <span className="truncate">{label}</span>}
                {label === "Inbox" && unread > 0 && (
                  collapsed ? (
                    <span className="hidden md:block absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-indigo-600 ring-2 ring-white dark:ring-slate-900" />
                  ) : (
                    <span className="ml-auto rounded-full bg-indigo-600 px-1.5 py-0.2 text-xs font-semibold text-white">
                      {unread}
                    </span>
                  )
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Desktop-only footer in sidebar with User info, Theme toggle, and Logout */}
        <div
          className={`hidden border-t border-slate-200 pt-3 dark:border-slate-800 md:flex ${
            collapsed ? "flex-col items-center gap-2" : "items-center justify-between gap-2"
          } mt-auto`}
        >
          <div className={`flex items-center ${collapsed ? "justify-center" : "gap-2"} min-w-0 flex-1`}>
            <div
              title={user?.email || "Account"}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 text-xs font-bold"
            >
              {user?.email ? user.email[0].toUpperCase() : "U"}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium text-slate-800 dark:text-slate-200">
                  {user?.email || "Account"}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                  <span>Active</span>
                </div>
              </div>
            )}
          </div>
          <div className={`flex items-center ${collapsed ? "flex-col gap-1" : "gap-1"} shrink-0`}>
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
