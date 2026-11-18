import { useState } from "react";
import { createApplication, setApplicationStatus, useS, STATUSES, App, toast } from "@/lib/store";
import { Badge, Empty, fmt, Page } from "@/components/ui";

export default function Applications() {
  const apps = useS((s) => s.apps);
  const contacts = useS((s) => s.contacts);
  const resumes = useS((s) => s.resumes);
  const [open, setOpen] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [f, setF] = useState({ title: "", company: "", jdUrl: "", jd: "", contactId: "", resume: "" });

  const add = async () => {
    if (!f.title || !f.company) return toast("Title and company required", "err");
    await createApplication({
      title: f.title,
      company: f.company,
      jdUrl: f.jdUrl,
      jd: f.jd,
      contactId: f.contactId || undefined,
      resume: f.resume || undefined
    });
    setShow(false);
    setF({ title: "", company: "", jdUrl: "", jd: "", contactId: "", resume: "" });
  };

  const status = (id: string, st: App["status"]) => {
    setApplicationStatus(id, st);
  };

  return (
    <Page
      title="Applications"
      actions={
        <button className="btn" onClick={() => setShow(!show)}>
          {show ? "Cancel" : "New application"}
        </button>
      }
    >
      {show && (
        <div className="card mb-4 grid gap-2 md:grid-cols-2">
          <input
            className="input"
            placeholder="Job title *"
            value={f.title}
            onChange={(e) => setF({ ...f, title: e.target.value })}
          />
          <input
            className="input"
            placeholder="Company *"
            value={f.company}
            onChange={(e) => setF({ ...f, company: e.target.value })}
          />
          <input
            className="input"
            placeholder="JD URL"
            value={f.jdUrl}
            onChange={(e) => setF({ ...f, jdUrl: e.target.value })}
          />
          <select className="input" value={f.contactId} onChange={(e) => setF({ ...f, contactId: e.target.value })}>
            <option value="">Linked contact…</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.email})
              </option>
            ))}
          </select>
          <select className="input" value={f.resume} onChange={(e) => setF({ ...f, resume: e.target.value })}>
            <option value="">Resume version…</option>
            {resumes.map((r) => (
              <option key={r.id} value={r.label}>
                {r.label} (ATS {r.ats}%)
              </option>
            ))}
          </select>
          <textarea
            className="input md:col-span-2"
            rows={4}
            placeholder="Job description / notes…"
            value={f.jd}
            onChange={(e) => setF({ ...f, jd: e.target.value })}
          />
          <button className="btn md:col-span-2" onClick={add}>
            Save application
          </button>
        </div>
      )}

      {apps.length === 0 ? (
        <Empty title="No applications yet" hint="Track each role you apply to and monitor response timeline." />
      ) : (
        <div className="space-y-2">
          {apps.map((a) => (
            <div key={a.id} className="card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button className="text-left" onClick={() => setOpen(open === a.id ? null : a.id)}>
                  <div className="font-medium">
                    {a.title} · {a.company}
                  </div>
                  <div className="text-xs text-slate-500">
                    {contacts.find((c) => c.id === a.contactId)?.name ?? "No contact linked"} · Resume{" "}
                    {a.resume || "—"}
                  </div>
                </button>
                <div className="flex items-center gap-2">
                  <Badge v={a.status} />
                  <select
                    className="input w-auto py-1 text-xs"
                    value={a.status}
                    onChange={(e) => status(a.id, e.target.value as App["status"])}
                  >
                    {["Saved", "Applied", ...STATUSES].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
              {open === a.id && (
                <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                  {a.jd && (
                    <div className="mb-2 text-xs text-slate-600 dark:text-slate-400 max-h-32 overflow-y-auto whitespace-pre-wrap">
                      <b>Job Description:</b> {a.jd}
                    </div>
                  )}
                  <div className="text-xs font-medium mb-1">Timeline:</div>
                  <ol className="space-y-1 border-l-2 border-indigo-300 pl-3 text-sm">
                    {a.timeline.map((t, i) => (
                      <li key={i}>
                        {t.label} <span className="text-xs text-slate-500">{fmt(t.at)}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Page>
  );
}
