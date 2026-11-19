import { ReactNode, useEffect, useState } from "react";
import { useS } from "@/lib/store";

export const Skeleton = ({ n = 3 }: { n?: number }) => (
  <div className="space-y-2">{Array.from({ length: n }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-md bg-slate-200 dark:bg-slate-800" />)}</div>
);
export const Empty = ({ title, hint }: { title: string; hint?: string }) => (
  <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center dark:border-slate-700"><div className="font-medium">{title}</div>{hint && <div className="mt-1 text-sm text-slate-500">{hint}</div>}</div>
);
export const useReady = (ms = 400) => { const [r, s] = useState(false); useEffect(() => { const t = setTimeout(() => s(true), ms); return () => clearTimeout(t); }, [ms]); return r; };
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
    <div className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-2">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <div className="flex gap-2">{actions}</div>
    </div>
    {children}
  </div>
);
const colors: Record<string, string> = { Replied: "bg-green-100 text-green-800", replied: "bg-green-100 text-green-800", Contacted: "bg-slate-200 text-slate-800", waiting: "bg-amber-100 text-amber-800", bounced: "bg-red-100 text-red-800", Interview: "bg-blue-100 text-blue-800", Offer: "bg-emerald-200 text-emerald-900", Rejected: "bg-rose-100 text-rose-800", connected: "bg-green-100 text-green-800", needs_reauth: "bg-amber-100 text-amber-800", error: "bg-red-100 text-red-800", failed: "bg-red-100 text-red-800", sent: "bg-green-100 text-green-800", sending: "bg-slate-200 text-slate-700" };
export const Badge = ({ v }: { v: string }) => <span className={`badge ${colors[v] ?? "bg-slate-200 text-slate-800"}`}>{v.replace("_", " ")}</span>;
export const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—");
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
  return <div className="fixed bottom-4 right-4 z-50 space-y-2">{t.map((x) => <div key={x.id} className={`rounded-md px-4 py-2 text-sm text-white shadow ${x.type === "ok" ? "bg-slate-800" : "bg-red-600"}`}>{x.msg}</div>)}</div>;
}
export function Tabs({ tabs, value, onChange }: { tabs: string[]; value: string; onChange: (t: string) => void }) {
  return <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-800">{tabs.map((t) => <button key={t} onClick={() => onChange(t)} className={`px-3 py-2 text-sm ${value === t ? "border-b-2 border-indigo-600 font-medium" : "text-slate-500"}`}>{t}</button>)}</div>;
}
