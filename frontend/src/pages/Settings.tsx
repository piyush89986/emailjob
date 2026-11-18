import { useState } from "react";
import {
  Account,
  Prefs,
  savePrefs,
  addDnc,
  removeDnc,
  syncMailbox,
  deleteMailbox,
  setDefaultMailbox,
  set,
  toast,
  useS,
  loadInitialData
} from "@/lib/store";
import { api, getApiBaseUrl, setApiBaseUrl } from "@/api/client";
import { Badge, Page, Tabs } from "@/components/ui";
import { ProfileEditor } from "./ResumeBuilder";

const providers: { id: Account["provider"]; name: string; desc: string }[] = [
  { id: "gmail", name: "Gmail", desc: "Google OAuth 2.0 (read & send permissions)" },
  { id: "outlook", name: "Outlook / Microsoft 365", desc: "Microsoft Graph OAuth" },
  { id: "imap", name: "Other (IMAP/SMTP)", desc: "Host, port, app password" }
];

function Accounts() {
  const accounts = useS((s) => s.accounts);
  const [imap, setImap] = useState(false);
  const [f, setF] = useState({ host: "", port: "993", ssl: true, user: "", pass: "" });
  const [testing, setTesting] = useState(false);
  const [tested, setTested] = useState<"ok" | "fail" | "">("");

  const connectOAuth = async (provider: "gmail" | "outlook") => {
    try {
      toast(`Initiating ${provider} login...`);
      const res = await api.get(`/accounts/oauth/${provider}/start`);
      if (res.data?.url) {
        window.location.href = res.data.url;
      }
    } catch (err: any) {
      toast(err.response?.data?.error?.message || "OAuth start failed. Check provider credentials in backend .env.", "err");
    }
  };

  const testConnection = async () => {
    if (!f.host || !f.user || !f.pass) {
      setTested("fail");
      return;
    }
    setTesting(true);
    setTested("");
    try {
      const res = await api.post("/accounts/imap/test", {
        host: f.host,
        port: parseInt(f.port) || 993,
        ssl: f.ssl,
        user: f.user,
        pass: f.pass
      });
      setTested(res.data?.tested ? "ok" : "fail");
    } catch {
      setTested("fail");
    } finally {
      setTesting(false);
    }
  };

  const saveImap = async () => {
    try {
      const res = await api.post("/accounts/imap", {
        host: f.host,
        port: parseInt(f.port) || 993,
        ssl: f.ssl,
        user: f.user,
        pass: f.pass
      });
      set((s) => ({ accounts: [...s.accounts, res.data] }));
      setImap(false);
      setF({ host: "", port: "993", ssl: true, user: "", pass: "" });
      setTested("");
      toast("IMAP account connected successfully");
      await loadInitialData();
    } catch (err: any) {
      toast(err.response?.data?.error?.message || "Failed to connect IMAP account", "err");
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        {providers.map((p) => (
          <div key={p.id} className="card">
            <div className="font-medium">{p.name}</div>
            <div className="text-xs text-slate-500">{p.desc}</div>
            <button
              className="btn mt-3"
              onClick={() => (p.id === "imap" ? setImap(true) : connectOAuth(p.id))}
            >
              Connect
            </button>
          </div>
        ))}
      </div>

      {imap && (
        <div className="card grid gap-2 md:grid-cols-2">
          <input
            className="input"
            placeholder="IMAP host (e.g. imap.mail.me.com)"
            value={f.host}
            onChange={(e) => setF({ ...f, host: e.target.value })}
          />
          <input
            className="input"
            placeholder="Port (default: 993)"
            value={f.port}
            onChange={(e) => setF({ ...f, port: e.target.value })}
          />
          <input
            className="input"
            placeholder="Username / Email"
            value={f.user}
            onChange={(e) => setF({ ...f, user: e.target.value })}
          />
          <input
            className="input"
            type="password"
            placeholder="App password"
            value={f.pass}
            onChange={(e) => setF({ ...f, pass: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={f.ssl}
              onChange={(e) => setF({ ...f, ssl: e.target.checked })}
            />{" "}
            Use SSL/TLS
          </label>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={testConnection} disabled={testing}>
              {testing ? "Testing..." : "Test connection"}
            </button>
            <button className="btn" disabled={tested !== "ok"} onClick={saveImap}>
              Save & Connect
            </button>
          </div>
          {tested && (
            <p
              className={`text-sm md:col-span-2 ${
                tested === "ok" ? "text-green-600" : "text-red-600"
              }`}
            >
              {tested === "ok" ? "Connection successful!" : "Connection failed. Please check host, username and app password."}
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        {accounts.length === 0 ? (
          <div className="card text-sm text-slate-500">No email accounts connected yet. Connect your Gmail, Outlook, or IMAP to send and receive job emails.</div>
        ) : (
          accounts.map((a) => (
            <div key={a.id} className="card flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-medium">{a.address}</div>
                <div className="text-xs text-slate-500 capitalize">{a.provider}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge v={a.status} />
                {a.isDefault && <span className="badge bg-indigo-100 text-indigo-800">Default</span>}
                <button className="btn-ghost text-xs" onClick={() => syncMailbox(a.id)}>
                  Sync mails
                </button>
                {a.status !== "connected" && (
                  <button className="btn" onClick={() => (a.provider === "imap" ? setImap(true) : connectOAuth(a.provider))}>
                    Reconnect
                  </button>
                )}
                {!a.isDefault && (
                  <button className="btn-ghost text-xs" onClick={() => setDefaultMailbox(a.id)}>
                    Make default
                  </button>
                )}
                <button className="btn-ghost text-xs text-red-600" onClick={() => deleteMailbox(a.id)}>
                  Disconnect
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function Settings() {
  const [tab, setTab] = useState("Email accounts");
  const prefs = useS((s) => s.prefs);
  const state = useS((s) => s);
  const [dnc, setDnc] = useState("");
  const [apiUrl, setApiUrl] = useState(getApiBaseUrl());

  const handleSaveApiUrl = () => {
    setApiBaseUrl(apiUrl);
    toast("Backend API URL saved");
    loadInitialData();
  };

  const exportData = async () => {
    try {
      const res = await api.get("/account/export");
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `jobmail-export-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
    } catch {
      // Fallback export local state
      const { user, contacts, threads, templates, apps, profile, prefs } = state;
      const b = new Blob([JSON.stringify({ user, contacts, threads, templates, apps, profile, prefs }, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = "jobmail-export.json";
      a.click();
    }
  };

  const deleteAccountData = async () => {
    if (!confirm("Are you sure? This will disconnect all mailboxes and delete all your job applications, threads, and contacts.")) {
      return;
    }
    try {
      await api.delete("/account/data");
      set(() => ({ accounts: [], threads: [], contacts: [], apps: [], resumes: [] }));
      toast("Account data deleted");
      await loadInitialData();
    } catch (err: any) {
      toast(err.response?.data?.error?.message || "Failed to delete account data", "err");
    }
  };

  return (
    <Page title="Settings">
      <Tabs
        tabs={["Email accounts", "Profile", "AI preferences", "Sending limits", "Do-not-contact", "Account", "API Config"]}
        value={tab}
        onChange={setTab}
      />

      {tab === "Email accounts" && <Accounts />}
      {tab === "Profile" && <ProfileEditor />}

      {tab === "AI preferences" && (
        <div className="card max-w-md space-y-3">
          <div>
            <label className="label">Default tone</label>
            <select
              className="input"
              value={prefs.tone}
              onChange={(e) => savePrefs({ tone: e.target.value as Prefs["tone"] })}
            >
              {["formal", "friendly", "concise"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Primary AI provider</label>
            <select
              className="input"
              value={prefs.provider}
              onChange={(e) => savePrefs({ provider: e.target.value as Prefs["provider"] })}
            >
              <option value="openai">OpenAI (GPT-4o mini)</option>
              <option value="gemini">Google Gemini (Gemini 2.5 Flash)</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={prefs.fallback}
              onChange={(e) => savePrefs({ fallback: e.target.checked })}
            />{" "}
            Fall back to the other provider on failure
          </label>
        </div>
      )}

      {tab === "Sending limits" && (
        <div className="card max-w-md space-y-3">
          <div>
            <label className="label">Daily send cap</label>
            <input
              type="number"
              min={1}
              max={100}
              className="input"
              value={prefs.dailyCap}
              onChange={(e) => savePrefs({ dailyCap: +e.target.value })}
            />
          </div>
          <div>
            <label className="label">Delay between sends (seconds)</label>
            <input
              type="number"
              min={0}
              className="input"
              value={prefs.delaySec}
              onChange={(e) => savePrefs({ delaySec: +e.target.value })}
            />
          </div>
          <div>
            <label className="label">Default email signature</label>
            <input
              className="input"
              placeholder="Your name or sign-off"
              value={prefs.signature}
              onChange={(e) => savePrefs({ signature: e.target.value })}
            />
          </div>
          <p className="text-xs text-slate-500">
            Limits protect your mailbox domain reputation. Bulk cold-emailing is prohibited.
          </p>
        </div>
      )}

      {tab === "Do-not-contact" && (
        <div className="card max-w-md space-y-2">
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="email@company.com"
              value={dnc}
              onChange={(e) => setDnc(e.target.value)}
            />
            <button
              className="btn"
              onClick={() => {
                if (dnc) {
                  addDnc(dnc);
                  setDnc("");
                }
              }}
            >
              Add
            </button>
          </div>
          {prefs.dnc.length === 0 ? (
            <p className="text-xs text-slate-500">No addresses on your Do-Not-Contact list.</p>
          ) : (
            prefs.dnc.map((d) => (
              <div key={d} className="flex justify-between text-sm py-1 border-b border-slate-100 dark:border-slate-800">
                <span>{d}</span>
                <button className="text-red-600 text-xs" onClick={() => removeDnc(d)}>
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "Account" && (
        <div className="card max-w-md space-y-3">
          <p className="text-sm">Signed in as <b>{state.user?.email}</b></p>
          <div className="flex flex-col gap-2">
            <button className="btn-ghost text-left" onClick={exportData}>
              Export my data (JSON)
            </button>
            <button className="btn-ghost text-left text-red-600" onClick={deleteAccountData}>
              Delete my data & disconnect all mailboxes
            </button>
          </div>
        </div>
      )}

      {tab === "API Config" && (
        <div className="card max-w-md space-y-3">
          <h2 className="font-medium text-sm">Backend Connection URL</h2>
          <p className="text-xs text-slate-500">
            Current API endpoint URL that this frontend calls. Defaults to localhost:8000 or your Render backend URL.
          </p>
          <input
            className="input"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="https://emailjob.onrender.com or http://localhost:8000"
          />
          <div className="flex gap-2">
            <button className="btn" onClick={handleSaveApiUrl}>Save URL</button>
            <button className="btn-ghost" onClick={() => { setApiUrl("http://localhost:8000"); setApiBaseUrl("http://localhost:8000"); }}>Reset to Localhost</button>
          </div>
        </div>
      )}
    </Page>
  );
}
