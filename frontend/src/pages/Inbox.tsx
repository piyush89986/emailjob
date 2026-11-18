import { useState } from "react";
import { markRead, retrySend, sendEmail, simulateReply, threadState, useS } from "@/lib/store";
import { Badge, Empty, fmt, Page, Skeleton, strip, useReady } from "@/components/ui";

export default function Inbox() {
  const ready = useReady(); const threads = useS((s) => s.threads); const contacts = useS((s) => s.contacts);
  const [q, setQ] = useState(""); const [f, setF] = useState("all"); const [sel, setSel] = useState<string | null>(null); const [reply, setReply] = useState("");
  const list = threads.filter((t) => (f === "all" || threadState(t) === f) && (t.subject + t.messages.map((m) => m.body).join(" ")).toLowerCase().includes(q.toLowerCase()));
  const cur = threads.find((t) => t.id === sel); const contact = cur && contacts.find((c) => c.id === cur.contactId);
  const open = (id: string) => { setSel(id); markRead(id); };
  const send = () => { if (cur && contact && reply.trim() && sendEmail(contact.email, cur.subject, `<p>${reply}</p>`, cur.id)) setReply(""); };
  return (
    <Page title="Inbox" actions={<button className="btn-ghost" onClick={simulateReply}>Simulate incoming reply</button>}>
      <div className="grid gap-4 md:grid-cols-[340px_1fr]">
        <div>
          <input className="input mb-2" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="mb-2 flex gap-1">{["all", "replied", "waiting", "bounced"].map((x) => <button key={x} onClick={() => setF(x)} className={`rounded-full px-3 py-1 text-xs ${f === x ? "bg-indigo-600 text-white" : "bg-slate-200 dark:bg-slate-800"}`}>{x}</button>)}</div>
          {!ready ? <Skeleton n={4} /> : list.length === 0 ? <Empty title="No conversations" hint="Sent emails and replies will appear here." /> :
            <div className="space-y-1">{list.map((t) => { const c = contacts.find((x) => x.id === t.contactId); const last = t.messages[t.messages.length - 1];
              return <button key={t.id} onClick={() => open(t.id)} className={`card w-full text-left ${sel === t.id ? "ring-2 ring-indigo-500" : ""}`}>
                <div className="flex items-center justify-between"><span className={`text-sm ${t.unread ? "font-semibold" : ""}`}>{c?.name}</span><Badge v={threadState(t)} /></div>
                <div className="truncate text-sm">{t.subject}</div><div className="truncate text-xs text-slate-500">{strip(last.body)}</div></button>; })}</div>}
        </div>
        <div>
          {!cur ? <Empty title="Select a conversation" /> : (
            <div className="card">
              <h2 className="font-medium">{cur.subject}</h2><p className="mb-3 text-xs text-slate-500">{contact?.name} &lt;{contact?.email}&gt;</p>
              <div className="space-y-3">{cur.messages.map((m) => (
                <div key={m.id} className={`rounded-md p-3 text-sm ${m.dir === "out" ? "bg-indigo-50 dark:bg-indigo-950" : "bg-slate-100 dark:bg-slate-800"}`}>
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-500"><span>{m.dir === "out" ? "You" : m.from}</span><span className="flex items-center gap-2">{m.kind !== "normal" && <Badge v={m.kind === "bounce" ? "bounced" : "auto-reply"} />}{m.delivery && <Badge v={m.delivery} />}{fmt(m.at)}</span></div>
                  <div dangerouslySetInnerHTML={{ __html: m.body }} />
                  {m.delivery === "failed" && <button className="btn-ghost mt-2" onClick={() => retrySend(cur.id, m.id)}>Retry</button>}
                </div>))}</div>
              <textarea className="input mt-3" rows={3} placeholder="Write a reply…" value={reply} onChange={(e) => setReply(e.target.value)} />
              <button className="btn mt-2" onClick={send}>Send reply</button>
            </div>)}
        </div>
      </div>
    </Page>
  );
}
