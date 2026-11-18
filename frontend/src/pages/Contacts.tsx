import { useState } from "react";
import { setContactStatus, set, uid, useS, STATUSES, Status, toast } from "@/lib/store";
import { Badge, Empty, fmt, Page, Skeleton, Tabs, useReady } from "@/components/ui";

export default function Contacts() {
  const ready = useReady(); const contacts = useS((s) => s.contacts); const [tab, setTab] = useState("Table");
  const [f, setF] = useState({ name: "", email: "", company: "" });
  const add = () => { if (!f.email) return toast("Email required", "err"); set((s) => ({ contacts: [...s.contacts, { id: uid(), ...f, name: f.name || f.email, status: "Contacted" as Status, createdAt: new Date().toISOString() }] })); setF({ name: "", email: "", company: "" }); };
  const Sel = ({ id, v }: { id: string; v: Status }) => <select className="input w-auto py-1" value={v} onChange={(e) => setContactStatus(id, e.target.value as Status)}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>;
  return (
    <Page title="Contacts">
      <div className="card mb-4 grid gap-2 md:grid-cols-4"><input className="input" placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /><input className="input" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /><input className="input" placeholder="Company" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} /><button className="btn" onClick={add}>Add contact</button></div>
      <Tabs tabs={["Table", "Kanban", "Who replied"]} value={tab} onChange={setTab} />
      {!ready ? <Skeleton /> : contacts.length === 0 ? <Empty title="No contacts yet" /> : tab === "Table" ? (
        <div className="card overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-slate-500"><tr><th className="p-2">Name</th><th>Company</th><th>Email</th><th>Status</th><th>Last reply</th></tr></thead>
          <tbody>{contacts.map((c) => <tr key={c.id} className="border-t border-slate-100 dark:border-slate-800"><td className="p-2">{c.name}</td><td>{c.company}</td><td>{c.email}</td><td><Sel id={c.id} v={c.status} /></td><td>{fmt(c.lastRepliedAt)}</td></tr>)}</tbody></table></div>
      ) : tab === "Kanban" ? (
        <div className="grid gap-3 md:grid-cols-5">{STATUSES.map((s) => <div key={s} className="rounded-lg bg-slate-100 p-2 dark:bg-slate-900"><div className="mb-2 flex justify-between text-sm font-medium">{s}<span>{contacts.filter((c) => c.status === s).length}</span></div>
          <div className="space-y-2">{contacts.filter((c) => c.status === s).map((c) => <div key={c.id} className="card p-2 text-sm"><div>{c.name}</div><div className="text-xs text-slate-500">{c.company}</div><div className="mt-1"><Sel id={c.id} v={c.status} /></div></div>)}</div></div>)}</div>
      ) : (
        <div className="card">{contacts.filter((c) => c.lastRepliedAt).sort((a, b) => +new Date(b.lastRepliedAt!) - +new Date(a.lastRepliedAt!)).map((c) => <div key={c.id} className="flex items-center justify-between border-b border-slate-100 py-2 text-sm last:border-0 dark:border-slate-800"><span>{c.name} · {c.company}</span><span className="flex items-center gap-2"><Badge v={c.status} />{fmt(c.lastRepliedAt)}</span></div>)}</div>
      )}
    </Page>
  );
}
