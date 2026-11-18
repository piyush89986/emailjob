import { useEffect, useState } from "react";
import { Exp, Profile, saveProfile, set, toast, uid, useS } from "@/lib/store";
import { tailorResume } from "@/lib/ai";
import { api } from "@/api/client";
import { Page, Tabs } from "@/components/ui";

type Result = ReturnType<typeof tailorResume>;

function ExpItem({
  item,
  onUpdate,
  onRemove,
}: {
  item: Exp;
  onUpdate: (patch: Partial<Exp>) => void;
  onRemove: () => void;
}) {
  const [bulletsText, setBulletsText] = useState(item.bullets.join("\n"));

  useEffect(() => {
    setBulletsText(item.bullets.join("\n"));
  }, [item.id]);

  const handleBulletsChange = (val: string) => {
    setBulletsText(val);
    onUpdate({ bullets: val.split("\n") });
  };

  return (
    <div className="card grid gap-2.5 md:grid-cols-3">
      <input
        className="input"
        placeholder="Company / Organization"
        value={item.company}
        onChange={(ev) => onUpdate({ company: ev.target.value })}
      />
      <input
        className="input"
        placeholder="Role / Title"
        value={item.role}
        onChange={(ev) => onUpdate({ role: ev.target.value })}
      />
      <input
        className="input"
        placeholder="Period (e.g. 2023–Present)"
        value={item.period}
        onChange={(ev) => onUpdate({ period: ev.target.value })}
      />
      <textarea
        className="input md:col-span-3 resize-y"
        rows={3}
        placeholder="Achievements / bullet points (one per line)"
        value={bulletsText}
        onChange={(ev) => handleBulletsChange(ev.target.value)}
      />
      <div className="md:col-span-3 flex justify-end">
        <button
          type="button"
          className="text-xs text-rose-500 hover:text-rose-700 transition-colors py-1 px-2 font-medium"
          onClick={onRemove}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

function ExpSection({
  title,
  items,
  onAdd,
  onUpdate,
  onRemove,
}: {
  title: string;
  items: Exp[];
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<Exp>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-slate-800 dark:text-slate-200">{title}</h3>
        <button
          type="button"
          className="btn-ghost text-xs"
          onClick={onAdd}
        >
          + Add {title.endsWith("s") ? title.slice(0, -1) : title}
        </button>
      </div>
      {items.map((e) => (
        <ExpItem
          key={e.id}
          item={e}
          onUpdate={(patch) => onUpdate(e.id, patch)}
          onRemove={() => onRemove(e.id)}
        />
      ))}
    </div>
  );
}

export function ProfileEditor() {
  const p = useS((s) => s.profile);
  const [skillsText, setSkillsText] = useState(p.skills.join(", "));

  useEffect(() => {
    setSkillsText(p.skills.join(", "));
  }, [p.name, p.email]);

  const up = (patch: Partial<Profile>) => set((s) => ({ profile: { ...s.profile, ...patch } }));
  const upList = (k: "experience" | "projects", id: string, patch: Partial<Exp>) =>
    up({ [k]: p[k].map((e) => (e.id === id ? { ...e, ...patch } : e)) });

  const addExp = (k: "experience" | "projects") => {
    up({ [k]: [...p[k], { id: uid(), company: "", role: "", period: "", bullets: [] }] });
  };

  const removeExp = (k: "experience" | "projects", id: string) => {
    up({ [k]: p[k].filter((x) => x.id !== id) });
  };

  return (
    <div className="space-y-4">
      <div className="card grid gap-2 md:grid-cols-2">
        <div>
          <label className="label">Full Name</label>
          <input className="input" value={p.name} onChange={(e) => up({ name: e.target.value })} placeholder="Your Name" />
        </div>
        <div>
          <label className="label">Email Address</label>
          <input className="input" value={p.email} onChange={(e) => up({ email: e.target.value })} placeholder="you@domain.com" />
        </div>
        <div className="md:col-span-2">
          <label className="label">Professional Headline</label>
          <input className="input" value={p.headline} onChange={(e) => up({ headline: e.target.value })} placeholder="e.g. Senior Backend Engineer | Python & FastAPI" />
        </div>
        <div className="md:col-span-2">
          <label className="label">Skills (comma separated)</label>
          <input
            className="input"
            value={skillsText}
            onChange={(e) => {
              const val = e.target.value;
              setSkillsText(val);
              up({ skills: val.split(",").map((s) => s.trim()).filter(Boolean) });
            }}
            placeholder="Python, FastAPI, React, TypeScript, Docker, MongoDB"
          />
        </div>
        <div>
          <label className="label">Education</label>
          <input className="input" value={p.education} onChange={(e) => up({ education: e.target.value })} placeholder="B.Tech Computer Science" />
        </div>
        <div>
          <label className="label">Links / Portfolio / GitHub</label>
          <input className="input" value={p.links} onChange={(e) => up({ links: e.target.value })} placeholder="github.com/yourname, linkedin.com/in/..." />
        </div>
        <div className="md:col-span-2 mt-2">
          <button className="btn" onClick={() => saveProfile(p)}>
            Save Master Profile
          </button>
        </div>
      </div>

      <ExpSection
        title="Experience"
        items={p.experience}
        onAdd={() => addExp("experience")}
        onUpdate={(id, patch) => upList("experience", id, patch)}
        onRemove={(id) => removeExp("experience", id)}
      />

      <ExpSection
        title="Projects"
        items={p.projects}
        onAdd={() => addExp("projects")}
        onUpdate={(id, patch) => upList("projects", id, patch)}
        onRemove={(id) => removeExp("projects", id)}
      />
    </div>
  );
}

export default function ResumeBuilder() {
  const p = useS((s) => s.profile);
  const resumes = useS((s) => s.resumes);
  const [tab, setTab] = useState("Tailor from JD");
  const [jd, setJd] = useState("");
  const [r, setR] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (jd.trim().length < 20) return toast("Paste a fuller job description", "err");
    setLoading(true);
    toast("AI agent tailoring resume against master profile...");
    try {
      const res = await api.post("/ai/resume/tailor", { jd });
      setR(res.data);
      toast(`Resume tailored! ATS score: ${res.data.ats}%`);
    } catch {
      // Local fallback calculation
      setR(tailorResume(jd, p));
      toast("Tailored resume (local verification)");
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!r) return;
    const label = `v${resumes.length + 1}`;
    try {
      const res = await api.post("/ai/resumes", {
        label,
        ats: r.ats,
        text: JSON.stringify(r)
      });
      set((s) => ({ resumes: [res.data, ...s.resumes] }));
      toast(`Saved as ${label}`);
    } catch {
      set((s) => ({
        resumes: [...s.resumes, { id: uid(), label, at: new Date().toISOString(), ats: r.ats, text: JSON.stringify(r) }]
      }));
      toast(`Saved as ${label} locally`);
    }
  };

  const exportDoc = async (id: string, format: "pdf" | "docx") => {
    toast(`Generating ${format.toUpperCase()} export...`);
    try {
      const res = await api.get(`/ai/resumes/${id}/export?format=${format}`, {
        responseType: "blob"
      });
      const blob = new Blob([res.data], {
        type: format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `resume-${id}.${format}`;
      a.click();
    } catch {
      if (format === "pdf") window.print();
      else toast("Export failed on server", "err");
    }
  };

  return (
    <Page title="Resume Builder">
      <Tabs tabs={["Tailor from JD", "Master profile", "Versions"]} value={tab} onChange={setTab} />
      {tab === "Master profile" && <ProfileEditor />}
      {tab === "Versions" && (
        <div className="card space-y-2">
          {resumes.length === 0 ? (
            <p className="text-sm text-slate-500">No saved versions yet.</p>
          ) : (
            resumes.map((v) => (
              <div
                key={v.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-2 text-sm last:border-0 dark:border-slate-800"
              >
                <div>
                  <span className="font-medium mr-2">{v.label}</span>
                  <span className="text-slate-500 text-xs">
                    ATS {v.ats}% · {new Date(v.at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button className="btn-ghost text-xs" onClick={() => exportDoc(v.id, "pdf")}>
                    Download PDF
                  </button>
                  <button className="btn-ghost text-xs" onClick={() => exportDoc(v.id, "docx")}>
                    Download DOCX
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
      {tab === "Tailor from JD" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="card space-y-2">
            <textarea
              className="input"
              rows={12}
              placeholder="Paste the job description…"
              value={jd}
              onChange={(e) => setJd(e.target.value)}
            />
            <button className="btn w-full" onClick={run} disabled={loading}>
              {loading ? "Tailoring with AI..." : "Tailor resume"}
            </button>
            <p className="text-xs text-slate-500">
              Only items from your master profile are selected and reordered. Nothing is ever fabricated or invented.
            </p>
            {r && (
              <div className="space-y-2 text-sm">
                <div className="text-3xl font-semibold">
                  {r.ats}% <span className="text-sm font-normal text-slate-500">ATS keyword match</span>
                </div>
                <div className="rounded-md bg-green-50 p-2 text-green-800 dark:bg-green-950 dark:text-green-200">
                  Verified {r.verified} bullet(s) against your profile · {r.unsupported} unsupported
                </div>
                {r.missing.length > 0 && (
                  <div>
                    <div className="font-medium">Missing skills (suggestions only)</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {r.missing.map((m) => (
                        <span key={m} className="badge bg-amber-100 text-amber-800">
                          {m}
                        </span>
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Add these to your master profile only if you genuinely have experience with them.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
          <div>
            {r ? (
              <>
                <div id="resume-print" className="card bg-white text-slate-900 shadow-sm">
                  <h2 className="text-xl font-semibold">{p.name || "Candidate Name"}</h2>
                  <p className="text-sm">
                    {p.headline} {p.email && `· ${p.email}`} {p.links && `· ${p.links}`}
                  </p>
                  <h3 className="mt-3 border-b text-sm font-semibold uppercase">Skills</h3>
                  <p className="text-sm">{r.skills.join(" · ")}</p>
                  <h3 className="mt-3 border-b text-sm font-semibold uppercase">Experience</h3>
                  {r.experience.map((e) => (
                    <div key={e.id} className="mt-1 text-sm">
                      <b>{e.role}</b>, {e.company} <span className="text-slate-500">({e.period})</span>
                      <ul className="list-disc pl-5">
                        {e.bullets.map((b) => (
                          <li key={b}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  <h3 className="mt-3 border-b text-sm font-semibold uppercase">Projects</h3>
                  {r.projects.map((e) => (
                    <div key={e.id} className="mt-1 text-sm">
                      <b>{e.company}</b>
                      <ul className="list-disc pl-5">
                        {e.bullets.map((b) => (
                          <li key={b}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  {p.education && (
                    <>
                      <h3 className="mt-3 border-b text-sm font-semibold uppercase">Education</h3>
                      <p className="text-sm">{p.education}</p>
                    </>
                  )}
                </div>
                <div className="mt-2 flex gap-2">
                  <button className="btn" onClick={save}>
                    Save version
                  </button>
                  <button className="btn-ghost" onClick={() => window.print()}>
                    Print / Save PDF
                  </button>
                </div>
              </>
            ) : (
              <div className="card text-sm text-slate-500">Your tailored resume preview appears here.</div>
            )}
          </div>
        </div>
      )}
    </Page>
  );
}
