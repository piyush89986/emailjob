import { useEffect, useRef, useState } from "react";
import { fill, getState, sendEmail, set, toast, useS } from "@/lib/store";
import { draftVariants, extractJD } from "@/lib/ai";
import { Page } from "@/components/ui";

export default function Compose() {
  const tpl = useS((s) => s.templates); const profile = useS((s) => s.profile); const prefs = useS((s) => s.prefs); const resumes = useS((s) => s.resumes);
  const [to, setTo] = useState(""); const [subject, setSubject] = useState(""); const [attach, setAttach] = useState<string[]>([]);
  const [jd, setJd] = useState(""); const [variants, setVariants] = useState<ReturnType<typeof draftVariants>>([]);
  const ed = useRef<HTMLDivElement>(null); const ref = useRef({ to, subject });
  ref.current = { to, subject };
  const setBody = (h: string) => { if (ed.current) ed.current.innerHTML = h; };
  useEffect(() => { const d = getState().draft; if (d) { setTo(d.to); setSubject(d.subject); setBody(d.body); set(() => ({ draft: null })); } }, []);
  const applyTpl = (id: string) => {
    const t = tpl.find((x) => x.id === id); if (!t) return;
    const v = { hr_name: "Hiring Manager", company: "{{company}}", role: "{{role}}", my_name: profile.name, skills: profile.skills.slice(0, 4).join(", ") };
    setSubject(fill(t.subject, v)); setBody(fill(t.body, v));
  };
  const gen = () => { if (!jd.trim()) return toast("Paste a job description first", "err"); setVariants(draftVariants(extractJD(jd), profile, prefs.tone)); };
  const send = () => { const html = ed.current?.innerHTML ?? ""; if (!ref.current.subject.trim()) return toast("Add a subject", "err"); ref.current.to.split(/[,;]/).forEach((a) => a.trim() && sendEmail(a, ref.current.subject, html + (attach.length ? `<p><i>📎 ${attach.join(", ")}</i></p>` : ""))); };
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); send(); } if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); toast("Draft saved"); } };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  });
  const fmtCmd = (c: string, v?: string) => { ed.current?.focus(); document.execCommand(c, false, v); };
  return (
    <Page title="Compose" actions={<span className="text-xs text-slate-500">Ctrl+Enter send · Ctrl+S save draft</span>}>
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="card space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div><label className="label">To (comma separated)</label><input className="input" value={to} onChange={(e) => setTo(e.target.value)} placeholder="hr@company.com" /></div>
            <div><label className="label">Template</label><select className="input" defaultValue="" onChange={(e) => applyTpl(e.target.value)}><option value="">Choose a template…</option>{tpl.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
          </div>
          <div><label className="label">Subject</label><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
          <div>
            <div className="mb-1 flex gap-1">{[["B", "bold"], ["I", "italic"], ["• List", "insertUnorderedList"]].map(([l, c]) => <button key={c} type="button" className="btn-ghost px-2 py-1" onMouseDown={(e) => { e.preventDefault(); fmtCmd(c); }}>{l}</button>)}
              <button type="button" className="btn-ghost px-2 py-1" onMouseDown={(e) => { e.preventDefault(); const u = prompt("Link URL"); if (u) fmtCmd("createLink", u); }}>Link</button></div>
            <div ref={ed} contentEditable suppressContentEditableWarning className="input min-h-[220px] prose max-w-none dark:prose-invert" />
          </div>
          <div><label className="label">Attach resume</label>
            <div className="flex flex-wrap items-center gap-2">
              <select className="input w-auto" onChange={(e) => e.target.value && setAttach([...new Set([...attach, e.target.value])])}><option value="">Resume versions…</option>{resumes.map((r) => <option key={r.id}>{r.label}.pdf</option>)}</select>
              <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => e.target.files?.[0] && setAttach([...attach, e.target.files[0].name])} />
              {attach.map((a) => <span key={a} className="badge bg-slate-200 text-slate-800">{a} <button onClick={() => setAttach(attach.filter((x) => x !== a))}>×</button></span>)}</div></div>
          <div className="flex gap-2"><button className="btn" onClick={send}>Send</button><button className="btn-ghost" onClick={() => toast("Draft saved")}>Save draft</button></div>
          <p className="text-xs text-slate-500">Sends are queued, respect your daily cap ({prefs.dailyCap}/day) and the do-not-contact list.</p>
        </div>
        <div className="card space-y-3"><h2 className="font-medium">AI: draft from job description</h2>
          <textarea className="input" rows={6} placeholder="Paste JD text or URL…" value={jd} onChange={(e) => setJd(e.target.value)} />
          <button className="btn" onClick={gen}>Generate variants</button>
          {variants.map((v) => <div key={v.label} className="rounded-md border border-slate-200 p-2 text-sm dark:border-slate-700"><div className="font-medium">{v.label}</div><div className="text-xs text-slate-500">{v.subject}</div>
            <button className="btn-ghost mt-1" onClick={() => { setSubject(v.subject); setBody(v.body); }}>Use & edit</button></div>)}
          <p className="text-xs text-slate-500">AI drafts are never sent automatically. You review and send.</p></div>
      </div>
    </Page>
  );
}
