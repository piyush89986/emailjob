import { ReactNode, useEffect, useState } from "react";
import { useS } from "@/lib/store";
import { Inbox, CheckCircle2, AlertCircle } from "lucide-react";

export const Skeleton = ({ n = 3 }: { n?: number }) => (
  <div className="space-y-2">
    {Array.from({ length: n }).map((_, i) => (
      <div
        key={i}
        className="h-12 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/60"
      />
    ))}
  </div>
);

export const Empty = ({ title, hint, icon }: { title: string; hint?: string; icon?: ReactNode }) => (
  <div className="rounded-2xl border border-dashed border-slate-200/90 dark:border-slate-800 p-8 text-center bg-slate-50/50 dark:bg-slate-900/30 flex flex-col items-center justify-center">
    <div className="mb-2 text-slate-400 dark:text-slate-600">
      {icon || <Inbox size={28} strokeWidth={1.5} />}
    </div>
    <div className="font-semibold text-sm text-slate-800 dark:text-slate-200">{title}</div>
    {hint && <div className="mt-1 text-xs text-slate-500 max-w-sm leading-relaxed">{hint}</div>}
  </div>
);

export const useReady = (ms = 400) => {
  const [r, s] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => s(true), ms);
    return () => clearTimeout(t);
  }, [ms]);
  return r;
};

export const Page = ({
  title,
  actions,
  children,
  className = "",
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) => (
  <div className={`flex flex-col flex-1 min-h-0 ${className}`}>
    <div className="mb-3.5 flex shrink-0 flex-wrap items-center justify-between gap-2.5">
      <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
        {title}
      </h1>
      <div className="flex items-center gap-2">{actions}</div>
    </div>
    {children}
  </div>
);

const colors: Record<string, string> = {
  Replied: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/80",
  replied: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/80",
  Contacted: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  waiting: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/80",
  bounced: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/80",
  Interview: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800/80",
  Offer: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-700 font-bold",
  Rejected: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/80",
  connected: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/80",
  needs_reauth: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/80",
  error: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/80",
  failed: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/80",
  sent: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/80",
  sending: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
};

export const Badge = ({ v }: { v: string }) => (
  <span className={`badge ${colors[v] ?? "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"}`}>
    {v.replace("_", " ")}
  </span>
);

export const fmt = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

export const strip = (h: string) =>
  h
    ? h
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    : "";

export function Toaster() {
  const t = useS((s) => s.toasts);
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {t.map((x) => (
        <div
          key={x.id}
          className={`pointer-events-auto inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold shadow-lg transition-all ${
            x.type === "ok"
              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
              : "bg-rose-600 text-white"
          }`}
        >
          {x.type === "ok" ? (
            <CheckCircle2 size={14} className="text-emerald-400 dark:text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle size={14} className="text-rose-200 shrink-0" />
          )}
          <span>{x.msg}</span>
        </div>
      ))}
    </div>
  );
}

export function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: string[];
  value: string;
  onChange: (t: string) => void;
}) {
  return (
    <div className="mb-4 inline-flex items-center gap-1 rounded-full bg-slate-100/90 p-1 border border-slate-200/70 dark:bg-slate-800/60 dark:border-slate-700/60">
      {tabs.map((t) => {
        const isActive = value === t;
        return (
          <button
            key={t}
            onClick={() => onChange(t)}
            className={`rounded-full px-3.5 py-1 text-xs font-medium transition-all duration-150 ${
              isActive
                ? "bg-white text-slate-900 font-semibold shadow-xs dark:bg-slate-900 dark:text-white"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            }`}
          >
            {t}
          </button>
        );
      })}
    </div>
  );
}
