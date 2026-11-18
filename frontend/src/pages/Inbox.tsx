import { useEffect, useState } from "react";
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

  // Auto-select first thread on desktop if none selected
  useEffect(() => {
    if (!sel && list.length > 0 && window.innerWidth >= 768) {
      setSel(list[0].id);
    }
  }, [list.length]);

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
      <div className="flex flex-col md:grid md:grid-cols-[360px_1fr] gap-4 flex-1 min-h-0 h-full overflow-hidden">
        {/* Left Column: Thread List */}
        <div className={`flex flex-col min-h-0 h-full ${sel ? "hidden md:flex" : "flex"}`}>
          <div className="shrink-0 mb-2">
            <input
              className="input"
              placeholder="Search conversations…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="shrink-0 mb-2.5 flex gap-1 overflow-x-auto pb-1">
            {["all", "replied", "waiting", "bounced"].map((x) => (
              <button
                key={x}
                onClick={() => setF(x)}
                className={`rounded-full px-3 py-1 text-xs capitalize shrink-0 font-medium transition-colors ${
                  f === x
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                {x}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            {!ready ? (
              <Skeleton n={4} />
            ) : list.length === 0 ? (
              <Empty
                title="No conversations"
                hint="Sent job applications and recruiter replies will appear here automatically."
              />
            ) : (
              <div className="space-y-1.5 pb-2">
                {list.map((t) => {
                  const c = contacts.find((x) => x.id === t.contactId);
                  const last = t.messages[t.messages.length - 1];
                  const isSelected = sel === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => open(t.id)}
                      className={`card w-full text-left transition-all p-3 hover:border-slate-300 dark:hover:border-slate-700 ${
                        isSelected
                          ? "ring-2 ring-indigo-500 border-transparent shadow-sm bg-indigo-50/40 dark:bg-indigo-950/30"
                          : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-sm truncate ${t.unread ? "font-bold text-indigo-600 dark:text-indigo-400" : "font-medium"}`}>
                          {c?.name || "Recipient"}
                        </span>
                        <Badge v={threadState(t)} />
                      </div>
                      <div className="truncate text-sm font-medium mt-0.5">{t.subject}</div>
                      <div className="truncate text-xs text-slate-500 mt-1">{last ? strip(last.body) : ""}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Active Conversation */}
        <div className={`flex flex-col min-h-0 h-full ${!sel ? "hidden md:flex" : "flex"}`}>
          {!cur ? (
            <div className="card h-full flex flex-col items-center justify-center text-center p-8">
              <Empty title="Select a conversation" hint="Click any email thread on the left to read and reply." />
            </div>
          ) : (
            <div className="card h-full flex flex-col min-h-0 overflow-hidden p-4">
              {/* Header */}
              <div className="shrink-0 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 md:hidden mb-2">
                  <button
                    onClick={() => setSel(null)}
                    className="btn-ghost text-xs py-1 px-2"
                  >
                    ← Back to threads
                  </button>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold text-lg truncate leading-tight">{cur.subject}</h2>
                    <p className="mt-1 text-xs text-slate-500 truncate">
                      {contact?.name || "Recipient"} &lt;{contact?.email || cur.contactId}&gt; {contact?.company && `· ${contact.company}`}
                    </p>
                  </div>
                  <Badge v={threadState(cur)} />
                </div>
              </div>

              {/* Message scroll list */}
              <div className="flex-1 min-h-0 overflow-y-auto space-y-3 py-3 pr-2">
                {cur.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-lg p-3.5 text-sm ${
                      m.dir === "out"
                        ? "bg-indigo-50/80 border border-indigo-100/80 dark:bg-indigo-950/40 dark:border-indigo-900/50 ml-4"
                        : "bg-slate-100/80 border border-slate-200/80 dark:bg-slate-800/50 dark:border-slate-700/60 mr-4"
                    }`}
                  >
                    <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
                      <span className="font-semibold">{m.dir === "out" ? "You" : m.from}</span>
                      <span className="flex items-center gap-2">
                        {m.kind !== "normal" && <Badge v={m.kind === "bounce" ? "bounced" : "auto-reply"} />}
                        {m.delivery && <Badge v={m.delivery} />}
                        <span>{fmt(m.at)}</span>
                      </span>
                    </div>
                    <div
                      className="prose max-w-none text-sm dark:prose-invert break-words overflow-x-auto"
                      dangerouslySetInnerHTML={{ __html: m.body }}
                    />
                    {m.delivery === "failed" && (
                      <button className="btn-ghost mt-2 text-xs" onClick={() => retrySend(cur.id, m.id)}>
                        Retry sending
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Reply section: pinned at bottom */}
              <div className="shrink-0 pt-3 border-t border-slate-100 dark:border-slate-800">
                <textarea
                  className="input resize-none"
                  rows={3}
                  placeholder="Write a reply… (Ctrl+Enter to send)"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Ctrl+Enter to send</span>
                  <button
                    className="btn"
                    onClick={send}
                    disabled={!reply.trim()}
                  >
                    Send reply
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}
