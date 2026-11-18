import { useState } from "react";
import { saveTemplate, cloneTemplate, deleteTemplate, useS, Template } from "@/lib/store";
import { Empty, Page, strip } from "@/components/ui";

export default function Templates() {
  const tpl = useS((s) => s.templates);
  const [edit, setEdit] = useState<{ id?: string; name: string; subject: string; body: string; global?: boolean } | null>(null);

  const save = async () => {
    if (!edit || !edit.name.trim()) return;
    await saveTemplate(edit);
    setEdit(null);
  };

  const handleClone = async (t: Template) => {
    await cloneTemplate(t.id);
  };

  const handleDelete = async (id: string) => {
    await deleteTemplate(id);
  };

  return (
    <Page
      title="Templates"
      actions={
        <button
          className="btn"
          onClick={() => setEdit({ name: "", subject: "", body: "", global: false })}
        >
          New template
        </button>
      }
    >
      {edit && (
        <div className="card mb-4 space-y-2">
          <div>
            <label className="label">Template Name *</label>
            <input
              className="input"
              value={edit.name}
              onChange={(e) => setEdit({ ...edit, name: e.target.value })}
              placeholder="e.g. Follow-up after 5 days"
            />
          </div>
          <div>
            <label className="label">Subject Line *</label>
            <input
              className="input"
              value={edit.subject}
              onChange={(e) => setEdit({ ...edit, subject: e.target.value })}
              placeholder="Application for {{role}} – {{my_name}}"
            />
          </div>
          <div>
            <label className="label">Body (HTML allowed)</label>
            <textarea
              className="input font-mono"
              rows={7}
              value={edit.body}
              onChange={(e) => setEdit({ ...edit, body: e.target.value })}
              placeholder="<p>Dear {{hr_name}},</p><p>I am applying for {{role}} at {{company}}...</p>"
            />
          </div>
          <p className="text-xs text-slate-500">
            Dynamic Variables: <code>{"{{hr_name}} {{company}} {{role}} {{my_name}} {{skills}}"}</code>
          </p>
          <div className="flex gap-2">
            <button className="btn" onClick={save} disabled={!edit.name}>
              Save template
            </button>
            <button className="btn-ghost" onClick={() => setEdit(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {tpl.length === 0 ? (
        <Empty title="No templates" hint="Create templates or clone defaults to use when composing emails." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {tpl.map((t) => (
            <div key={t.id} className="card flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">{t.name}</h3>
                  <span className="badge bg-slate-200 text-slate-700">
                    {t.global ? "Default" : "Custom"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500 font-mono truncate">{t.subject}</p>
                <p className="mt-2 line-clamp-3 text-sm text-slate-700 dark:text-slate-300">
                  {strip(t.body)}
                </p>
              </div>
              <div className="mt-3 flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                {t.global ? (
                  <button className="btn-ghost text-xs" onClick={() => handleClone(t)}>
                    Clone & customize
                  </button>
                ) : (
                  <>
                    <button className="btn-ghost text-xs" onClick={() => setEdit(t)}>
                      Edit
                    </button>
                    <button
                      className="btn-ghost text-xs text-red-600"
                      onClick={() => handleDelete(t.id)}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Page>
  );
}
