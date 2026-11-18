import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login, signup } from "@/lib/store";

export default function Auth({ mode }: { mode: "login" | "signup" }) {
  const nav = useNavigate();
  const [f, setF] = useState({ name: "", email: "", password: "", org: "" });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

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
      <form onSubmit={submit} className="card w-full max-w-sm space-y-3">
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
        <button className="btn w-full" disabled={loading}>
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
  );
}
