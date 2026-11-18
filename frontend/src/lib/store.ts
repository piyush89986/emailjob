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

const emptyState = (): S => ({
  user: null,
  dark: false,
  draft: null,
  toasts: [],
  resumes: [],
  contacts: [],
  threads: [],
  templates: [],
  apps: [],
  accounts: [],
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

export async function login(email: string, password?: string) {
  if (isMockMode()) {
    set(() => ({ user: { name: email.split("@")[0], email } }));
    return;
  }
  const res = await api.post("/auth/login", { email, password: password || "" });
  const { accessToken, refreshToken, access_token, refresh_token } = res.data;
  tokens.set(accessToken || access_token, refreshToken || refresh_token);
  await loadInitialData();
}

export async function signup(email: string, password: string, name: string, org?: string) {
  if (isMockMode()) {
    set(() => ({ user: { name: name || email.split("@")[0], email } }));
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

if (typeof window !== "undefined" && tokens.access) {
  loadInitialData();
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
