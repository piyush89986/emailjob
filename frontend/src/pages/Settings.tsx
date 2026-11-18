import { useState } from "react";
import { Account, Prefs, set, toast, uid, useS } from "@/lib/store";
import { Badge, Page, Tabs } from "@/components/ui";
import { ProfileEditor } from "./ResumeBuilder";

const providers: { id: Account["provider"]; name: string; desc: string }[] = [
  { id: "gmail", name: "Gmail", desc: "Google OAuth (send + read)" }, { id: "outlook", name: "Outlook / Microsoft 365", desc: "Microsoft OAuth via Graph" }, { id: "imap", name: "Other (IMAP/SMTP)", desc: "Host, port, app password" }];

function Accounts() {
  const accounts = useS((s) => s.accounts); const [imap, setImap] = useState(false);
  const [f, setF] = useState({ host: "", port: "993", ssl: true, user: "", pass: "" }); const [tested, setTested] = useState("");
  const upd = (id: string, patch: Partial<Account>) => set((s) => ({ accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
  const connect = (p: Account["provider"], address: string) => { set((s) => ({ accounts: [...s.accounts, { id: uid(), provider: p, address, status: "connected", isDefault: s.accounts.length === 0 }] })); toast("Mailbox connected"); };
  const test = () => setTested(f.host && f.user && f.pass ? "ok" : "fail");
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">{providers.map((p) => <div key={p.id} className="card"><div className="font-medium">{p.name}</div><div className="text-xs text-slate-500">{p.desc}</div>
        <button className="btn mt-3" onClick={() => (p.id === "imap" ? setImap(true) : connect(p.id, `you@${p.id}.com`))}>Connect</button></div>)}</div>
      {imap && <div className="card grid gap-2 md:grid-cols-2">
        <input className="input" placeholder="IMAP host" value={f.host} onChange={(e) => setF({ ...f, host: e.target.value })} /><input className="input" placeholder="Port" value={f.port} onChange={(e) => setF({ ...f, port: e.target.value })} />
        <input className="input" placeholder="Username" value={f.user} onChange={(e) => setF({ ...f, user: e.target.value })} /><input className="input" type="password" placeholder="App password" value={f.pass} onChange={(e) => setF({ ...f, pass: e.target.value })} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.ssl} onChange={(e) => setF({ ...f, ssl: e.target.checked })} /> Use SSL</label>
        <div className="flex gap-2"><button className="btn-ghost" onClick={test}>Test connection</button><button className="btn" disabled={tested !== "ok"} onClick={() => { connect("imap", f.user); setImap(false); }}>Save</button></div>
        {tested && <p className={`text-sm md:col-span-2 ${tested === "ok" ? "text-green-600" : "text-red-600"}`}>{tested === "ok" ? "Connection looks good" : "Fill host, username and password"}</p>}</div>}
      <div className="space-y-2">{accounts.map((a) => <div key={a.id} className="card flex flex-wrap items-center justify-between gap-2">
        <div><div className="text-sm font-medium">{a.address}</div><div className="text-xs text-slate-500">{a.provider}</div></div>
        <div className="flex items-center gap-2"><Badge v={a.status} />{a.isDefault && <span className="badge bg-indigo-100 text-indigo-800">Default</span>}
          {a.status !== "connected" && <button className="btn" onClick={() => upd(a.id, { status: "connected" })}>Reconnect</button>}
          {!a.isDefault && <button className="btn-ghost" onClick={() => set((s) => ({ accounts: s.accounts.map((x) => ({ ...x, isDefault: x.id === a.id })) }))}>Make default</button>}
          <button className="btn-ghost" onClick={() => set((s) => ({ accounts: s.accounts.filter((x) => x.id !== a.id) }))}>Disconnect</button></div></div>)}</div>
    </div>);
}

export default function Settings() {
  const [tab, setTab] = useState("Email accounts"); const prefs = useS((s) => s.prefs); const state = useS((s) => s);
  const [dnc, setDnc] = useState(""); const up = (p: Partial<Prefs>) => set((s) => ({ prefs: { ...s.prefs, ...p } }));
  const exportData = () => { const { user, contacts, threads, templates, apps, profile, prefs } = state; const b = new Blob([JSON.stringify({ user, contacts, threads, templates, apps, profile, prefs }, null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "jobmail-export.json"; a.click(); };
  return (
    <Page title="Settings">
      <Tabs tabs={["Email accounts", "Profile", "AI preferences", "Sending limits", "Do-not-contact", "Account"]} value={tab} onChange={setTab} />
      {tab === "Email accounts" && <Accounts />}
      {tab === "Profile" && <ProfileEditor />}
      {tab === "AI preferences" && <div className="card max-w-md space-y-3">
        <div><label className="label">Default tone</label><select className="input" value={prefs.tone} onChange={(e) => up({ tone: e.target.value as Prefs["tone"] })}>{["formal", "friendly", "concise"].map((t) => <option key={t}>{t}</option>)}</select></div>
        <div><label className="label">Provider</label><select className="input" value={prefs.provider} onChange={(e) => up({ provider: e.target.value as Prefs["provider"] })}><option value="openai">OpenAI</option><option value="gemini">Gemini</option></select></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={prefs.fallback} onChange={(e) => up({ fallback: e.target.checked })} /> Fall back to the other provider on failure</label></div>}
      {tab === "Sending limits" && <div className="card max-w-md space-y-3">
        <div><label className="label">Daily send cap</label><input type="number" min={1} max={100} className="input" value={prefs.dailyCap} onChange={(e) => up({ dailyCap: +e.target.value })} /></div>
        <div><label className="label">Delay between sends (seconds)</label><input type="number" min={0} className="input" value={prefs.delaySec} onChange={(e) => up({ delaySec: +e.target.value })} /></div>
        <p className="text-xs text-slate-500">Limits keep your mailbox healthy. Bulk cold-emailing isn't supported.</p></div>}
      {tab === "Do-not-contact" && <div className="card max-w-md space-y-2">
        <div className="flex gap-2"><input className="input" placeholder="email@company.com" value={dnc} onChange={(e) => setDnc(e.target.value)} /><button className="btn" onClick={() => { if (dnc) { up({ dnc: [...prefs.dnc, dnc.trim()] }); setDnc(""); } }}>Add</button></div>
        {prefs.dnc.map((d) => <div key={d} className="flex justify-between text-sm"><span>{d}</span><button className="text-red-600" onClick={() => up({ dnc: prefs.dnc.filter((x) => x !== d) })}>Remove</button></div>)}</div>}
      {tab === "Account" && <div className="card max-w-md space-y-3"><p className="text-sm">Signed in as {state.user?.email}</p>
        <button className="btn-ghost" onClick={exportData}>Export my data</button>
        <button className="btn-ghost text-red-600" onClick={() => confirm("Disconnect all mailboxes and delete your data?") && (set(() => ({ accounts: [], threads: [], contacts: [], apps: [] })), toast("Data deleted"))}>Delete my data & disconnect mailboxes</button></div>}
    </Page>
  );
}
