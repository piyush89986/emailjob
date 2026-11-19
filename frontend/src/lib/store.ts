import { useSyncExternalStore } from "react";
import { api, tokens, getApiBaseUrl, setApiBaseUrl } from "@/api/client";

export type Status =
  | "Contacted"
  | "Replied"
  | "Interview"
  | "Offer"
  | "Rejected"
  | "Draft"
  | "Ready to Apply"
  | "Saved"
  | "Applied"
  | "Email Sent"
  | "Email Delivered"
  | "Response Received"
  | "Interview Scheduled"
  | "Assessment"
  | "Offer Received"
  | "Withdrawn";

export const STATUSES: Status[] = [
  "Draft",
  "Ready to Apply",
  "Saved",
  "Applied",
  "Email Sent",
  "Response Received",
  "Interview Scheduled",
  "Assessment",
  "Offer Received",
  "Rejected",
  "Withdrawn"
];
export interface Contact { id: string; name: string; email: string; company: string; status: Status; lastRepliedAt?: string; createdAt: string }
export interface Msg { id: string; dir: "in" | "out"; from: string; body: string; at: string; kind: "normal" | "auto" | "bounce"; delivery?: "sent" | "failed" | "sending" }
export interface Thread { id: string; subject: string; contactId: string; unread: boolean; messages: Msg[] }
export interface Template { id: string; name: string; subject: string; body: string; global: boolean }
export interface App {
  id: string;
  title: string;
  company: string;
  jd: string;
  jdUrl: string;
  contactId: string;
  resume: string;
  status: Status;
  hrEmail?: string;
  location?: string;
  salaryRange?: string;
  matchScore?: number;
  jobPosterUrl?: string;
  emailSubject?: string;
  emailBody?: string;
  gmailThreadId?: string;
  createdAt?: string;
  timeline: { at: string; label: string }[];
}
export interface Account { id: string; provider: "gmail" | "outlook" | "imap"; address: string; status: "connected" | "error" | "needs_reauth"; isDefault: boolean }
export interface Exp { id: string; company: string; role: string; period: string; bullets: string[] }
export interface Profile { name: string; email: string; headline: string; skills: string[]; experience: Exp[]; projects: Exp[]; education: string; links: string }
export interface Prefs { tone: "formal" | "friendly" | "concise"; provider: "openai" | "gemini"; fallback: boolean; dailyCap: number; delaySec: number; dnc: string[]; signature: string }
export interface Toast { id: string; msg: string; type: "ok" | "err" }
export interface ResumeVersion { id: string; label: string; at: string; ats: number; text: string }
export interface RoleResume {
  id: string;
  role: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  url: string;
  storageType: "cloudinary" | "local";
  cloudinaryPublicId?: string;
  attachmentId?: string;
  isDefault: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
export interface Draft { to: string; subject: string; body: string }

export interface ExtractedJobDetails {
  company_name?: string;
  job_title?: string;
  location?: string;
  hr_name?: string;
  hr_email?: string;
  contact_number?: string;
  salary_range?: string;
  required_skills: string[];
  required_experience?: string;
  educational_qualifications?: string;
  job_responsibilities: string[];
  candidate_requirements: string[];
  application_instructions?: string;
  company_website?: string;
  confidence_score: number;
  requires_manual_verification: boolean;
  raw_text?: string;
}

export interface JobPoster {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  file_url: string;
  storage_type: string;
  extracted_data?: ExtractedJobDetails;
  generated_jd?: string;
  selected_resume_id?: string;
  application_id?: string;
  status: "uploaded" | "analyzing" | "extracted" | "applied" | "failed";
  error_message?: string;
  created_at: string;
}

export interface ResumeMatchScore {
  resume_id: string;
  role_name: string;
  filename: string;
  match_percentage: number;
  breakdown: Record<string, number>;
  matching_skills: string[];
  missing_skills: string[];
  strengths: string[];
  weaknesses: string[];
  rationale: string;
  is_recommended: boolean;
  attachment_id?: string;
  url: string;
}

export interface AutomationWorkflow {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  trigger_type: string;
  nodes: any[];
  edges: any[];
  settings: {
    min_match_score?: number;
    auto_send: boolean;
    fallback_to_manual: boolean;
    delay_between_steps_sec?: number;
    max_daily_apps?: number;
    follow_up_days?: number;
    max_follow_ups?: number;
    execution_mode?: "syn" | "asyn";
  };
  created_at: string;
  updated_at: string;
}

export interface WorkflowExecution {
  id: string;
  workflow_id: string;
  workflow_name: string;
  job_poster_id?: string;
  application_id?: string;
  status: "running" | "completed" | "failed" | "manual_review" | "cancelled";
  current_node_id?: string;
  context_data: Record<string, any>;
  logs: { timestamp: string; node_id?: string; level: string; message: string; data?: any }[];
  error_message?: string;
  started_at: string;
  finished_at?: string;
}

export interface ApplyMetrics {
  totalApplications: number;
  applicationsSent: number;
  pendingApplications: number;
  responsesReceived: number;
  interviewsScheduled: number;
  rejectedApplications: number;
}

export interface HRInboxItem {
  id: string;
  tenant_id: string;
  user_id: string;
  gmail_message_id: string;
  gmail_thread_id?: string;
  email_account_id?: string;
  sender_name: string;
  sender_email: string;
  to_email: string;
  subject: string;
  body_preview: string;
  body_html: string;
  received_at: string;
  category: string;
  confidence_score: number;
  is_relevant: boolean;
  needs_manual_review: boolean;
  classification_reasoning?: string;
  company?: string;
  job_title?: string;
  application_id?: string;
  is_read: boolean;
  is_archived: boolean;
  labels?: string[];
  application?: {
    id: string;
    title: string;
    company: string;
    status: string;
    created_at: string;
  };
}

export interface HRCounts {
  all: number;
  hr: number;
  interviews: number;
  applications: number;
  rejections: number;
  unread: number;
  review: number;
}

export interface S {
  user: { name: string; email: string } | null;
  contacts: Contact[];
  threads: Thread[];
  templates: Template[];
  apps: App[];
  accounts: Account[];
  profile: Profile;
  prefs: Prefs;
  toasts: Toast[];
  dark: boolean;
  resumes: ResumeVersion[];
  roleResumes: RoleResume[];
  posters: JobPoster[];
  workflows: AutomationWorkflow[];
  applyMetrics: ApplyMetrics | null;
  draft: Draft | null;
  hrInbox: HRInboxItem[];
  hrCounts: HRCounts;
  hrUnreadCount: number;
}

export const uid = () => Math.random().toString(36).slice(2, 9);

const getInitialUser = (): { name: string; email: string } | null => {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("jobmail_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const getInitialDark = (): boolean => {
  if (typeof window === "undefined") return false;
  const stored = localStorage.getItem("jobmail_theme");
  if (stored) {
    return stored === "dark";
  }
  return typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
    : false;
};

const emptyState = (): S => ({
  user: getInitialUser(),
  dark: getInitialDark(),
  draft: null,
  toasts: [],
  resumes: [],
  roleResumes: [],
  posters: [],
  workflows: [],
  applyMetrics: null,
  contacts: [],
  threads: [],
  templates: [],
  apps: [],
  accounts: [],
  hrInbox: [],
  hrCounts: { all: 0, hr: 0, interviews: 0, applications: 0, rejections: 0, unread: 0, review: 0 },
  hrUnreadCount: 0,
  profile: {
    name: "",
    email: "",
    headline: "",
    skills: [],
    experience: [],
    projects: [],
    education: "",
    links: "",
  },
  prefs: {
    tone: "formal",
    provider: "openai",
    fallback: true,
    dailyCap: 20,
    delaySec: 60,
    dnc: [],
    signature: "",
  },
});

let state: S = emptyState();
if (typeof window !== "undefined") {
  document.documentElement.classList.toggle("dark", state.dark);
}
const subs = new Set<() => void>();
export const getState = () => state;
export const set = (fn: (s: S) => Partial<S>) => { state = { ...state, ...fn(state) }; subs.forEach((s) => s()); };
export function useS<T>(sel: (s: S) => T): T { return useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => sel(state)); }

export function toast(msg: string, type: "ok" | "err" = "ok") {
  const id = uid(); set((s) => ({ toasts: [...s.toasts, { id, msg, type }] }));
  setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3500);
}
export const fill = (t: string, v: Record<string, string>) => t.replace(/{{(\w+)}}/g, (_, k) => v[k] ?? `{{${k}}}`);

export const isMockMode = () => import.meta.env.VITE_USE_MOCK === "true";

// --- Auth ---
export async function login(email: string, password?: string) {
  const fallbackUser = { name: email.split("@")[0], email };
  if (typeof window !== "undefined") {
    localStorage.setItem("jobmail_user", JSON.stringify(fallbackUser));
  }
  set(() => ({ user: fallbackUser }));

  if (isMockMode()) {
    return;
  }
  const res = await api.post("/auth/login", { email, password: password || "" });
  const { accessToken, refreshToken, access_token, refresh_token } = res.data;
  tokens.set(accessToken || access_token, refreshToken || refresh_token);
  await loadInitialData();
}

export async function signup(email: string, password: string, name: string, org?: string) {
  const fallbackUser = { name: name || email.split("@")[0], email };
  if (typeof window !== "undefined") {
    localStorage.setItem("jobmail_user", JSON.stringify(fallbackUser));
  }
  set(() => ({ user: fallbackUser }));

  if (isMockMode()) {
    return;
  }
  const res = await api.post("/auth/signup", {
    email,
    password,
    name: name || email.split("@")[0],
    org: org || ""
  });
  const { accessToken, refreshToken, access_token, refresh_token } = res.data;
  tokens.set(accessToken || access_token, refreshToken || refresh_token);
  await loadInitialData();
}

export function logout() {
  tokens.clear();
  if (typeof window !== "undefined") {
    localStorage.removeItem("jobmail_user");
  }
  if (sseSource) {
    sseSource.close();
    sseSource = null;
  }
  const savedDark = getInitialDark();
  set(() => ({ ...emptyState(), user: null, dark: savedDark }));
  if (typeof window !== "undefined") {
    document.documentElement.classList.toggle("dark", savedDark);
  }
}

// --- Data Hydration ---
export async function loadInitialData() {
  if (isMockMode() || !tokens.access) return;
  try {
    const [meRes, contactsRes, threadsRes, tplsRes, appsRes, accsRes, profRes, settingsRes, resumesRes, roleResumesRes, hrInboxRes] = await Promise.allSettled([
      api.get("/auth/me"),
      api.get("/contacts"),
      api.get("/threads"),
      api.get("/templates"),
      api.get("/applications"),
      api.get("/accounts"),
      api.get("/profile"),
      api.get("/settings"),
      api.get("/ai/resumes"),
      api.get("/role-resumes"),
      api.get("/hr-inbox"),
    ]);

    // Check if auth failed
    if (meRes.status === "rejected") {
      const errStatus = (meRes.reason as any)?.response?.status;
      if (errStatus === 401 && !tokens.refresh) {
        logout();
        return;
      }
    }

    const resolvedUser = meRes.status === "fulfilled"
      ? { name: meRes.value.data.name, email: meRes.value.data.email }
      : state.user;

    if (resolvedUser && typeof window !== "undefined") {
      localStorage.setItem("jobmail_user", JSON.stringify(resolvedUser));
    }

    const hrData = hrInboxRes.status === "fulfilled" ? hrInboxRes.value.data : null;

    set((s) => ({
      user: resolvedUser || s.user,
      contacts: contactsRes.status === "fulfilled" ? contactsRes.value.data : s.contacts,
      threads: threadsRes.status === "fulfilled" ? threadsRes.value.data : s.threads,
      templates: tplsRes.status === "fulfilled" ? tplsRes.value.data : s.templates,
      apps: appsRes.status === "fulfilled" ? appsRes.value.data : s.apps,
      accounts: accsRes.status === "fulfilled" ? accsRes.value.data : s.accounts,
      profile: profRes.status === "fulfilled" ? profRes.value.data : s.profile,
      prefs: settingsRes.status === "fulfilled" ? settingsRes.value.data : s.prefs,
      resumes: resumesRes.status === "fulfilled" ? resumesRes.value.data : s.resumes,
      roleResumes: roleResumesRes.status === "fulfilled" ? roleResumesRes.value.data : s.roleResumes,
      hrInbox: hrData ? hrData.items : s.hrInbox,
      hrCounts: hrData ? hrData.counts : s.hrCounts,
      hrUnreadCount: hrData?.counts?.unread ?? s.hrUnreadCount,
    }));

    setupSSE();
  } catch (e) {
    console.warn("Failed loading backend data", e);
  }
}

let sseSource: EventSource | null = null;
function setupSSE() {
  if (sseSource || isMockMode() || !tokens.access) return;
  try {
    const sseUrl = `${getApiBaseUrl()}/events?token=${tokens.access}`;
    sseSource = new EventSource(sseUrl);

    sseSource.addEventListener("reply.received", (e) => {
      try {
        const payload = JSON.parse(e.data);
        toast(`New reply from ${payload.contactName || payload.from}`);
        loadInitialData();
      } catch {}
    });

    sseSource.addEventListener("hr_inbox.new", (e) => {
      try {
        const payload = JSON.parse(e.data);
        const cat = String(payload.category || "").replace(/_/g, " ");
        toast(`📨 New HR Email: ${payload.sender} (${cat})`);
        fetchHRInbox();
      } catch {}
    });

    sseSource.addEventListener("hr_inbox.unread_count", (e) => {
      try {
        const payload = JSON.parse(e.data);
        set(() => ({ hrUnreadCount: payload.count }));
      } catch {}
    });

    sseSource.addEventListener("hr_inbox.updated", () => {
      fetchHRInbox();
    });

    sseSource.addEventListener("account.needs_reauth", (e) => {
      try {
        const payload = JSON.parse(e.data);
        set((s) => ({
          accounts: s.accounts.map((a) => (a.id === payload.accountId ? { ...a, status: "needs_reauth" } : a))
        }));
      } catch {}
    });

    sseSource.addEventListener("delivery.updated", (e) => {
      try {
        const payload = JSON.parse(e.data);
        set((s) => ({
          threads: s.threads.map((t) => ({
            ...t,
            messages: t.messages.map((m) => (m.id === payload.messageId ? { ...m, delivery: payload.delivery } : m))
          }))
        }));
      } catch {}
    });
  } catch {}
}

if (typeof window !== "undefined" && tokens.access) {
  loadInitialData();
}

export function toggleDark() {
  const next = !state.dark;
  if (typeof window !== "undefined") {
    localStorage.setItem("jobmail_theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
  }
  set(() => ({ dark: next }));
}

const sentToday = () => state.threads.flatMap((t) => t.messages).filter((m) => m.dir === "out" && Date.now() - +new Date(m.at) < 864e5).length;

// --- Email Sending ---
export function sendEmail(to: string, subject: string, body: string, threadId?: string, attachmentIds?: string[]): boolean {
  const addr = to.trim().toLowerCase();
  if (!addr) { toast("Add a recipient", "err"); return false; }
  if (state.prefs.dnc.map((d) => d.toLowerCase()).includes(addr)) { toast(`${addr} is on your do-not-contact list`, "err"); return false; }
  if (sentToday() >= state.prefs.dailyCap) { toast(`Daily cap of ${state.prefs.dailyCap} reached`, "err"); return false; }
  if (!state.accounts.some((a) => a.isDefault && a.status === "connected")) { toast("Connect a default email account in Settings", "err"); return false; }

  const msgId = uid();
  const msg: Msg = { id: msgId, dir: "out", from: "me", body, at: new Date().toISOString(), kind: "normal", delivery: "sending" };
  let contact = state.contacts.find((c) => c.email.toLowerCase() === addr);
  const contacts = contact ? state.contacts : [...state.contacts, (contact = { id: uid(), name: addr.split("@")[0], email: addr, company: addr.split("@")[1] ?? "", status: "Contacted", createdAt: msg.at })];
  const tid = threadId ?? uid();
  const threads = threadId ? state.threads.map((t) => (t.id === tid ? { ...t, messages: [...t.messages, msg] } : t))
    : [{ id: tid, subject, contactId: contact.id, unread: false, messages: [msg] }, ...state.threads];
  set(() => ({ contacts, threads }));

  if (!isMockMode()) {
    api.post("/emails/send", {
      to: addr,
      subject,
      body,
      threadId: tid,
      attachmentIds: attachmentIds || []
    })
      .then((res) => {
        set((s) => ({
          threads: s.threads.map((t) => (t.id !== tid ? t : {
            ...t,
            messages: t.messages.map((m) => (m.id === msgId ? { ...m, id: res.data.id || msgId, delivery: res.data.delivery || "sent" } : m))
          }))
        }));
        toast("Queued for sending");
      })
      .catch((err) => {
        setDelivery(tid, msgId, "failed");
        toast(err.response?.data?.error?.message || "Sending failed", "err");
      });
  } else {
    setTimeout(() => setDelivery(tid, msg.id, addr.includes("fail") ? "failed" : "sent"), 1200);
    toast("Queued for sending");
  }

  return true;
}

function setDelivery(tid: string, mid: string, d: "sent" | "failed") {
  set((s) => ({ threads: s.threads.map((t) => t.id !== tid ? t : { ...t, messages: t.messages.map((m) => (m.id === mid ? { ...m, delivery: d } : m)) }) }));
  toast(d === "sent" ? "Email sent" : "Sending failed – retry from Inbox", d === "sent" ? "ok" : "err");
}

export const retrySend = (tid: string, mid: string) => {
  if (!isMockMode()) {
    api.post(`/emails/${mid}/retry`).catch(() => {});
  }
  setDelivery(tid, mid, "sent");
};

export function markRead(tid: string) {
  if (!isMockMode()) {
    api.post(`/threads/${tid}/read`).catch(() => {});
  }
  set((s) => ({ threads: s.threads.map((t) => (t.id === tid ? { ...t, unread: false } : t)) }));
}

const AUTOMATED_SENDERS = [
  "noreply", "no-reply", "donotreply", "do-not-reply",
  "notifications@", "notification@", "alert@", "alerts@",
  "billing@", "updates@", "slice.bank", "support@", "jobalert",
  "jobhai", "internshala", "indeed", "linkedin", "naukri",
  "newsletter", "marketing", "mailer-daemon", "postmaster", "vercel.com"
];

export function threadState(t: Thread): "replied" | "waiting" | "bounced" {
  if (t.messages.some((m) => m.kind === "bounce")) return "bounced";
  const hasHumanReply = t.messages.some(
    (m) =>
      m.dir === "in" &&
      m.kind === "normal" &&
      !AUTOMATED_SENDERS.some((term) => (m.from || "").toLowerCase().includes(term))
  );
  return hasHumanReply ? "replied" : "waiting";
}

export function simulateReply() {
  const t = state.threads.find((x) => threadState(x) === "waiting");
  if (!t) return toast("No waiting threads", "err");
  const c = state.contacts.find((x) => x.id === t.contactId)!; const at = new Date().toISOString();
  set((s) => ({
    threads: s.threads.map((x) => (x.id === t.id ? { ...x, unread: true, messages: [...x.messages, { id: uid(), dir: "in", from: c.email, body: "Thanks for applying — can we schedule a call?", at, kind: "normal" }] } : x)),
    contacts: s.contacts.map((x) => (x.id === c.id ? { ...x, status: x.status === "Contacted" ? "Replied" : x.status, lastRepliedAt: at } : x)),
  }));
  toast(`New reply from ${c.name}`);
}

// --- Contacts CRUD ---
export async function createContact(data: { name: string; email: string; company: string; status?: Status }) {
  if (isMockMode()) {
    set((s) => ({ contacts: [...s.contacts, { id: uid(), ...data, status: data.status || "Contacted", createdAt: new Date().toISOString() }] }));
    toast("Contact added");
    return;
  }
  try {
    const res = await api.post("/contacts", data);
    set((s) => ({ contacts: [...s.contacts, res.data] }));
    toast("Contact added");
  } catch (err: any) {
    toast(err.response?.data?.error?.message || "Failed to add contact", "err");
  }
}

export const setContactStatus = async (id: string, status: Status) => {
  set((s) => ({ contacts: s.contacts.map((c) => (c.id === id ? { ...c, status } : c)) }));
  if (!isMockMode()) {
    try {
      await api.patch(`/contacts/${id}/status`, { status });
    } catch {}
  }
};

export async function deleteContact(id: string) {
  set((s) => ({ contacts: s.contacts.filter((c) => c.id !== id) }));
  if (!isMockMode()) {
    try {
      await api.delete(`/contacts/${id}`);
      toast("Contact deleted");
    } catch {}
  }
}

// --- Applications CRUD ---
export async function fetchApplications() {
  try {
    const res = await api.get("/applications");
    set(() => ({ apps: res.data }));
    return res.data;
  } catch (err) {
    console.warn("Failed fetching applications", err);
  }
}

export async function createApplication(data: { title: string; company: string; jdUrl?: string; jd?: string; contactId?: string; resume?: string }) {
  if (isMockMode()) {
    const a: App = { id: uid(), ...data, jd: data.jd || "", jdUrl: data.jdUrl || "", contactId: data.contactId || "", resume: data.resume || "", status: "Saved", timeline: [{ at: new Date().toISOString(), label: "Saved" }] };
    set((s) => ({ apps: [a, ...s.apps] }));
    toast("Application saved");
    return;
  }
  try {
    const res = await api.post("/applications", data);
    set((s) => ({ apps: [res.data, ...s.apps] }));
    toast("Application saved");
  } catch (err: any) {
    toast(err.response?.data?.error?.message || "Failed to save application", "err");
  }
}

export async function setApplicationStatus(id: string, status: App["status"]) {
  set((s) => ({
    apps: s.apps.map((a) => (a.id === id ? {
      ...a,
      status,
      timeline: [...a.timeline, { at: new Date().toISOString(), label: status }]
    } : a))
  }));
  if (!isMockMode()) {
    try {
      await api.patch(`/applications/${id}/status`, { status });
    } catch {}
  }
}

// --- Templates CRUD ---
export async function saveTemplate(t: { id?: string; name: string; subject: string; body: string }) {
  if (isMockMode()) {
    const isExisting = state.templates.some((x) => x.id === t.id);
    const updated: Template = { id: t.id || uid(), name: t.name, subject: t.subject, body: t.body, global: false };
    set((s) => ({
      templates: isExisting ? s.templates.map((x) => (x.id === t.id ? updated : x)) : [...s.templates, updated]
    }));
    toast("Template saved");
    return;
  }
  try {
    if (t.id && state.templates.some((x) => x.id === t.id && !x.global)) {
      const res = await api.put(`/templates/${t.id}`, { name: t.name, subject: t.subject, body: t.body });
      set((s) => ({ templates: s.templates.map((x) => (x.id === t.id ? res.data : x)) }));
    } else {
      const res = await api.post("/templates", { name: t.name, subject: t.subject, body: t.body });
      set((s) => ({ templates: [...s.templates, res.data] }));
    }
    toast("Template saved");
  } catch (err: any) {
    toast(err.response?.data?.error?.message || "Failed to save template", "err");
  }
}

export async function cloneTemplate(id: string) {
  if (isMockMode()) {
    const t = state.templates.find((x) => x.id === id);
    if (t) {
      set((s) => ({ templates: [...s.templates, { ...t, id: uid(), name: `${t.name} (copy)`, global: false }] }));
      toast("Template cloned");
    }
    return;
  }
  try {
    const res = await api.post(`/templates/${id}/clone`);
    set((s) => ({ templates: [...s.templates, res.data] }));
    toast("Template cloned");
  } catch (err: any) {
    toast(err.response?.data?.error?.message || "Failed to clone template", "err");
  }
}

export async function deleteTemplate(id: string) {
  set((s) => ({ templates: s.templates.filter((x) => x.id !== id) }));
  if (!isMockMode()) {
    try {
      await api.delete(`/templates/${id}`);
      toast("Template deleted");
    } catch (err: any) {
      toast(err.response?.data?.error?.message || "Failed to delete template", "err");
    }
  }
}

// --- Profile & Settings ---
export async function saveProfile(p: Profile) {
  set(() => ({ profile: p }));
  if (!isMockMode()) {
    try {
      await api.put("/profile", p);
      toast("Profile saved");
    } catch (err: any) {
      toast(err.response?.data?.error?.message || "Failed to save profile", "err");
    }
  } else {
    toast("Profile saved");
  }
}

export async function savePrefs(patch: Partial<Prefs>) {
  const newPrefs = { ...state.prefs, ...patch };
  set(() => ({ prefs: newPrefs }));
  if (!isMockMode()) {
    try {
      await api.put("/settings", patch);
      toast("Settings updated");
    } catch (err: any) {
      toast(err.response?.data?.error?.message || "Failed to update settings", "err");
    }
  } else {
    toast("Settings updated");
  }
}

export async function addDnc(email: string) {
  const clean = email.trim().toLowerCase();
  if (!clean) return;
  set((s) => ({ prefs: { ...s.prefs, dnc: [...s.prefs.dnc, clean] } }));
  if (!isMockMode()) {
    try {
      await api.post("/settings/dnc", { email: clean });
      toast("Added to Do-Not-Contact list");
    } catch {}
  }
}

export async function removeDnc(email: string) {
  set((s) => ({ prefs: { ...s.prefs, dnc: s.prefs.dnc.filter((d) => d !== email) } }));
  if (!isMockMode()) {
    try {
      await api.delete(`/settings/dnc/${encodeURIComponent(email)}`);
      toast("Removed from Do-Not-Contact list");
    } catch {}
  }
}

// --- Mailbox Account Actions ---
export async function syncMailbox(accountId: string) {
  toast("Syncing emails...");
  if (!isMockMode()) {
    try {
      const res = await api.post(`/accounts/${accountId}/sync`);
      toast(`Sync complete: ${res.data?.synced ?? 0} new messages`);
      await loadInitialData();
    } catch (err: any) {
      toast(err.response?.data?.error?.message || "Sync failed", "err");
    }
  } else {
    setTimeout(() => toast("Sync complete"), 1000);
  }
}

export async function deleteMailbox(accountId: string) {
  set((s) => ({ accounts: s.accounts.filter((a) => a.id !== accountId) }));
  if (!isMockMode()) {
    try {
      await api.delete(`/accounts/${accountId}`);
      toast("Mailbox disconnected");
    } catch {}
  } else {
    toast("Mailbox disconnected");
  }
}

// --- Dedicated HR Inbox Actions ---
export async function fetchHRInbox(filter = "all", q?: string, page = 1) {
  if (isMockMode()) return null;
  try {
    const params: any = { filter, page };
    if (q && q.trim()) params.q = q.trim();
    const res = await api.get("/hr-inbox", { params });
    set(() => ({
      hrInbox: res.data.items || [],
      hrCounts: res.data.counts || { all: 0, hr: 0, interviews: 0, applications: 0, rejections: 0, unread: 0, review: 0 },
      hrUnreadCount: res.data.counts?.unread || 0,
    }));
    return res.data;
  } catch (err) {
    console.warn("fetchHRInbox failed", err);
    return null;
  }
}

export async function markHREmailRead(emailId: string, isRead: boolean) {
  set((s) => ({
    hrInbox: s.hrInbox.map((item) => (item.id === emailId ? { ...item, is_read: isRead } : item)),
    hrUnreadCount: Math.max(0, s.hrUnreadCount + (isRead ? -1 : 1)),
  }));
  if (!isMockMode()) {
    try {
      await api.patch(`/hr-inbox/${emailId}/read`, { is_read: isRead });
    } catch (err) {
      console.warn("markHREmailRead failed", err);
    }
  }
}

export async function reclassifyHREmail(emailId: string, category: string, isRelevant?: boolean) {
  try {
    const res = await api.patch(`/hr-inbox/${emailId}/reclassify`, { category, is_relevant: isRelevant });
    toast("Email classification updated!");
    await fetchHRInbox();
    return res.data;
  } catch (err: any) {
    toast(err?.response?.data?.detail || "Failed to update classification", "err");
    throw err;
  }
}

export async function replyHREmail(emailId: string, bodyHtml: string, subject?: string) {
  try {
    const res = await api.post(`/hr-inbox/${emailId}/reply`, { body_html: bodyHtml, subject });
    toast("Reply sent via Gmail!");
    return res.data;
  } catch (err: any) {
    toast(err?.response?.data?.detail || "Failed to send reply", "err");
    throw err;
  }
}

export async function syncHRInbox() {
  toast("Syncing HR emails from Gmail...");
  try {
    const res = await api.post("/hr-inbox/sync");
    toast(`Sync finished: ${res.data.synced_new} new, ${res.data.backfilled} processed`);
    await fetchHRInbox();
    return res.data;
  } catch (err: any) {
    toast(err?.response?.data?.detail || "Gmail sync failed", "err");
    throw err;
  }
}

export async function setDefaultMailbox(accountId: string) {
  set((s) => ({ accounts: s.accounts.map((a) => ({ ...a, isDefault: a.id === accountId })) }));
  if (!isMockMode()) {
    try {
      await api.patch(`/accounts/${accountId}/default`);
      toast("Default mailbox updated");
    } catch {}
  }
}

// --- Role-Based Resumes Actions ---
export async function uploadRoleResume(file: File, role: string, isDefault = false, notes = ""): Promise<RoleResume> {
  toast(`Uploading ${file.name} for ${role}...`);
  const formData = new FormData();
  formData.append("file", file);
  formData.append("role", role);
  formData.append("is_default", String(isDefault));
  if (notes) formData.append("notes", notes);

  try {
    const res = await api.post("/role-resumes/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    const newDoc: RoleResume = res.data;
    set((s) => ({
      roleResumes: [
        newDoc,
        ...s.roleResumes.filter((r) => r.id !== newDoc.id).map((r) =>
          isDefault && r.role.toLowerCase() === role.toLowerCase() ? { ...r, isDefault: false } : r
        )
      ]
    }));
    toast(`Resume uploaded for ${role}!`);
    return newDoc;
  } catch (err: any) {
    const msg = err.response?.data?.error?.message || err.response?.data?.detail || "Upload failed";
    toast(msg, "err");
    throw err;
  }
}

export async function deleteRoleResume(id: string) {
  try {
    await api.delete(`/role-resumes/${id}`);
    set((s) => ({
      roleResumes: s.roleResumes.filter((r) => r.id !== id)
    }));
    toast("Resume deleted");
  } catch (err: any) {
    toast(err.response?.data?.error?.message || "Failed to delete resume", "err");
  }
}

export async function setDefaultRoleResume(id: string) {
  try {
    await api.patch(`/role-resumes/${id}/default`);
    set((s) => {
      const target = s.roleResumes.find((x) => x.id === id);
      return {
        roleResumes: s.roleResumes.map((r) => {
          if (r.id === id) return { ...r, isDefault: true };
          if (target && r.role.toLowerCase() === target.role.toLowerCase()) return { ...r, isDefault: false };
          return r;
        })
      };
    });
    toast("Default resume updated for this role");
  } catch (err: any) {
    toast(err.response?.data?.error?.message || "Failed to set default", "err");
  }
}

export async function fetchRoleResumes() {
  try {
    const res = await api.get("/role-resumes");
    set(() => ({ roleResumes: res.data }));
  } catch (err) {
    console.warn("Failed fetching role resumes", err);
  }
}

// --- Apply Studio Actions ---

export async function fetchApplyMetrics() {
  try {
    const res = await api.get("/apply/metrics");
    set(() => ({ applyMetrics: res.data }));
    return res.data;
  } catch (err) {
    console.warn("Failed fetching apply metrics", err);
  }
}

export async function fetchJobPosters() {
  try {
    const res = await api.get("/apply/jobs");
    const posters: JobPoster[] = res.data.items || [];
    set(() => ({ posters }));
    return posters;
  } catch (err) {
    console.warn("Failed fetching job posters", err);
  }
}

export async function uploadJobPoster(file: File, autoAnalyze = false): Promise<JobPoster> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("auto_analyze", autoAnalyze ? "true" : "false");

  try {
    const res = await api.post("/apply/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    const raw = res.data;
    const posterId = raw.id || raw._id || "poster";
    const poster: JobPoster = { ...raw, id: posterId };
    set((s) => ({ posters: [poster, ...s.posters.filter((p) => p.id !== poster.id)] }));
    toast(autoAnalyze ? "Job poster uploaded & analyzed!" : "Job poster uploaded!");
    return poster;
  } catch (err: any) {
    const msg = err.response?.data?.detail || err.response?.data?.error?.message || "Upload failed";
    toast(msg, "err");
    throw err;
  }
}

export async function analyzeJobPoster(id: string): Promise<JobPoster> {
  const safeId = id || "current";
  try {
    const res = await api.post(`/apply/jobs/${safeId}/analyze`);
    const raw = res.data;
    const updated: JobPoster = { ...raw, id: raw.id || raw._id || safeId };
    set((s) => ({
      posters: s.posters.map((p) => (p.id === safeId ? updated : p))
    }));
    toast("Job poster analyzed successfully!");
    return updated;
  } catch (err: any) {
    const msg = err.response?.data?.detail || err.response?.data?.error?.message || "Analysis failed";
    toast(msg, "err");
    throw err;
  }
}

export async function generateJdForPoster(id: string, extractedData?: ExtractedJobDetails) {
  const safeId = id || "current";
  try {
    const res = await api.post(`/apply/jobs/${safeId}/generate-jd`, { extracted_data: extractedData });
    const jd: string = res.data.generated_jd;
    set((s) => ({
      posters: s.posters.map((p) => (p.id === safeId ? { ...p, generated_jd: jd } : p))
    }));
    toast("Job description generated!");
    return jd;
  } catch (err: any) {
    toast(err.response?.data?.detail || "Failed generating JD", "err");
    throw err;
  }
}

export async function matchResumesForPoster(id: string, extractedData?: ExtractedJobDetails): Promise<ResumeMatchScore[]> {
  const safeId = id || "current";
  try {
    const res = await api.post(`/apply/jobs/${safeId}/match-resume`, { extracted_data: extractedData });
    return res.data.matches || [];
  } catch (err: any) {
    toast(err.response?.data?.detail || "Failed matching resumes", "err");
    return [];
  }
}

export async function generateEmailForPoster(id: string, params: { extractedData?: ExtractedJobDetails; resumeId?: string; tone?: string }) {
  const safeId = id || "current";
  try {
    const res = await api.post(`/apply/jobs/${safeId}/generate-email`, {
      extracted_data: params.extractedData,
      resume_id: params.resumeId,
      tone: params.tone || "formal"
    });
    return res.data;
  } catch (err: any) {
    toast(err.response?.data?.detail || "Failed generating email", "err");
    throw err;
  }
}

export async function sendPosterApplication(id: string, payload: {
  toEmail: string;
  subject: string;
  bodyHtml: string;
  resumeId?: string;
  extractedData?: ExtractedJobDetails;
  generatedJd?: string;
}) {
  const safeId = id || "current";
  try {
    const res = await api.post(`/apply/jobs/${safeId}/send`, {
      to_email: payload.toEmail,
      subject: payload.subject,
      body_html: payload.bodyHtml,
      resume_id: payload.resumeId,
      extracted_data: payload.extractedData,
      generated_jd: payload.generatedJd
    });
    toast("Application sent via Gmail!");
    // Refresh apps and metrics
    fetchApplications();
    fetchApplyMetrics();
    return res.data;
  } catch (err: any) {
    const msg = err.response?.data?.detail || err.response?.data?.error?.message || "Failed to send application";
    toast(msg, "err");
    throw err;
  }
}

export async function triggerFollowUp(appId: string, autoSend = false) {
  try {
    const res = await api.post(`/applications/${appId}/follow-up?auto_send=${autoSend}`);
    if (res.data.sent) {
      toast("Follow-up email sent via Gmail!");
      fetchApplications();
    } else {
      toast("Follow-up draft prepared!");
    }
    return res.data;
  } catch (err: any) {
    toast(err.response?.data?.detail || "Failed to send follow-up", "err");
    throw err;
  }
}

export async function fetchWorkflows(): Promise<AutomationWorkflow[]> {
  try {
    const res = await api.get("/workflows");
    const workflows: AutomationWorkflow[] = res.data || [];
    set(() => ({ workflows }));
    return workflows;
  } catch (err) {
    console.warn("Failed fetching workflows", err);
    return [];
  }
}

export async function saveWorkflow(wf: Partial<AutomationWorkflow> & { id?: string }): Promise<AutomationWorkflow> {
  try {
    let res;
    if (wf.id) {
      res = await api.put(`/workflows/${wf.id}`, wf);
    } else {
      res = await api.post("/workflows", wf);
    }
    const saved: AutomationWorkflow = res.data;
    set((s) => ({
      workflows: s.workflows.some((w) => w.id === saved.id)
        ? s.workflows.map((w) => (w.id === saved.id ? saved : w))
        : [saved, ...s.workflows]
    }));
    toast("Workflow saved successfully!");
    return saved;
  } catch (err: any) {
    toast(err.response?.data?.detail || "Failed to save workflow", "err");
    throw err;
  }
}

export async function toggleWorkflowActive(id: string, activate: boolean) {
  try {
    const endpoint = activate ? `/workflows/${id}/activate` : `/workflows/${id}/deactivate`;
    await api.post(endpoint);
    set((s) => ({
      workflows: s.workflows.map((w) => (w.id === id ? { ...w, is_active: activate } : w))
    }));
    toast(activate ? "Workflow activated!" : "Workflow deactivated!");
  } catch (err: any) {
    toast(err.response?.data?.detail || "Failed to update workflow state", "err");
  }
}

export async function executeWorkflow(workflowId: string, posterId?: string, isTest = false, executionMode?: "syn" | "asyn"): Promise<WorkflowExecution> {
  try {
    const mode = executionMode || (localStorage.getItem("jobmail_exec_mode") as any) || "syn";
    const res = await api.post(`/workflows/${workflowId}/execute`, {
      job_poster_id: posterId,
      is_test_run: isTest,
      execution_mode: mode
    });
    const exec: WorkflowExecution = res.data;
    if (exec.status === "completed") {
      toast(isTest ? "Test simulation completed successfully!" : "Workflow executed successfully!");
    } else if (exec.status === "manual_review") {
      toast("Safety check triggered: Routed to Manual Review Queue", "ok");
    } else {
      toast(`Workflow ${exec.status}: ${exec.error_message || ""}`, "err");
    }
    fetchApplyMetrics();
    fetchApplications();
    return exec;
  } catch (err: any) {
    const msg = err.response?.data?.detail || "Workflow execution failed";
    toast(msg, "err");
    throw err;
  }
}
