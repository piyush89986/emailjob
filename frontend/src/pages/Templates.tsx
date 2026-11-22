import { useState } from "react";
import {
  saveTemplate,
  cloneTemplate,
  deleteTemplate,
  useS,
  Template,
  toast,
} from "@/lib/store";
import { Empty, Page, strip } from "@/components/ui";
import { Plus, Copy, Edit3, Trash2, X, Sparkles, FileText } from "lucide-react";

export default function Templates() {
  const tpl = useS((s) => s.templates);
  const [edit, setEdit] = useState<{
    id?: string;
    name: string;
    subject: string;
    body: string;
    global?: boolean;
  } | null>(null);

  const save = async () => {
    if (!edit || !edit.name.trim()) return toast("Template name is required", "err");
    await saveTemplate(edit);
    setEdit(null);
    toast("Template saved successfully!");
  };

  const handleClone = async (t: Template) => {
    await cloneTemplate(t.id);
    toast(`Cloned "${t.name}" as custom template`);
  };

  const handleDelete = async (id: string) => {
    await deleteTemplate(id);
    toast("Template removed");
  };

  return (
    <Page
      title="Email Templates"
      actions={
        <button
          className={`text-xs py-1.5 px-3.5 flex items-center gap-1.5 shadow-xs font-semibold ${
            edit ? "btn-ghost" : "btn"
          }`}
          onClick={() =>
            setEdit(edit ? null : { name: "", subject: "", body: "", global: false })
          }
        >
          {edit ? (
            <>
              <X size={14} />
              <span>Cancel</span>
            </>
          ) : (
            <>
              <Plus size={14} />
              <span>New template</span>
            </>
          )}
        </button>
      }
    >
      {/* Template Editor Drawer / Card */}
      {edit && (
        <div className="card mb-4 p-4 md:p-5 border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-b from-indigo-50/20 to-white dark:from-indigo-950/20 dark:to-slate-900 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
              <FileText size={15} className="text-indigo-600 dark:text-indigo-400" />
              <span>{edit.id ? "Edit Template" : "Create New Email Template"}</span>
            </h3>
            <span className="text-[11px] text-slate-400">
              HTML formatting supported
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="label">Template Name *</label>
              <input
                className="input"
                value={edit.name}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                placeholder="e.g. Full Stack Developer Cold Email"
              />
            </div>

            <div>
              <label className="label">Subject Line *</label>
              <input
                className="input font-mono"
                value={edit.subject}
                onChange={(e) => setEdit({ ...edit, subject: e.target.value })}
                placeholder="Application for {{role}} – {{my_name}}"
              />
            </div>

            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="label mb-0">Email Body (HTML)</label>
                <span className="text-[11px] text-slate-400">
                  Variables: <code>{"{{hr_name}} {{company}} {{role}} {{my_name}}"}</code>
                </span>
              </div>
              <textarea
                className="input font-mono text-xs leading-relaxed"
                rows={7}
                value={edit.body}
                onChange={(e) => setEdit({ ...edit, body: e.target.value })}
                placeholder="<p>Dear {{hr_name}},</p><p>I am applying for {{role}} at {{company}}...</p>"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              className="btn-ghost text-xs py-1.5 px-3.5"
              onClick={() => setEdit(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn text-xs py-1.5 px-4 font-semibold shadow-xs"
              onClick={save}
              disabled={!edit.name.trim()}
            >
              Save Template
            </button>
          </div>
        </div>
      )}

      {/* Templates Grid */}
      {tpl.length === 0 ? (
        <Empty
          title="No email templates found"
          hint="Create reusable email templates for roles (e.g. MERN Stack, Python, DevOps) to auto-match during applications."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {tpl.map((t) => (
            <div
              key={t.id}
              className="card p-4 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                    {t.name}
                  </h3>
                  <span
                    className={`badge text-[10px] uppercase font-bold shrink-0 ${
                      t.global
                        ? "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                        : "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/70 dark:text-indigo-300 dark:border-indigo-800"
                    }`}
                  >
                    {t.global ? "System" : "Custom"}
                  </span>
                </div>

                <p className="mt-1.5 text-xs text-slate-500 font-mono truncate bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded-lg border border-slate-100 dark:border-slate-800">
                  {t.subject}
                </p>

                <p className="mt-2.5 line-clamp-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {strip(t.body)}
                </p>
              </div>

              <div className="mt-3.5 flex items-center justify-end gap-1.5 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                {t.global ? (
                  <button
                    className="btn-ghost text-[11px] py-1 px-3 flex items-center gap-1 font-semibold"
                    onClick={() => handleClone(t)}
                  >
                    <Copy size={12} />
                    <span>Clone & customize</span>
                  </button>
                ) : (
                  <>
                    <button
                      className="btn-ghost text-[11px] py-1 px-3 flex items-center gap-1 font-semibold"
                      onClick={() => setEdit(t)}
                    >
                      <Edit3 size={12} />
                      <span>Edit</span>
                    </button>
                    <button
                      className="btn-danger text-[11px] py-1 px-2.5 flex items-center gap-1 font-semibold"
                      onClick={() => handleDelete(t.id)}
                    >
                      <Trash2 size={12} />
                      <span>Delete</span>
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
