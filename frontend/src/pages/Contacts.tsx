import { useState } from "react";
import { setContactStatus, createContact, deleteContact, useS, STATUSES, Status, toast } from "@/lib/store";
import { Badge, Empty, fmt, Page, Skeleton, Tabs, useReady } from "@/components/ui";

export default function Contacts() {
  const ready = useReady();
  const contacts = useS((s) => s.contacts);
  const [tab, setTab] = useState("Table");
  const [f, setF] = useState({ name: "", email: "", company: "" });

  const add = async () => {
    if (!f.email) return toast("Email required", "err");
    await createContact({
      name: f.name || f.email.split("@")[0],
      email: f.email,
      company: f.company || f.email.split("@")[1] || "",
      status: "Contacted"
    });
    setF({ name: "", email: "", company: "" });
  };

  const Sel = ({ id, v }: { id: string; v: Status }) => (
    <select
      className="input w-auto py-1 text-xs"
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

  return (
    <Page title="Contacts">
      <div className="card mb-4 grid gap-2 md:grid-cols-4">
        <input
          className="input"
          placeholder="Name"
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
        />
        <input
          className="input"
          placeholder="Email *"
          type="email"
          value={f.email}
          onChange={(e) => setF({ ...f, email: e.target.value })}
        />
        <input
          className="input"
          placeholder="Company"
          value={f.company}
          onChange={(e) => setF({ ...f, company: e.target.value })}
        />
        <button className="btn" onClick={add}>
          Add contact
        </button>
      </div>

      <Tabs tabs={["Table", "Kanban", "Who replied"]} value={tab} onChange={setTab} />

      {!ready ? (
        <Skeleton />
      ) : contacts.length === 0 ? (
        <Empty title="No contacts yet" hint="Recruiters, HR managers and referrals will be tracked here automatically when you send an email." />
      ) : tab === "Table" ? (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="p-2">Name</th>
                <th>Company</th>
                <th>Email</th>
                <th>Status</th>
                <th>Last reply</th>
                <th className="text-right p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="p-2 font-medium">{c.name}</td>
                  <td>{c.company}</td>
                  <td>{c.email}</td>
                  <td>
                    <Sel id={c.id} v={c.status} />
                  </td>
                  <td>{fmt(c.lastRepliedAt)}</td>
                  <td className="text-right p-2">
                    <button
                      className="text-xs text-red-600 hover:underline"
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
          {STATUSES.map((s) => (
            <div key={s} className="rounded-lg bg-slate-100 p-2 dark:bg-slate-900">
              <div className="mb-2 flex justify-between text-sm font-medium">
                {s}
                <span className="text-xs text-slate-500">
                  {contacts.filter((c) => c.status === s).length}
                </span>
              </div>
              <div className="space-y-2">
                {contacts
                  .filter((c) => c.status === s)
                  .map((c) => (
                    <div key={c.id} className="card p-2 text-sm shadow-sm">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-slate-500">{c.company}</div>
                      <div className="mt-2 flex items-center justify-between">
                        <Sel id={c.id} v={c.status} />
                        <button
                          className="text-xs text-red-600"
                          onClick={() => deleteContact(c.id)}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card space-y-1">
          {contacts.filter((c) => c.lastRepliedAt).length === 0 ? (
            <p className="text-sm text-slate-500">No replies received yet.</p>
          ) : (
            contacts
              .filter((c) => c.lastRepliedAt)
              .sort((a, b) => +new Date(b.lastRepliedAt!) - +new Date(a.lastRepliedAt!))
              .map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between border-b border-slate-100 py-2 text-sm last:border-0 dark:border-slate-800"
                >
                  <div>
                    <span className="font-medium mr-2">{c.name}</span>
                    <span className="text-xs text-slate-500">· {c.company}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge v={c.status} />
                    <span className="text-xs text-slate-500">{fmt(c.lastRepliedAt)}</span>
                  </div>
                </div>
              ))
          )}
        </div>
      )}
    </Page>
  );
}
