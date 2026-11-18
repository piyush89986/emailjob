import { useState } from "react";
import { set, toast, uid, useS, Template } from "@/lib/store";
import { Empty, Page, strip } from "@/components/ui";

export default function Templates() {
  const tpl = useS((s) => s.templates); const [edit, setEdit] = useState<Template | null>(null);
  const save = () => { if (!edit) return; set((s) => ({ templates: s.templates.some((t) => t.id === edit.id) ? s.templates.map((t) => (t.id === edit.id ? edit : t)) : [...s.templates, edit] })); setEdit(null); toast("Template saved"); };
  const clone = (t: Template) => { setEdit({ ...t, id: uid(), name: `${t.name} (copy)`, global: false }); };
  return (
    <Page title="Templates" actions={<button className="btn" onClick={() => setEdit({ id: uid(), name: "", subject: "", body: "", global: false })}>New template</button>}>
      {edit && <div className="card mb-4 space-y-2">
        <div><label className="label">Name</label><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
        <div><label className="label">Subject</label><input className="input" value={edit.subject} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} /></div>
        <div><label className="label">Body (HTML)</label><textarea className="input font-mono" rows={7} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} /></div>
        <p className="text-xs text-slate-500">Variables: {"{{hr_name}} {{company}} {{role}} {{my_name}} {{skills}}"}</p>
        <div className="flex gap-2"><button className="btn" onClick={save} disabled={!edit.name}>Save</button><button className="btn-ghost" onClick={() => setEdit(null)}>Cancel</button></div></div>}
      {tpl.length === 0 ? <Empty title="No templates" /> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{tpl.map((t) => (
        <div key={t.id} className="card"><div className="flex items-center justify-between"><h3 className="font-medium">{t.name}</h3><span className="badge bg-slate-200 text-slate-700">{t.global ? "Default" : "Yours"}</span></div>
          <p className="mt-1 text-sm text-slate-500">{t.subject}</p><p className="mt-2 line-clamp-3 text-sm">{strip(t.body)}</p>
          <div className="mt-3 flex gap-2">{t.global ? <button className="btn-ghost" onClick={() => clone(t)}>Clone & edit</button> : <><button className="btn-ghost" onClick={() => setEdit(t)}>Edit</button><button className="btn-ghost" onClick={() => set((s) => ({ templates: s.templates.filter((x) => x.id !== t.id) }))}>Delete</button></>}</div></div>))}</div>}
    </Page>
  );
}
