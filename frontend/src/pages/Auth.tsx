import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "@/lib/store";

export default function Auth({ mode }: { mode: "login" | "signup" }) {
  const nav = useNavigate(); const [f, setF] = useState({ name: "", email: "", password: "", org: "" }); const [err, setErr] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!/\S+@\S+\.\S+/.test(f.email)) return setErr("Enter a valid email");
    if (f.password.length < 8) return setErr("Password must be at least 8 characters");
    login(f.email, f.name); nav("/");
  };
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950 dark:text-slate-100">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-3">
        <h1 className="text-xl font-semibold">{mode === "login" ? "Log in" : "Create your account"}</h1>
        {mode === "signup" && <><div><label className="label">Full name</label><input className="input" value={f.name} onChange={set("name")} required /></div>
          <div><label className="label">Workspace name</label><input className="input" value={f.org} onChange={set("org")} /></div></>}
        <div><label className="label">Email</label><input className="input" type="email" value={f.email} onChange={set("email")} required /></div>
        <div><label className="label">Password</label><input className="input" type="password" value={f.password} onChange={set("password")} required /></div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button className="btn w-full">{mode === "login" ? "Log in" : "Sign up"}</button>
        <p className="text-sm text-slate-500">{mode === "login" ? <>No account? <Link className="text-indigo-600" to="/signup">Sign up</Link></> : <>Have an account? <Link className="text-indigo-600" to="/login">Log in</Link></>}</p>
      </form>
    </div>
  );
}
