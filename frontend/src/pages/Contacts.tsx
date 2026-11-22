import { useState } from "react";
import {
  setContactStatus,
  createContact,
  deleteContact,
  useS,
  STATUSES,
  Status,
  toast,
} from "@/lib/store";
import { Badge, Empty, fmt, Page, Skeleton, Tabs, useReady } from "@/components/ui";
import { UserPlus, Building2, Mail, Trash2, CheckCircle2 } from "lucide-react";

function StatusSelect({ id, v }: { id: string; v: Status }) {
  return (
    <select
      className="input w-auto py-1 px-2.5 text-[11px] rounded-full font-semibold border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
      value={v}
      onChange={(e) => setContactStatus(id, e.target.value as Status)}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

export default function Contacts() {
  const ready = useReady();
  const contacts = useS((s) => s.contacts);
  const [tab, setTab] = useState("Table");
  const [f, setF] = useState({ name: "", email: "", company: "" });

  const add = async () => {
    if (!f.email.trim()) return toast("Email address is required", "err");
    await createContact({
      name: f.name.trim() || f.email.split("@")[0],
      email: f.email.trim(),
      company: f.company.trim() || f.email.split("@")[1] || "",
      status: "Contacted",
    });
    setF({ name: "", email: "", company: "" });
    toast("Contact saved!");
  };

  return (
    <Page title="Recruiter Contacts">
      {/* Quick Add Contact Bar */}
      <div className="card mb-4 p-3 md:p-4 flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
        <input
          className="input flex-1"
          placeholder="Contact Name (e.g. Sarah Jenkins)"
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
        />
        <input
          className="input flex-1"
          placeholder="Recruiter Email *"
          type="email"
          value={f.email}
          onChange={(e) => setF({ ...f, email: e.target.value })}
        />
        <input
          className="input flex-1"
          placeholder="Company (e.g. Google)"
          value={f.company}
          onChange={(e) => setF({ ...f, company: e.target.value })}
        />
        <button
          className="btn text-xs py-2 px-4 shrink-0 font-semibold shadow-xs flex items-center gap-1.5"
          onClick={add}
        >
          <UserPlus size={14} />
          <span>Add contact</span>
        </button>
      </div>

      <Tabs tabs={["Table", "Kanban", "Who replied"]} value={tab} onChange={setTab} />

      {!ready ? (
        <Skeleton />
      ) : contacts.length === 0 ? (
        <Empty
          title="No contacts tracked yet"
          hint="Recruiters, HR managers, and referrals are tracked here automatically when applications are sent."
        />
      ) : tab === "Table" ? (
        <div className="card overflow-x-auto p-0 rounded-2xl">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="p-3.5">Name</th>
                <th className="p-3.5">Company</th>
                <th className="p-3.5">Email</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Last Reply</th>
                <th className="text-right p-3.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {contacts.map((c) => (
                <tr
                  key={c.id}
                  className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="p-3.5 font-semibold text-slate-900 dark:text-white">
                    {c.name}
                  </td>
                  <td className="p-3.5 text-slate-600 dark:text-slate-300">
                    {c.company || "—"}
                  </td>
                  <td className="p-3.5 font-mono text-slate-500">
                    {c.email}
                  </td>
                  <td className="p-3.5">
                    <StatusSelect id={c.id} v={c.status} />
                  </td>
                  <td className="p-3.5 text-slate-400 font-medium">
                    {fmt(c.lastRepliedAt)}
                  </td>
                  <td className="text-right p-3.5">
                    <button
                      className="btn-danger text-[11px] py-1 px-2.5 font-semibold"
                      onClick={() => deleteContact(c.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : tab === "Kanban" ? (
        <div className="grid gap-3 md:grid-cols-5">
          {STATUSES.map((s) => {
            const inStatus = contacts.filter((c) => c.status === s);
            return (
              <div
                key={s}
                className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 p-3 flex flex-col"
              >
                <div className="mb-2.5 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span>{s}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shadow-2xs">
                    {inStatus.length}
                  </span>
                </div>
                <div className="space-y-2 flex-1">
                  {inStatus.map((c) => (
                    <div
                      key={c.id}
                      className="card p-3 text-xs shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-2"
                    >
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white truncate">
                          {c.name}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                          {c.company || c.email}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                        <StatusSelect id={c.id} v={c.status} />
                        <button
                          className="p-1 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          onClick={() => deleteContact(c.id)}
                          title="Remove contact"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card divide-y divide-slate-100 dark:divide-slate-800 p-0">
          {contacts.filter((c) => c.lastRepliedAt).length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No replies received from recruiters yet.
            </div>
          ) : (
            contacts
              .filter((c) => c.lastRepliedAt)
              .sort((a, b) => +new Date(b.lastRepliedAt!) - +new Date(a.lastRepliedAt!))
              .map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-3.5 text-xs hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-white mr-2">
                      {c.name}
                    </span>
                    <span className="text-slate-500">· {c.company || c.email}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Badge v={c.status} />
                    <span className="text-slate-400 font-medium font-mono text-[11px]">
                      {fmt(c.lastRepliedAt)}
                    </span>
                  </div>
                </div>
              ))
          )}
        </div>
      )}
    </Page>
  );
}
