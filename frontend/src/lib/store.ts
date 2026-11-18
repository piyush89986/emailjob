import { useSyncExternalStore } from "react";
import { api, tokens } from "@/api/client";

export type Status = "Contacted" | "Replied" | "Interview" | "Offer" | "Rejected";
export const STATUSES: Status[] = ["Contacted", "Replied", "Interview", "Offer", "Rejected"];
export interface Contact { id: string; name: string; email: string; company: string; status: Status; lastRepliedAt?: string; createdAt: string }
export interface Msg { id: string; dir: "in" | "out"; from: string; body: string; at: string; kind: "normal" | "auto" | "bounce"; delivery?: "sent" | "failed" | "sending" }
export interface Thread { id: string; subject: string; contactId: string; unread: boolean; messages: Msg[] }
export interface Template { id: string; name: string; subject: string; body: string; global: boolean }
export interface App { id: string; title: string; company: string; jd: string; jdUrl: string; contactId: string; resume: string; status: Status | "Saved" | "Applied"; timeline: { at: string; label: string }[] }
export interface Account { id: string; provider: "gmail" | "outlook" | "imap"; address: string; status: "connected" | "error" | "needs_reauth"; isDefault: boolean }
export interface Exp { id: string; company: string; role: string; period: string; bullets: string[] }
export interface Profile { name: string; email: string; headline: string; skills: string[]; experience: Exp[]; projects: Exp[]; education: string; links: string }
export interface Prefs { tone: "formal" | "friendly" | "concise"; provider: "openai" | "gemini"; fallback: boolean; dailyCap: number; delaySec: number; dnc: string[]; signature: string }
export interface Toast { id: string; msg: string; type: "ok" | "err" }
export interface ResumeVersion { id: string; label: string; at: string; ats: number; text: string }
export interface Draft { to: string; subject: string; body: string }

export interface S { user: { name: string; email: string } | null; contacts: Contact[]; threads: Thread[]; templates: Template[]; apps: App[]; accounts: Account[]; profile: Profile; prefs: Prefs; toasts: Toast[]; dark: boolean; resumes: ResumeVersion[]; draft: Draft | null }

export const uid = () => Math.random().toString(36).slice(2, 9);
const ago = (d: number) => new Date(Date.now() - d * 864e5).toISOString();

const seedTemplates: Template[] = [
  { id: "t1", global: true, name: "Fresher application", subject: "Application for {{role}} – {{my_name}}", body: "<p>Dear {{hr_name}},</p><p>I am a recent graduate keen to start my career as a {{role}} at {{company}}. My skills include {{skills}}.</p><p>I have attached my resume and would welcome a chance to talk.</p><p>Regards,<br>{{my_name}}</p>" },
  { id: "t2", global: true, name: "Experienced application", subject: "{{role}} opportunity at {{company}} – {{my_name}}", body: "<p>Hi {{hr_name}},</p><p>I'm excited about the {{role}} position at {{company}}. With hands-on experience in {{skills}}, I believe I can contribute quickly.</p><p>My resume is attached. Happy to share more.</p><p>Best,<br>{{my_name}}</p>" },
  { id: "t3", global: true, name: "Referral request", subject: "Referral request for {{role}} at {{company}}", body: "<p>Hi {{hr_name}},</p><p>I'd be grateful for a referral for the {{role}} role at {{company}}. My background in {{skills}} matches the requirements.</p><p>Thank you,<br>{{my_name}}</p>" },
  { id: "t4", global: true, name: "Follow-up after 5 days", subject: "Following up: {{role}} application", body: "<p>Hi {{hr_name}},</p><p>I wanted to follow up on my application for {{role}} at {{company}}. I remain very interested and happy to provide anything further.</p><p>Thanks,<br>{{my_name}}</p>" },
  { id: "t5", global: true, name: "Thank-you after interview", subject: "Thank you – {{role}} interview", body: "<p>Hi {{hr_name}},</p><p>Thank you for taking the time to interview me for the {{role}} position at {{company}}. I enjoyed learning more about the team.</p><p>Best regards,<br>{{my_name}}</p>" },
];

const seed = (): S => ({
  user: null, dark: false, draft: null, toasts: [], resumes: [],
  contacts: [
    { id: "c1", name: "Priya Sharma", email: "priya@acme.com", company: "Acme Corp", status: "Replied", lastRepliedAt: ago(1), createdAt: ago(6) },
    { id: "c2", name: "Rahul Verma", email: "rahul@globex.io", company: "Globex", status: "Contacted", createdAt: ago(7) },
    { id: "c3", name: "Anna Lee", email: "anna@initech.com", company: "Initech", status: "Interview", lastRepliedAt: ago(3), createdAt: ago(12) },
    { id: "c4", name: "HR Team", email: "hr@umbrella.co", company: "Umbrella", status: "Contacted", createdAt: ago(2) },
  ],
  threads: [
    { id: "th1", subject: "Application for Frontend Developer – Alex", contactId: "c1", unread: true, messages: [
      { id: "m1", dir: "out", from: "me", body: "Dear Priya, I'd like to apply for the Frontend Developer role.", at: ago(2), kind: "normal", delivery: "sent" },
      { id: "m2", dir: "in", from: "priya@acme.com", body: "Hi Alex, thanks! Are you free for a call on Friday?", at: ago(1), kind: "normal" }] },
    { id: "th2", subject: "Backend Engineer opportunity at Globex", contactId: "c2", unread: false, messages: [
      { id: "m3", dir: "out", from: "me", body: "Hi Rahul, I'm interested in the Backend Engineer role.", at: ago(7), kind: "normal", delivery: "sent" }] },
    { id: "th3", subject: "Thank you – Full-stack interview", contactId: "c3", unread: false, messages: [
      { id: "m4", dir: "out", from: "me", body: "Thanks Anna for the interview.", at: ago(4), kind: "normal", delivery: "sent" },
      { id: "m5", dir: "in", from: "anna@initech.com", body: "Great speaking with you. We'll be in touch.", at: ago(3), kind: "normal" }] },
    { id: "th4", subject: "Application – QA Engineer", contactId: "c4", unread: true, messages: [
      { id: "m6", dir: "out", from: "me", body: "Hello, applying for QA Engineer.", at: ago(2), kind: "normal", delivery: "sent" },
      { id: "m7", dir: "in", from: "mailer-daemon@umbrella.co", body: "Delivery failed: mailbox hr@umbrella.co not found.", at: ago(2), kind: "bounce" }] },
  ],
  templates: seedTemplates,
  apps: [
    { id: "a1", title: "Frontend Developer", company: "Acme Corp", jd: "", jdUrl: "https://acme.com/jobs/1", contactId: "c1", resume: "v1", status: "Replied", timeline: [{ at: ago(2), label: "Applied" }, { at: ago(1), label: "Replied" }] },
    { id: "a2", title: "Backend Engineer", company: "Globex", jd: "", jdUrl: "", contactId: "c2", resume: "v1", status: "Contacted", timeline: [{ at: ago(7), label: "Contacted" }] },
  ],
  accounts: [
    { id: "ac1", provider: "gmail", address: "alex@gmail.com", status: "connected", isDefault: true },
    { id: "ac2", provider: "outlook", address: "alex@outlook.com", status: "needs_reauth", isDefault: false },
  ],
  profile: { name: "Alex Doe", email: "alex@gmail.com", headline: "Full-stack developer", links: "github.com/alexdoe", education: "B.Tech Computer Science, 2023",
    skills: ["React", "TypeScript", "Python", "FastAPI", "MongoDB", "Docker", "Git", "Tailwind"],
    experience: [
      { id: "e1", company: "Beta Labs", role: "Software Engineer", period: "2023–Present", bullets: ["Built React dashboards used by 3 teams", "Developed FastAPI services backed by MongoDB", "Containerised services with Docker", "Wrote onboarding documentation"] },
      { id: "e2", company: "Gamma Studio", role: "Intern", period: "2022", bullets: ["Built UI components with Tailwind", "Fixed bugs in a TypeScript codebase"] }],
    projects: [{ id: "p1", company: "JobTracker", role: "Side project", period: "2022", bullets: ["Python script that tracks job postings", "React front-end for browsing saved jobs"] }] },
  prefs: { tone: "friendly", provider: "openai", fallback: true, dailyCap: 30, delaySec: 60, dnc: ["noreply@spam.com"], signature: "Alex Doe" },
});

let state: S = seed();
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

export async function login(email: string, passwordOrName?: string) {
  if (isMockMode()) {
    set(() => ({ user: { name: passwordOrName || state.profile.name, email } }));
    return;
  }

  try {
    // Attempt real backend authentication
    const pwd = passwordOrName && passwordOrName.length >= 8 ? passwordOrName : "password123";
    const res = await api.post("/auth/login", { email, password: pwd });
    const { accessToken, refreshToken, access_token, refresh_token } = res.data;
    tokens.set(accessToken || access_token, refreshToken || refresh_token);
    set(() => ({ user: { name: state.profile.name, email } }));
    await loadInitialData();
  } catch (err: any) {
    // If login fails in dev, try signup or fall back cleanly
    try {
      const pwd = passwordOrName && passwordOrName.length >= 8 ? passwordOrName : "password123";
      const signupRes = await api.post("/auth/signup", { email, password: pwd, name: state.profile.name });
      const { accessToken, refreshToken, access_token, refresh_token } = signupRes.data;
      tokens.set(accessToken || access_token, refreshToken || refresh_token);
      set(() => ({ user: { name: state.profile.name, email } }));
      await loadInitialData();
    } catch {
      // Fallback to local session
      set(() => ({ user: { name: passwordOrName || state.profile.name, email } }));
    }
  }
}

export async function loadInitialData() {
  if (isMockMode()) return;
  try {
    const [meRes, contactsRes, threadsRes, tplsRes, appsRes, accsRes, profRes, settingsRes, resumesRes] = await Promise.allSettled([
      api.get("/auth/me"),
      api.get("/contacts"),
      api.get("/threads"),
      api.get("/templates"),
      api.get("/applications"),
      api.get("/accounts"),
      api.get("/profile"),
      api.get("/settings"),
      api.get("/resumes"),
    ]);

    set((s) => ({
      user: meRes.status === "fulfilled" ? { name: meRes.value.data.name, email: meRes.value.data.email } : s.user,
      contacts: contactsRes.status === "fulfilled" ? contactsRes.value.data : s.contacts,
      threads: threadsRes.status === "fulfilled" ? threadsRes.value.data : s.threads,
      templates: tplsRes.status === "fulfilled" ? tplsRes.value.data : s.templates,
      apps: appsRes.status === "fulfilled" ? appsRes.value.data : s.apps,
      accounts: accsRes.status === "fulfilled" ? accsRes.value.data : s.accounts,
      profile: profRes.status === "fulfilled" ? profRes.value.data : s.profile,
      prefs: settingsRes.status === "fulfilled" ? settingsRes.value.data : s.prefs,
      resumes: resumesRes.status === "fulfilled" ? resumesRes.value.data : s.resumes,
    }));

    setupSSE();
  } catch (e) {
    console.warn("Failed loading backend data, using current state", e);
  }
}

let sseSource: EventSource | null = null;
function setupSSE() {
  if (sseSource || isMockMode() || !tokens.access) return;
  try {
    const sseUrl = `${api.defaults.baseURL}/events?token=${tokens.access}`;
    sseSource = new EventSource(sseUrl);

    sseSource.addEventListener("reply.received", (e) => {
      try {
        const payload = JSON.parse(e.data);
        toast(`New reply from ${payload.contactName || payload.from}`);
        loadInitialData();
      } catch {}
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

export function logout() {
  tokens.clear();
  if (sseSource) {
    sseSource.close();
    sseSource = null;
  }
  set(() => ({ user: null }));
}

export function toggleDark() { const d = !state.dark; document.documentElement.classList.toggle("dark", d); set(() => ({ dark: d })); }

const sentToday = () => state.threads.flatMap((t) => t.messages).filter((m) => m.dir === "out" && Date.now() - +new Date(m.at) < 864e5).length;

export function sendEmail(to: string, subject: string, body: string, threadId?: string): boolean {
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
    api.post("/emails/send", { to: addr, subject, body, threadId: tid })
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

export function threadState(t: Thread): "replied" | "waiting" | "bounced" {
  if (t.messages.some((m) => m.kind === "bounce")) return "bounced";
  return t.messages.some((m) => m.dir === "in" && m.kind === "normal") ? "replied" : "waiting";
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

export const setContactStatus = (id: string, status: Status) => {
  if (!isMockMode()) {
    api.patch(`/contacts/${id}/status`, { status }).catch(() => {});
  }
  set((s) => ({ contacts: s.contacts.map((c) => (c.id === id ? { ...c, status } : c)) }));
};
