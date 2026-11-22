import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Cloud, ExternalLink, FileText, Star, Trash2 } from "lucide-react";
import {
  Exp,
  Profile,
  RoleResume,
  deleteRoleResume,
  fetchRoleResumes,
  saveProfile,
  set,
  setDefaultRoleResume,
  toast,
  uid,
  uploadRoleResume,
  useS,
} from "@/lib/store";
import { tailorResume } from "@/lib/ai";
import { api, getApiBaseUrl, tokens } from "@/api/client";
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
          <button className="btn text-xs py-1.5 px-4 font-semibold shadow-xs" onClick={() => saveProfile(p)}>
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

const SUGGESTED_ROLES = [
  "MERN Stack Developer",
  "Full Stack Developer",
  "Frontend Developer",
  "Backend Developer",
  "Python Developer",
  "React Developer",
  "Node.js Developer",
  "DevOps Engineer",
  "Software Engineer",
  "Data Analyst"
];

function RoleResumeManager() {
  const roleResumes = useS((s) => s.roleResumes);
  const [file, setFile] = useState<File | null>(null);
  const [role, setRole] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [roleFilter, setRoleFilter] = useState("all");
  const [cloudStatus, setCloudStatus] = useState<{ cloudinaryConfigured: boolean } | null>(null);

  useEffect(() => {
    fetchRoleResumes();
    api.get("/role-resumes/status")
      .then((res) => setCloudStatus(res.data))
      .catch(() => setCloudStatus({ cloudinaryConfigured: false }));
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return toast("Select a resume file to upload", "err");
    if (!role.trim()) return toast("Enter or select a target job role", "err");

    setUploading(true);
    try {
      await uploadRoleResume(file, role.trim(), isDefault, notes.trim());
      setFile(null);
      setRole("");
      setIsDefault(false);
      setNotes("");
      const fileInput = document.getElementById("resume-file-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
    } catch {
      // toast shown in store
    } finally {
      setUploading(false);
    }
  };

  const roles = ["all", ...Array.from(new Set(roleResumes.map((r) => r.role)))];
  const filtered = roleFilter === "all" ? roleResumes : roleResumes.filter((r) => r.role === roleFilter);

  const formatSize = (bytes: number) => {
    if (!bytes) return "0 KB";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const openResume = (r: RoleResume) => {
    if (r.storageType === "cloudinary" && r.url && r.url.startsWith("http")) {
      window.open(r.url, "_blank");
    } else {
      const url = `${getApiBaseUrl()}/role-resumes/${r.id}/file?token=${tokens.access || ""}`;
      window.open(url, "_blank");
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Box */}
      <div className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold">Upload Role-Specific Resume</h2>
            <p className="text-xs text-slate-500">
              Upload custom resumes tailored to specific job roles (e.g. MERN Stack Developer, Frontend, Python Backend).
            </p>
          </div>
          {cloudStatus && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                cloudStatus.cloudinaryConfigured
                  ? "bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              <Cloud size={13} />
              {cloudStatus.cloudinaryConfigured ? "Cloudinary Storage Connected" : "Local Database Storage Active"}
            </span>
          )}
        </div>

        <form onSubmit={handleUpload} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Target Job Role *</label>
              <input
                className="input"
                placeholder="e.g. MERN Stack Developer, Frontend Engineer"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                required
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="text-[11px] text-slate-400 self-center mr-1">Suggestions:</span>
                {SUGGESTED_ROLES.slice(0, 5).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className="rounded-md border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Resume File (PDF, DOCX, DOC) *</label>
              <input
                id="resume-file-input"
                type="file"
                className="input file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-950 dark:file:text-indigo-300"
                accept=".pdf,.docx,.doc"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                required
              />
              {file && (
                <p className="mt-1 text-xs text-slate-500">
                  Selected: {file.name} ({formatSize(file.size)})
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Notes / Tags (optional)</label>
              <input
                className="input"
                placeholder="e.g. 2+ Yrs Experience, Includes React + Node.js projects"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div className="flex items-center pt-2 md:pt-5">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-medium text-slate-700 dark:text-slate-300 text-xs">
                  Set as primary/default resume for this role
                </span>
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" className="btn text-xs py-1.5 px-4 font-semibold shadow-xs" disabled={uploading}>
              {uploading ? "Uploading..." : "Upload Resume"}
            </button>
          </div>
        </form>
      </div>

      {/* Uploaded Resumes List */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg">Uploaded Resumes ({roleResumes.length})</h3>
          </div>
          {roles.length > 1 && (
            <div className="flex gap-1 overflow-x-auto pb-1">
              {roles.map((r) => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  className={`rounded-full px-3 py-1 text-xs capitalize shrink-0 font-medium transition-colors ${
                    roleFilter === r
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {r === "all" ? "All Roles" : r}
                </button>
              ))}
            </div>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="card text-center py-10 text-slate-500 space-y-1">
            <FileText size={32} className="mx-auto text-slate-400 mb-2" />
            <p className="font-medium">No resumes uploaded yet.</p>
            <p className="text-xs">Upload your role-specific resumes above to use them when applying to jobs.</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {filtered.map((r) => (
              <div
                key={r.id}
                className={`card flex flex-col justify-between space-y-3 p-4 transition-all hover:border-slate-300 dark:hover:border-slate-700 ${
                  r.isDefault ? "ring-1 ring-indigo-500/50 bg-indigo-50/20 dark:bg-indigo-950/20" : ""
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                      {r.role}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {r.isDefault && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-full">
                          <Star size={11} className="fill-amber-500" /> Default
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                        {r.storageType === "cloudinary" ? "Cloudinary" : "Database"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <FileText size={18} className="text-indigo-600 shrink-0" />
                    <div className="font-medium text-sm truncate" title={r.filename}>
                      {r.filename}
                    </div>
                  </div>

                  <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-500">
                    <span>{formatSize(r.sizeBytes)}</span>
                    <span>·</span>
                    <span>{new Date(r.createdAt).toLocaleDateString()}</span>
                  </div>

                  {r.notes && (
                    <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 italic">
                      "{r.notes}"
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800 text-xs">
                  <div className="flex gap-2">
                    <button
                      onClick={() => openResume(r)}
                      className="btn-ghost text-xs py-1 px-3 inline-flex items-center gap-1 font-medium"
                    >
                      <ExternalLink size={13} /> View / Download
                    </button>
                    {!r.isDefault && (
                      <button
                        onClick={() => setDefaultRoleResume(r.id)}
                        className="btn-ghost text-xs py-1 px-3 text-slate-600 hover:text-slate-900 font-medium"
                        title="Make this the default resume when applying for this role"
                      >
                        Make Default
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      if (confirm(`Delete resume "${r.filename}" for ${r.role}?`)) {
                        deleteRoleResume(r.id);
                      }
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors rounded"
                    title="Delete resume"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ResumeBuilder() {
  const p = useS((s) => s.profile);
  const resumes = useS((s) => s.resumes);
  const [tab, setTab] = useState("Resumes by Role");
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
    <Page title="Resume Hub">
      <Tabs
        tabs={["Resumes by Role", "Master profile", "Tailor from JD", "Saved versions"]}
        value={tab}
        onChange={setTab}
      />
      {tab === "Resumes by Role" && <RoleResumeManager />}
      {tab === "Master profile" && <ProfileEditor />}
      {tab === "Saved versions" && (
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
