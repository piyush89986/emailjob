import { useState } from "react";
import {
  createApplication,
  setApplicationStatus,
  useS,
  STATUSES,
  App,
  toast,
} from "@/lib/store";
import { Badge, Empty, fmt, Page } from "@/components/ui";
import {
  Plus,
  Building2,
  Calendar,
  FileText,
  ChevronDown,
  ChevronUp,
  X,
  ExternalLink,
  Mail,
  MessageSquare,
} from "lucide-react";

export default function Applications() {
  const apps = useS((s) => s.apps);
  const contacts = useS((s) => s.contacts);
  const resumes = useS((s) => s.resumes);
  const roleResumes = useS((s) => s.roleResumes);
  const [open, setOpen] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [f, setF] = useState({
    title: "",
    company: "",
    jdUrl: "",
    jd: "",
    contactId: "",
    resume: "",
  });

  const add = async () => {
    if (!f.title.trim() || !f.company.trim()) {
      return toast("Title and company are required", "err");
    }
    await createApplication({
      title: f.title.trim(),
      company: f.company.trim(),
      jdUrl: f.jdUrl.trim(),
      jd: f.jd.trim(),
      contactId: f.contactId || undefined,
      resume: f.resume || undefined,
    });
    setShow(false);
    setF({ title: "", company: "", jdUrl: "", jd: "", contactId: "", resume: "" });
    toast("Application added to tracker!");
  };

  const status = (id: string, st: App["status"]) => {
    setApplicationStatus(id, st);
  };

  return (
    <Page
      title="Application Tracker"
      actions={
        <button
          className={`text-xs py-1.5 px-3.5 flex items-center gap-1.5 shadow-xs font-semibold ${
            show ? "btn-ghost" : "btn"
          }`}
          onClick={() => setShow(!show)}
        >
          {show ? (
            <>
              <X size={14} />
              <span>Cancel</span>
            </>
          ) : (
            <>
              <Plus size={14} />
              <span>New application</span>
            </>
          )}
        </button>
      }
    >
      {/* Create Application Form Drawer / Card */}
      {show && (
        <div className="card mb-4 p-4 md:p-5 border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-b from-indigo-50/30 to-white dark:from-indigo-950/20 dark:to-slate-900 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
              Log a Job Application
            </h3>
            <span className="text-[11px] text-slate-400">
              Track interviews, follow-ups & outcomes
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="label">Job Title *</label>
              <input
                className="input"
                placeholder="e.g. Senior Frontend Engineer"
                value={f.title}
                onChange={(e) => setF({ ...f, title: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Company Name *</label>
              <input
                className="input"
                placeholder="e.g. Stripe, Google, Linear"
                value={f.company}
                onChange={(e) => setF({ ...f, company: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Job Posting / JD URL</label>
              <input
                className="input"
                placeholder="https://..."
                value={f.jdUrl}
                onChange={(e) => setF({ ...f, jdUrl: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Linked Contact / Recruiter</label>
              <select
                className="input"
                value={f.contactId}
                onChange={(e) => setF({ ...f, contactId: e.target.value })}
              >
                <option value="">Select a contact…</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.email}) {c.company ? `· ${c.company}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label">Used Resume Version</label>
              <select
                className="input"
                value={f.resume}
                onChange={(e) => setF({ ...f, resume: e.target.value })}
              >
                <option value="">Select resume used…</option>
                {roleResumes.length > 0 && (
                  <optgroup label="Uploaded Role Resumes">
                    {roleResumes.map((r) => (
                      <option key={r.id} value={r.role}>
                        {r.role} ({r.filename}) {r.isDefault ? "★ Default" : ""}
                      </option>
                    ))}
                  </optgroup>
                )}
                {resumes.length > 0 && (
                  <optgroup label="AI Tailored Versions">
                    {resumes.map((r) => (
                      <option key={r.id} value={r.label}>
                        {r.label} (ATS {r.ats}%)
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label">Job Description / Requirements / Notes</label>
              <textarea
                className="input font-mono"
                rows={4}
                placeholder="Paste key responsibilities or interview notes…"
                value={f.jd}
                onChange={(e) => setF({ ...f, jd: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              className="btn-ghost text-xs py-1.5 px-3.5"
              onClick={() => setShow(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn text-xs py-1.5 px-4 font-semibold shadow-xs"
              onClick={add}
            >
              Save Application
            </button>
          </div>
        </div>
      )}

      {/* Applications List */}
      {apps.length === 0 ? (
        <Empty
          title="No applications tracked yet"
          hint="Track each role you apply to, monitor response timelines, and record interview stages."
        />
      ) : (
        <div className="space-y-2">
          {apps.map((a) => {
            const isExpanded = open === a.id;
            const contact = contacts.find((c) => c.id === a.contactId);

            return (
              <div
                key={a.id}
                className="card p-3.5 hover:border-slate-300 dark:hover:border-slate-700 transition-all"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    className="text-left flex-1 min-w-[200px] cursor-pointer"
                    onClick={() => setOpen(isExpanded ? null : a.id)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-900 dark:text-white">
                        {a.title}
                      </span>
                      <span className="text-slate-400 font-medium">·</span>
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1">
                        <Building2 size={12} className="text-slate-400" />
                        <span>{a.company}</span>
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      {contact && <span>Contact: {contact.name}</span>}
                      {a.resume && <span>Resume: {a.resume}</span>}
                      {((a as any).created_at || (a as any).createdAt) && (
                        <span>Logged: {fmt((a as any).created_at || (a as any).createdAt)}</span>
                      )}
                    </div>
                  </button>

                  <div className="flex items-center gap-2 shrink-0">
                    <Badge v={a.status} />

                    <select
                      className="input w-auto py-1 px-2.5 text-[11px] rounded-full font-semibold"
                      value={a.status}
                      onChange={(e) => status(a.id, e.target.value as App["status"])}
                    >
                      {["Saved", "Applied", ...STATUSES].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => setOpen(isExpanded ? null : a.id)}
                      className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
                      title={isExpanded ? "Collapse" : "Expand"}
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800 space-y-3 text-xs">
                    {a.jdUrl && (
                      <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                        <ExternalLink size={12} />
                        <a
                          href={a.jdUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline font-medium"
                        >
                          View Job Description Link
                        </a>
                      </div>
                    )}

                    {a.jd && (
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-900/60 p-3 border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 max-h-36 overflow-y-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
                        {a.jd}
                      </div>
                    )}

                    {/* Linked Communications from Same Recruiter or Company */}
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <MessageSquare size={13} className="text-emerald-500" />
                          Linked Communications ({a.hrEmail || a.company})
                        </span>
                        {a.recruiterReplies && a.recruiterReplies.length > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold">
                            {a.recruiterReplies.length} message{a.recruiterReplies.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>

                      {a.recruiterReplies && a.recruiterReplies.length > 0 ? (
                        <div className="space-y-2">
                          {a.recruiterReplies.map((reply, rIdx) => (
                            <div
                              key={rIdx}
                              className="rounded-xl border border-emerald-200/70 bg-emerald-50/30 p-2.5 dark:border-emerald-900/50 dark:bg-emerald-950/20"
                            >
                              <div className="flex items-center justify-between gap-2 text-xs">
                                <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">
                                  <Mail size={12} className="text-emerald-600 dark:text-emerald-400" />
                                  {reply.sender_name || reply.from}
                                </span>
                                <span className="text-[11px] text-slate-400 font-mono">
                                  {fmt(reply.received_at || reply.at || "")}
                                </span>
                              </div>
                              <p className="font-medium text-xs text-slate-800 dark:text-slate-200 mt-0.5">
                                {reply.subject}
                              </p>
                              {reply.body_snippet && (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                                  {reply.body_snippet}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-2.5 text-center text-[11px] text-slate-400">
                          No replies received yet. Actively monitoring incoming emails from {a.hrEmail || a.company}.
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                        Activity Timeline
                      </div>
                      <ol className="space-y-1.5 border-l-2 border-indigo-200 dark:border-indigo-900/80 pl-3">
                        {a.timeline?.map((t, i) => (
                          <li key={i} className="flex items-center justify-between text-xs">
                            <span className="font-medium text-slate-800 dark:text-slate-200">
                              {t.label}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {fmt(t.at)}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Page>
  );
}
