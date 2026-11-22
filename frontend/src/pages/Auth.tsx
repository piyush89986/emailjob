import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, ShieldCheck, CheckCircle2 } from "lucide-react";
import { login, signup, useS, requestPlatformAccess, toast } from "@/lib/store";
import { tokens } from "@/api/client";

export default function Auth({ mode }: { mode: "login" | "signup" }) {
  const nav = useNavigate();
  const user = useS((s) => s.user);
  const [f, setF] = useState({ name: "", email: "", password: "", org: "" });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  // Access request state
  const [accessEmail, setAccessEmail] = useState("");
  const [requestingAccess, setRequestingAccess] = useState(false);
  const [accessSuccessMsg, setAccessSuccessMsg] = useState("");

  useEffect(() => {
    if (user || tokens.access) {
      nav("/", { replace: true });
    }
  }, [user, nav]);

  const handleRequestAccess = async () => {
    const email = accessEmail.trim().toLowerCase();
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      toast("Please enter a valid email address", "err");
      return;
    }
    setRequestingAccess(true);
    setAccessSuccessMsg("");
    try {
      const res = await requestPlatformAccess(email);
      setAccessSuccessMsg(res.message || "Access request submitted! Admin has been notified.");
      setAccessEmail("");
    } catch {
      // toast in store
    } finally {
      setRequestingAccess(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/\S+@\S+\.\S+/.test(f.email)) return setErr("Enter a valid email");
    if (f.password.length < 8) return setErr("Password must be at least 8 characters");
    setErr("");
    setLoading(true);

    try {
      if (mode === "signup") {
        await signup(f.email, f.password, f.name, f.org);
      } else {
        await login(f.email, f.password);
      }
      nav("/");
    } catch (e: any) {
      const msg = e.response?.data?.error?.message || e.response?.data?.detail || e.message || "Authentication failed";
      setErr(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950 dark:text-slate-100">
      <div className="w-full max-w-sm space-y-3">
        {/* Testing Environment Beta Notice Banner */}
        <div className="rounded-2xl border border-amber-300/80 bg-amber-50/90 p-3.5 text-xs text-amber-900 shadow-xs dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
            <AlertTriangle size={15} className="shrink-0" />
            <span>Testing Environment Notice</span>
          </div>
          <p className="mt-1 leading-relaxed text-[11px] text-amber-900/90 dark:text-amber-200/90">
            Yeh application testing environment me work karti hai, isliye aap account toh bana lenge but directly use nahi kar paoge. Use karne ke liye access grant hona zaroori hai.
          </p>

          {/* Request Access Box */}
          <div className="mt-3 pt-2.5 border-t border-amber-200/80 dark:border-amber-900/50">
            <div className="flex items-center gap-1 font-semibold text-amber-900 dark:text-amber-200 text-[11px]">
              <ShieldCheck size={13} className="text-amber-700 dark:text-amber-400" />
              <span>Yaha email dalein access lene ke liye:</span>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <input
                type="email"
                value={accessEmail}
                onChange={(e) => setAccessEmail(e.target.value)}
                placeholder="Enter your email for access..."
                className="flex-1 rounded-full border border-amber-300/80 bg-white px-3 py-1 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-amber-500 dark:border-amber-900 dark:bg-slate-900 dark:text-slate-200 dark:placeholder-slate-500"
              />
              <button
                type="button"
                onClick={handleRequestAccess}
                disabled={requestingAccess || !accessEmail.trim()}
                className="rounded-full bg-amber-700 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-800 disabled:opacity-50 transition-all cursor-pointer shrink-0"
              >
                {requestingAccess ? "Submitting..." : "Request Access"}
              </button>
            </div>
            {accessSuccessMsg && (
              <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 size={13} className="shrink-0" />
                <span>{accessSuccessMsg}</span>
              </div>
            )}
          </div>
        </div>

        {/* Login / Signup Card */}
        <form onSubmit={submit} className="card space-y-3 shadow-md">
          <h1 className="text-xl font-semibold">{mode === "login" ? "Log in" : "Create your account"}</h1>
          {mode === "signup" && (
            <>
              <div>
                <label className="label">Full name</label>
                <input className="input" value={f.name} onChange={set("name")} required placeholder="Your full name" />
              </div>
              <div>
                <label className="label">Workspace name</label>
                <input className="input" value={f.org} onChange={set("org")} placeholder="e.g. My Workspace" />
              </div>
            </>
          )}
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={f.email} onChange={set("email")} required placeholder="you@domain.com" />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" value={f.password} onChange={set("password")} required placeholder="At least 8 characters" />
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button className="btn w-full rounded-full" disabled={loading}>
            {loading ? "Please wait..." : mode === "login" ? "Log in" : "Sign up"}
          </button>
          <p className="text-sm text-slate-500">
            {mode === "login" ? (
              <>No account? <Link className="text-indigo-600" to="/signup">Sign up</Link></>
            ) : (
              <>Have an account? <Link className="text-indigo-600" to="/login">Log in</Link></>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}
