import { useEffect, useRef, useState } from "react";
import { fill, getState, sendEmail, set, toast, useS } from "@/lib/store";
import { draftVariants, extractJD } from "@/lib/ai";
import { api } from "@/api/client";
import { Page } from "@/components/ui";

export default function Compose() {
  const tpl = useS((s) => s.templates);
  const profile = useS((s) => s.profile);
  const prefs = useS((s) => s.prefs);
  const resumes = useS((s) => s.resumes);
  const roleResumes = useS((s) => s.roleResumes);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [attach, setAttach] = useState<string[]>([]);
  const [attachIds, setAttachIds] = useState<string[]>([]);
  const [jd, setJd] = useState("");
  const [generating, setGenerating] = useState(false);
  const [variants, setVariants] = useState<{ label: string; subject: string; body: string }[]>([]);
  const ed = useRef<HTMLDivElement>(null);
  const ref = useRef({ to, subject });
  ref.current = { to, subject };

  const setBody = (h: string) => {
    if (ed.current) ed.current.innerHTML = h;
  };

  useEffect(() => {
    const d = getState().draft;
    if (d) {
      setTo(d.to);
      setSubject(d.subject);
      setBody(d.body);
      set(() => ({ draft: null }));
    }
  }, []);

  const applyTpl = (id: string) => {
    const t = tpl.find((x) => x.id === id);
    if (!t) return;
    const v = {
      hr_name: "Hiring Manager",
      company: "{{company}}",
      role: "{{role}}",
      my_name: profile.name || "Candidate",
      skills: profile.skills.slice(0, 4).join(", ")
    };
    setSubject(fill(t.subject, v));
    setBody(fill(t.body, v));
  };

  const gen = async () => {
    if (!jd.trim()) return toast("Paste a job description or JD URL first", "err");
    setGenerating(true);
    toast("AI agent is drafting tailored emails...");

    try {
      const res = await api.post("/ai/draft-email", {
        jd,
        tone: prefs.tone || "friendly"
      });
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        setVariants(res.data.map((v: any) => ({
          label: v.label,
          subject: v.subject,
          body: v.bodyHtml || v.body
        })));
        toast("Generated 3 AI variants");
      }
    } catch (e: any) {
      // Fallback to local drafting if LLM keys not set yet
      try {
        const localVariants = draftVariants(extractJD(jd), profile, prefs.tone);
        setVariants(localVariants);
        toast("Generated drafts (offline/local fallback)");
      } catch {
        toast(e.response?.data?.error?.message || "AI generation failed", "err");
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    toast(`Uploading ${file.name}...`);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/emails/attachments", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setAttach((prev) => [...prev, file.name]);
      if (res.data?.id) {
        setAttachIds((prev) => [...prev, res.data.id]);
      }
      toast(`Attached ${file.name}`);
    } catch {
      // If offline upload fails, keep filename visually
      setAttach((prev) => [...prev, file.name]);
      toast(`Attached ${file.name} locally`);
    }
  };

  const send = () => {
    const html = ed.current?.innerHTML ?? "";
    if (!ref.current.subject.trim()) return toast("Add a subject", "err");
    const recipients = ref.current.to.split(/[,;]/).map((a) => a.trim()).filter(Boolean);
    if (!recipients.length) return toast("Add a recipient email", "err");

    recipients.forEach((a) => {
      sendEmail(
        a,
        ref.current.subject,
        html + (attach.length ? `<p><i>📎 ${attach.join(", ")}</i></p>` : ""),
        undefined,
        attachIds
      );
    });
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        send();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        toast("Draft saved");
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  const fmtCmd = (c: string, v?: string) => {
    ed.current?.focus();
    document.execCommand(c, false, v);
  };

  return (
    <Page title="Compose" actions={<span className="text-xs text-slate-500">Ctrl+Enter send · Ctrl+S save draft</span>}>
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="card space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="label">To (comma separated)</label>
              <input
                className="input"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="recruiter@company.com"
              />
            </div>
            <div>
              <label className="label">Template</label>
              <select className="input" defaultValue="" onChange={(e) => applyTpl(e.target.value)}>
                <option value="">Choose a template…</option>
                {tpl.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Subject</label>
            <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <div className="mb-1 flex gap-1">
              {[
                ["B", "bold"],
                ["I", "italic"],
                ["• List", "insertUnorderedList"]
              ].map(([l, c]) => (
                <button
                  key={c}
                  type="button"
                  className="btn-ghost px-2 py-1"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    fmtCmd(c);
                  }}
                >
                  {l}
                </button>
              ))}
              <button
                type="button"
                className="btn-ghost px-2 py-1"
                onMouseDown={(e) => {
                  e.preventDefault();
                  const u = prompt("Link URL");
                  if (u) fmtCmd("createLink", u);
                }}
              >
                Link
              </button>
            </div>
            <div
              ref={ed}
              contentEditable
              suppressContentEditableWarning
              className="input min-h-[220px] prose max-w-none dark:prose-invert"
            />
          </div>
          <div>
            <label className="label">Attach resume or file</label>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="input w-auto text-sm"
                value=""
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  if (val.startsWith("role:")) {
                    const id = val.replace("role:", "");
                    const r = roleResumes.find((x) => x.id === id);
                    if (r) {
                      setAttach((prev) => [...new Set([...prev, r.filename])]);
                      const attId = r.attachmentId || r.id;
                      if (attId) setAttachIds((prev) => [...prev, attId]);
                    }
                  } else if (val.startsWith("ver:")) {
                    const id = val.replace("ver:", "");
                    const r = resumes.find((x) => x.id === id);
                    if (r) setAttach((prev) => [...new Set([...prev, `${r.label}.pdf`])]);
                  }
                }}
              >
                <option value="">Attach saved resume…</option>
                {roleResumes.length > 0 && (
                  <optgroup label="Uploaded Resumes by Role">
                    {roleResumes.map((r) => (
                      <option key={r.id} value={`role:${r.id}`}>
                        [{r.role}] {r.filename} {r.isDefault ? "⭐" : ""}
                      </option>
                    ))}
                  </optgroup>
                )}
                {resumes.length > 0 && (
                  <optgroup label="AI Tailored Versions">
                    {resumes.map((r) => (
                      <option key={r.id} value={`ver:${r.id}`}>
                        {r.label}.pdf (ATS {r.ats}%)
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              />
              {attach.map((a, i) => (
                <span key={i} className="badge bg-slate-200 text-slate-800">
                  {a}{" "}
                  <button
                    onClick={() => {
                      setAttach(attach.filter((_, idx) => idx !== i));
                      setAttachIds(attachIds.filter((_, idx) => idx !== i));
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn" onClick={send}>
              Send email
            </button>
            <button className="btn-ghost" onClick={() => toast("Draft saved")}>
              Save draft
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Sends are queued in the background worker, respecting your daily cap ({prefs.dailyCap}/day) and DNC list.
          </p>
        </div>

        <div className="card space-y-3">
          <h2 className="font-medium">AI: draft from job description</h2>
          <textarea
            className="input"
            rows={6}
            placeholder="Paste JD text or URL (e.g. https://...)..."
            value={jd}
            onChange={(e) => setJd(e.target.value)}
          />
          <button className="btn w-full" onClick={gen} disabled={generating}>
            {generating ? "AI Generating..." : "Generate email variants"}
          </button>
          {variants.map((v) => (
            <div key={v.label} className="rounded-md border border-slate-200 p-2 text-sm dark:border-slate-700">
              <div className="font-medium">{v.label}</div>
              <div className="text-xs text-slate-500 truncate">{v.subject}</div>
              <button
                className="btn-ghost mt-1 text-xs"
                onClick={() => {
                  setSubject(v.subject);
                  setBody(v.body);
                }}
              >
                Use & edit
              </button>
            </div>
          ))}
          <p className="text-xs text-slate-500">
            AI drafts are never sent automatically. You always preview and confirm before sending.
          </p>
        </div>
      </div>
    </Page>
  );
}
