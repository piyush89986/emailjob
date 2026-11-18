import { useNavigate } from "react-router-dom";
import { fill, set, threadState, useS } from "@/lib/store";
import { Badge, Empty, fmt, Page, Skeleton, useReady } from "@/components/ui";

export default function Dashboard() {
  const ready = useReady(); const nav = useNavigate();
  const threads = useS((s) => s.threads); const contacts = useS((s) => s.contacts); const tpl = useS((s) => s.templates); const profile = useS((s) => s.profile);
  const out = threads.flatMap((t) => t.messages).filter((m) => m.dir === "out");
  const week = out.filter((m) => Date.now() - +new Date(m.at) < 7 * 864e5).length;
  const replied = threads.filter((t) => threadState(t) === "replied").length;
  const waiting = threads.filter((t) => threadState(t) === "waiting");
  const stale = waiting.filter((t) => Date.now() - +new Date(t.messages[t.messages.length - 1].at) > 5 * 864e5);
  const stats = [["Sent this week", week], ["Reply rate", threads.length ? `${Math.round((100 * replied) / threads.length)}%` : "0%"], ["Awaiting reply", waiting.length], ["Interviews", contacts.filter((c) => c.status === "Interview").length]];
  const draft = (id: string) => {
    const t = threads.find((x) => x.id === id)!, c = contacts.find((x) => x.id === t.contactId)!;
    const f = tpl.find((x) => x.id === "t4")!;
    const v = { hr_name: c.name, company: c.company, role: t.subject.replace(/^.*?for /, ""), my_name: profile.name, skills: profile.skills.slice(0, 3).join(", ") };
    set(() => ({ draft: { to: c.email, subject: fill(f.subject, v), body: fill(f.body, v) } })); nav("/compose");
  };
  if (!ready) return <Page title="Dashboard"><Skeleton n={4} /></Page>;
  const rec = contacts.filter((c) => c.lastRepliedAt).sort((a, b) => +new Date(b.lastRepliedAt!) - +new Date(a.lastRepliedAt!));
  return (
    <Page title="Dashboard">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{stats.map(([l, v]) => <div key={l} className="card"><div className="text-sm text-slate-500">{l}</div><div className="text-2xl font-semibold">{v}</div></div>)}</div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="card"><h2 className="mb-2 font-medium">Who replied</h2>
          {rec.length ? rec.map((c) => <div key={c.id} className="flex items-center justify-between border-b border-slate-100 py-2 text-sm last:border-0 dark:border-slate-800"><span>{c.name} · {c.company}</span><span className="text-slate-500">{fmt(c.lastRepliedAt)}</span></div>) : <Empty title="No replies yet" />}</div>
        <div className="card"><h2 className="mb-2 font-medium">Suggested follow-ups <span className="text-xs text-slate-500">(no reply in 5+ days)</span></h2>
          {stale.length ? stale.map((t) => <div key={t.id} className="flex items-center justify-between py-2 text-sm"><span>{t.subject}</span><button className="btn-ghost" onClick={() => draft(t.id)}>Draft follow-up</button></div>) : <Empty title="You're all caught up" hint="Follow-ups are always reviewed by you before sending." />}
          <div className="mt-2"><Badge v="waiting" /> <span className="text-xs text-slate-500">{waiting.length} thread(s) waiting</span></div></div>
      </div>
    </Page>
  );
}
