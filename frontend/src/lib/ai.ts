import type { Profile, Exp } from "./store";
const SKILLS = ["python","fastapi","react","typescript","javascript","node","mongodb","sql","postgres","docker","kubernetes","aws","gcp","redis","graphql","rest","git","tailwind","next.js","java","django","flask","machine learning","llm","ci/cd"];
const cap = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
export const jdSkills = (jd: string) => SKILLS.filter((s) => jd.toLowerCase().includes(s));

/** Mock extractor – the real one is an LLM call with a JSON schema on the backend. */
export function extractJD(jd: string) {
  const m = (r: RegExp) => jd.match(r)?.[1]?.trim() ?? "";
  return {
    role: m(/(?:hiring|looking for|role|position|job title)[:\s]+(?:an?\s+)?([A-Z][\w+/ .-]{2,40})/i) || jd.split("\n")[0].slice(0, 50),
    company: m(/(?:company|at)[:\s]+([A-Z][\w&. -]{1,30})/),
    hr: m(/(?:contact|recruiter|hr)[:\s]+([A-Z][a-z]+(?: [A-Z][a-z]+)?)/),
    location: m(/location[:\s]+([\w, ]{2,40})/i),
    skills: jdSkills(jd).map(cap),
  };
}
export function draftVariants(x: ReturnType<typeof extractJD>, p: Profile, tone: string) {
  const skills = (x.skills.length ? x.skills : p.skills).slice(0, 4).join(", ");
  const hi = x.hr ? `Dear ${x.hr}` : "Hello";
  const role = x.role || "the open position", co = x.company || "your company";
  return [
    { label: "Direct", subject: `Application for ${role} – ${p.name}`, body: `<p>${hi},</p><p>I'm applying for ${role} at ${co}. My experience with ${skills} fits your requirements. Resume attached.</p><p>Regards,<br>${p.name}</p>` },
    { label: tone === "formal" ? "Formal" : "Warm", subject: `${role} at ${co} – interested`, body: `<p>${hi},</p><p>I came across the ${role} role at ${co} and was excited by it. I've worked with ${skills} and would love to contribute.</p><p>Could we speak this week? Best,<br>${p.name}</p>` },
    { label: "Short", subject: `${role} – ${p.name}`, body: `<p>${hi}, I'd like to be considered for ${role} (${skills}). Resume attached. Thanks, ${p.name}</p>` },
  ];
}
/** Select + reorder only. Output items are references to profile items, so nothing can be invented. */
export function tailorResume(jd: string, p: Profile) {
  const want = jdSkills(jd), have = p.skills.map((s) => s.toLowerCase());
  const score = (t: string) => want.filter((k) => t.toLowerCase().includes(k)).length;
  const pick = (items: Exp[]) => items.map((e) => ({ ...e, bullets: [...e.bullets].sort((a, b) => score(b) - score(a)).slice(0, 3), _s: e.bullets.reduce((n, b) => n + score(b), 0) })).sort((a, b) => b._s - a._s);
  const matched = want.filter((k) => have.includes(k));
  const experience = pick(p.experience), projects = pick(p.projects);
  const claims = [...experience, ...projects].flatMap((e) => e.bullets);
  const all = new Set([...p.experience, ...p.projects].flatMap((e) => e.bullets));
  return {
    experience, projects, skills: [...p.skills].sort((a, b) => Number(want.includes(b.toLowerCase())) - Number(want.includes(a.toLowerCase()))),
    ats: want.length ? Math.round((100 * matched.length) / want.length) : 0, matched, missing: want.filter((k) => !have.includes(k)).map(cap),
    verified: claims.length, unsupported: claims.filter((c) => !all.has(c)).length,
  };
}
