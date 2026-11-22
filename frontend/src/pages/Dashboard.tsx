import { useNavigate } from "react-router-dom";
import {
  fill,
  set,
  threadState,
  useS,
} from "@/lib/store";
import { Badge, Empty, fmt, Page, Skeleton, useReady } from "@/components/ui";
import {
  Sparkles,
  MailCheck,
  Send,
  TrendingUp,
  Clock,
  CalendarCheck,
  ArrowRight,
  MessageSquare,
  Building2,
  PenSquare,
} from "lucide-react";

export default function Dashboard() {
  const ready = useReady();
  const nav = useNavigate();
  const threads = useS((s) => s.threads);
  const contacts = useS((s) => s.contacts);
  const tpl = useS((s) => s.templates);
  const profile = useS((s) => s.profile);
  const hrCounts = useS((s) => s.hrCounts);

  const out = threads.flatMap((t) => t.messages).filter((m) => m.dir === "out");
  const week = out.filter((m) => Date.now() - +new Date(m.at) < 7 * 864e5).length;
  const replied = threads.filter((t) => threadState(t) === "replied").length;
  const waiting = threads.filter((t) => threadState(t) === "waiting");
  const stale = waiting.filter(
    (t) => Date.now() - +new Date(t.messages[t.messages.length - 1].at) > 5 * 864e5
  );

  const stats = [
    {
      label: "Applications Sent",
      value: hrCounts.sent || out.length,
      icon: Send,
      color: "text-indigo-600 dark:text-indigo-400",
      bg: "bg-indigo-50 dark:bg-indigo-950/50 border-indigo-100 dark:border-indigo-900/50",
      hint: `${week} this week`,
    },
    {
      label: "Interviews & Offers",
      value: (hrCounts.interviews || 0) + contacts.filter((c) => c.status === "Interview" || c.status === "Offer").length,
      icon: CalendarCheck,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-50 dark:bg-purple-950/50 border-purple-100 dark:border-purple-900/50",
      hint: "Active hiring stages",
    },
    {
      label: "Reply Rate",
      value: threads.length ? `${Math.round((100 * replied) / threads.length)}%` : "0%",
      icon: TrendingUp,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-100 dark:border-emerald-900/50",
      hint: `${replied} responded`,
    },
    {
      label: "Awaiting Reply",
      value: waiting.length,
      icon: Clock,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/50 border-amber-100 dark:border-amber-900/50",
      hint: `${stale.length} need follow-up`,
    },
  ];

  const draft = (id: string) => {
    const t = threads.find((x) => x.id === id);
    const c = t ? contacts.find((x) => x.id === t.contactId) : undefined;
    if (!t || !c) return;

    const f = tpl.find((x) => x.name.toLowerCase().includes("follow-up")) || tpl[0];
    const sub = f ? f.subject : "Following up: {{role}} application";
    const body = f
      ? f.body
      : "<p>Hi {{hr_name}},</p><p>I wanted to follow up on my application for {{role}} at {{company}}.</p><p>Thanks,<br>{{my_name}}</p>";
    const v = {
      hr_name: c.name,
      company: c.company,
      role: t.subject.replace(/^.*?for /, ""),
      my_name: profile.name,
      skills: profile.skills.slice(0, 3).join(", "),
    };

    set(() => ({ draft: { to: c.email, subject: fill(sub, v), body: fill(body, v) } }));
    nav("/compose");
  };

  if (!ready) {
    return (
      <Page title="Dashboard">
        <Skeleton n={4} />
      </Page>
    );
  }

  const rec = contacts
    .filter((c) => c.lastRepliedAt)
    .sort((a, b) => +new Date(b.lastRepliedAt!) - +new Date(a.lastRepliedAt!));

  return (
    <Page
      title="Dashboard"
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => nav("/compose")}
            className="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1.5"
          >
            <PenSquare size={13} />
            <span>Compose</span>
          </button>
          <button
            onClick={() => nav("/apply-studio")}
            className="btn text-xs py-1.5 px-3.5 flex items-center gap-1.5"
          >
            <Sparkles size={13} />
            <span>Apply Studio</span>
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Quick Launch Banner */}
        <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900/60 bg-gradient-to-r from-indigo-50/90 via-purple-50/60 to-white dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-slate-900 p-4 md:p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 dark:bg-indigo-900/80 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
                <Sparkles size={12} />
                <span>AI Job Automation</span>
              </span>
              <span className="text-xs text-slate-500">Ready to dispatch</span>
            </div>
            <h2 className="text-base md:text-lg font-bold text-slate-900 dark:text-white">
              Upload a hiring poster or PDF to apply in 1-click
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Vision AI extracts HR email, matches your best role resume, and drafts a personalized email.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => nav("/hr-inbox")}
              className="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1.5"
            >
              <MailCheck size={14} className="text-indigo-600 dark:text-indigo-400" />
              <span>HR Inbox</span>
            </button>
            <button
              onClick={() => nav("/apply-studio")}
              className="btn text-xs py-1.5 px-4 flex items-center gap-1.5 shadow-xs"
            >
              <span>Launch Pipeline</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="card p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {s.label}
                  </span>
                  <div className={`p-1.5 rounded-full border ${s.bg}`}>
                    <Icon size={14} className={s.color} />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white">
                    {s.value}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                    {s.hint}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Two Columns: Recent Recruiter Activity & Follow-up Queue */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Who replied */}
          <div className="card p-4 flex flex-col min-h-[260px]">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5">
                <MessageSquare size={15} className="text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
                  Recent Recruiter Replies
                </h3>
              </div>
              <button
                onClick={() => nav("/hr-inbox")}
                className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
              >
                View all →
              </button>
            </div>

            {rec.length ? (
              <div className="space-y-1 overflow-y-auto flex-1">
                {rec.slice(0, 5).map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-xs"
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="font-semibold text-slate-900 dark:text-white truncate">
                        {c.name}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                        <Building2 size={11} className="text-slate-400" />
                        <span>{c.company || c.email}</span>
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0 font-medium">
                      {fmt(c.lastRepliedAt)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <Empty
                title="No replies yet"
                hint="When recruiters reply to your applications, they will appear here and in HR Inbox."
              />
            )}
          </div>

          {/* Suggested follow-ups */}
          <div className="card p-4 flex flex-col min-h-[260px]">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5">
                <Clock size={15} className="text-amber-500" />
                <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
                  Suggested Follow-ups
                </h3>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                No reply in 5+ days
              </span>
            </div>

            {stale.length ? (
              <div className="space-y-2 overflow-y-auto flex-1">
                {stale.slice(0, 4).map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-2 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-xs gap-2"
                  >
                    <div className="min-w-0 flex-1 truncate">
                      <div className="font-semibold text-slate-900 dark:text-white truncate">
                        {t.subject}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Awaiting reply
                      </div>
                    </div>
                    <button
                      className="btn-ghost text-[11px] py-1 px-3 shrink-0 font-semibold"
                      onClick={() => draft(t.id)}
                    >
                      Follow-up
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <Empty
                title="You're all caught up"
                hint="Follow-ups are suggested automatically when a recruiter hasn't replied in 5+ days."
              />
            )}

            <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <Badge v="waiting" />
                <span className="text-[11px] text-slate-500">
                  {waiting.length} application(s) awaiting response
                </span>
              </div>
              <button
                onClick={() => nav("/inbox")}
                className="text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                Go to Inbox →
              </button>
            </div>
          </div>
        </div>
      </div>
    </Page>
  );
}
