import { useState } from "react";
import { markRead, retrySend, sendEmail, simulateReply, threadState, useS, loadInitialData, syncMailbox } from "@/lib/store";
import { Badge, Empty, fmt, Page, Skeleton, strip, useReady } from "@/components/ui";

export default function Inbox() {
  const ready = useReady();
  const threads = useS((s) => s.threads);
  const contacts = useS((s) => s.contacts);
  const accounts = useS((s) => s.accounts);
  const [q, setQ] = useState("");
  const [f, setF] = useState("all");
  const [sel, setSel] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [syncing, setSyncing] = useState(false);

  const list = threads.filter(
    (t) =>
      (f === "all" || threadState(t) === f) &&
      (t.subject + t.messages.map((m) => m.body).join(" ")).toLowerCase().includes(q.toLowerCase())
  );
  const cur = threads.find((t) => t.id === sel);
  const contact = cur && contacts.find((c) => c.id === cur.contactId);

  const open = (id: string) => {
    setSel(id);
    markRead(id);
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    for (const acc of accounts) {
      if (acc.status === "connected") {
        await syncMailbox(acc.id);
      }
    }
    await loadInitialData();
    setSyncing(false);
  };

  const send = () => {
    if (cur && contact && reply.trim() && sendEmail(contact.email, cur.subject, `<p>${reply}</p>`, cur.id)) {
      setReply("");
    }
  };

  return (
    <Page
      title="Inbox"
      actions={
        <div className="flex gap-2">
          <button className="btn-ghost text-xs" onClick={handleSyncAll} disabled={syncing}>
            {syncing ? "Syncing..." : "Sync emails"}
          </button>
          <button className="btn-ghost text-xs text-slate-500" onClick={simulateReply}>
            Simulate reply
          </button>
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-[340px_1fr]">
        <div>
          <input
            className="input mb-2"
            placeholder="Search conversations…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="mb-2 flex gap-1">
            {["all", "replied", "waiting", "bounced"].map((x) => (
              <button
                key={x}
                onClick={() => setF(x)}
                className={`rounded-full px-3 py-1 text-xs capitalize ${
                  f === x ? "bg-indigo-600 text-white" : "bg-slate-200 dark:bg-slate-800"
                }`}
              >
                {x}
              </button>
            ))}
          </div>
          {!ready ? (
            <Skeleton n={4} />
          ) : list.length === 0 ? (
            <Empty
              title="No conversations"
              hint="Sent job applications and recruiter replies will appear here automatically."
            />
          ) : (
            <div className="space-y-1">
              {list.map((t) => {
                const c = contacts.find((x) => x.id === t.contactId);
                const last = t.messages[t.messages.length - 1];
                return (
                  <button
                    key={t.id}
                    onClick={() => open(t.id)}
                    className={`card w-full text-left transition-colors ${
                      sel === t.id ? "ring-2 ring-indigo-500" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-sm ${t.unread ? "font-bold text-indigo-600" : ""}`}>
                        {c?.name || "Recipient"}
                      </span>
                      <Badge v={threadState(t)} />
                    </div>
                    <div className="truncate text-sm font-medium">{t.subject}</div>
                    <div className="truncate text-xs text-slate-500">{last ? strip(last.body) : ""}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div>
          {!cur ? (
            <Empty title="Select a conversation" hint="Click any email thread on the left to read and reply." />
          ) : (
            <div className="card">
              <h2 className="font-semibold text-lg">{cur.subject}</h2>
              <p className="mb-3 text-xs text-slate-500">
                {contact?.name} &lt;{contact?.email}&gt; {contact?.company && `· ${contact.company}`}
              </p>
              <div className="space-y-3">
                {cur.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-md p-3 text-sm ${
                      m.dir === "out"
                        ? "bg-indigo-50 border border-indigo-100 dark:bg-indigo-950 dark:border-indigo-900"
                        : "bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:border-slate-700"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                      <span className="font-medium">{m.dir === "out" ? "You" : m.from}</span>
                      <span className="flex items-center gap-2">
                        {m.kind !== "normal" && <Badge v={m.kind === "bounce" ? "bounced" : "auto-reply"} />}
                        {m.delivery && <Badge v={m.delivery} />}
                        {fmt(m.at)}
                      </span>
                    </div>
                    <div className="prose max-w-none text-sm dark:prose-invert" dangerouslySetInnerHTML={{ __html: m.body }} />
                    {m.delivery === "failed" && (
                      <button className="btn-ghost mt-2 text-xs" onClick={() => retrySend(cur.id, m.id)}>
                        Retry sending
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <textarea
                className="input mt-3"
                rows={3}
                placeholder="Write a reply…"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
              />
              <button className="btn mt-2" onClick={send} disabled={!reply.trim()}>
                Send reply
              </button>
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}
