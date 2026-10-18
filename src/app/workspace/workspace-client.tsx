"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

type Family = { id: string; name: string; role: "owner" | "member"; seats: number; usedSeats: number };
type Item = { id: string; title?: string; body?: string; detail?: string | null; dueAt?: string | null; status?: string; startsAt?: string; createdAt?: string; createdBy?: string; location?: string | null };
const tabs = ["Today", "Tasks", "Updates", "Calendar", "Chat", "Care notes", "Household funds", "AI guidance"];

export default function WorkspaceClient({ user, family }: { user: { id: string; name: string }; family: Family }) {
  const router = useRouter();
  const [section, setSection] = useState("Today");
  const [items, setItems] = useState<Record<string, Item[]>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [guidance, setGuidance] = useState("");
  const [consent, setConsent] = useState(false);
  const apiResource: Record<string, string> = { Tasks: "tasks", Updates: "updates", Calendar: "appointments", Chat: "chat", "Care notes": "notes", "Household funds": "finances" };

  async function load() {
    const entries = await Promise.all(Object.entries(apiResource).map(async ([name, resource]) => {
      const response = await fetch(`/api/family/data/${resource}`, { cache: "no-store" });
      if (response.status === 401 || response.status === 403) { router.replace("/"); return [name, []] as const; }
      const data = await response.json().catch(() => ({}));
      return [name, response.ok ? (data.items ?? []) as Item[] : []] as const;
    }));
    setItems(Object.fromEntries(entries));
  }
  useEffect(() => { void load(); }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true); setMessage("");
    let resource = apiResource[section];
    let body: Record<string, unknown>;
    if (section === "Tasks") body = { title: String(data.get("title") ?? ""), detail: String(data.get("detail") ?? ""), dueAt: data.get("dueAt") ? new Date(String(data.get("dueAt"))).toISOString() : undefined };
    else if (section === "Updates" || section === "Chat") body = { body: String(data.get("body") ?? "") };
    else if (section === "Calendar") body = { title: String(data.get("title") ?? ""), startsAt: new Date(String(data.get("startsAt"))).toISOString(), location: String(data.get("location") ?? ""), notes: String(data.get("notes") ?? "") };
    else if (section === "Care notes") body = { title: String(data.get("title") ?? ""), body: String(data.get("body") ?? "") };
    else body = { monthlyIncome: Number(data.get("monthlyIncome")), monthlyBudget: Number(data.get("monthlyBudget")), currency: "USD" };
    const response = await fetch(`/api/family/data/${resource}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({}));
    if (response.ok) { form.reset(); setMessage("Saved for your family."); await load(); }
    else setMessage(result.error ?? "Could not save that yet.");
    setBusy(false);
  }

  async function setTask(id: string, status: string) {
    const response = await fetch("/api/family/data/tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: status === "done" ? "open" : "done" }) });
    if (response.ok) await load(); else setMessage("Could not update that task.");
  }
  async function askAI(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!consent) { setMessage("Please confirm before sending this question to the AI service."); return; }
    const question = String(new FormData(event.currentTarget).get("question") ?? "");
    setBusy(true); setMessage(""); setGuidance("");
    const focus = String(new FormData(event.currentTarget).get("focus") ?? "aging-parent");
    const response = await fetch("/api/ai/guidance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ focus, question, consent: true }) });
    const result = await response.json().catch(() => ({}));
    if (response.ok) setGuidance(result.guidance); else setMessage(result.error ?? "Could not get guidance right now.");
    setBusy(false);
  }
  async function logout() { await authClient.signOut(); router.replace("/"); }

  const list = items[section] ?? [];
  return <main className="app-shell">
    <aside className="app-nav"><Link className="brand" href="/"><span className="brand-mark">✳</span><span><b>carecircle</b><small>FAMILY CARE, TOGETHER</small></span></Link><p className="eyebrow">YOUR WORKSPACE</p>
      <nav>{tabs.map((item) => <button key={item} className={section === item ? "active" : ""} data-tip={`Open your family's ${item.toLowerCase()} area.`} onClick={() => { setSection(item); setMessage(""); }}>{item}</button>)}</nav>
      <div className="app-family"><b>{family.name}</b><span>{family.usedSeats} of {family.seats} seats used</span><p>One shared space for the people who help.</p></div>
      {family.role === "owner" && <Link className="button outline" href="/family" data-tip="Manage seats, invites, and family members.">Manage family</Link>}
      <button className="button outline" onClick={logout} data-tip="Sign out and end your secure session.">Log out</button>
    </aside>
    <section className="app-content">
      <header className="app-top"><div><small>YOUR FAMILY SPACE</small><h1>{section === "Today" ? `Good to see you, ${user.name.split(" ")[0]}` : section}</h1><p>{family.name} · Private family workspace</p></div><span className="app-avatar">{user.name.slice(0,1).toUpperCase()}</span></header>
      {message && <div className="app-message" role="status">{message}</div>}
      {section === "Today" && <><div className="app-cards"><article data-tip="Your total current members and the size of your plan."><small>Family seats</small><b>{family.usedSeats} / {family.seats}</b><span>{family.seats - family.usedSeats} available</span></article><article data-tip="Tasks assigned to family members for care handoffs."><small>Open tasks</small><b>{(items.Tasks ?? []).filter((task) => task.status === "open").length}</b><span>Shared handoffs</span></article><article data-tip="Upcoming appointments added to your care calendar."><small>Appointments</small><b>{(items.Calendar ?? []).length}</b><span>On the care calendar</span></article></div><div className="app-grid"><article className="app-panel"><div className="app-panel-head"><h2>Today’s tasks</h2><button onClick={() => setSection("Tasks")} data-tip="See and update the complete task list.">View all →</button></div>{(items.Tasks ?? []).slice(0,5).map((task) => <TaskRow key={task.id} task={task} onToggle={setTask} />)}{!(items.Tasks ?? []).length && <p className="app-empty">No tasks yet. Add the first handoff for your family.</p>}</article><article className="app-panel"><div className="app-panel-head"><h2>Recent updates</h2><button onClick={() => setSection("Updates")} data-tip="Share and read family updates.">View all →</button></div>{(items.Updates ?? []).slice(0,4).map((item) => <p className="app-record" key={item.id}>{item.body}</p>)}{!(items.Updates ?? []).length && <p className="app-empty">Family updates will appear here.</p>}</article></div></>}
      {section === "AI guidance" ? <form className="app-panel app-form" onSubmit={askAI}><h2>Thoughtful family guidance</h2><p>Personalized ideas for parenting children or supporting an aging parent.</p><label className="field"><span>Focus</span><select className="input" name="focus"><option value="aging-parent">Aging parent care</option><option value="parenting">Parenting children</option></select></label><label className="field"><span>What would help today?</span><textarea className="input" name="question" rows={5} minLength={10} maxLength={1800} required placeholder="Share an everyday family care question…" /></label><label className="consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />I agree to send this question to the AI service. It won’t be saved in CareCircle.</label><button className="button primary" disabled={busy} data-tip="Get private, practical suggestions from the AI service.">{busy ? "Thinking…" : "Get guidance →"}</button>{guidance && <div className="app-answer"><h3>Your ideas</h3><p>{guidance}</p><small>Everyday support only; not medical advice.</small></div>}</form> : section !== "Today" && <><div className="app-panel"><div className="app-panel-head"><h2>{section}</h2><span>{list.length} saved</span></div>{list.map((item) => <article className="app-record" key={item.id}>{item.title && <b>{item.title}</b>}{item.body && <p>{item.body}</p>}{item.detail && <p>{item.detail}</p>}{item.location && <small>{item.location}</small>}{item.dueAt && <small>Due {new Date(item.dueAt).toLocaleString()}</small>}{item.startsAt && <small>{new Date(item.startsAt).toLocaleString()}</small>}{item.status && <small>{item.status}</small>}</article>)}{!list.length && <p className="app-empty">Nothing here yet. Add the first item below.</p>}</div><form className="app-panel app-form" onSubmit={create}><h2>Add to {section.toLowerCase()}</h2>{section === "Tasks" && <><label className="field"><span>Task</span><input className="input" name="title" required maxLength={160} /></label><label className="field"><span>Helpful details</span><textarea className="input" name="detail" maxLength={3000} /></label><label className="field"><span>Due date and time</span><input className="input" name="dueAt" type="datetime-local" /></label></>}{["Updates", "Chat"].includes(section) && <label className="field"><span>{section === "Updates" ? "Your update" : "Message"}</span><textarea className="input" name="body" rows={4} required maxLength={8000} /></label>}{section === "Calendar" && <><label className="field"><span>Appointment</span><input className="input" name="title" required maxLength={160} /></label><label className="field"><span>Date and time</span><input className="input" name="startsAt" type="datetime-local" required /></label><label className="field"><span>Location</span><input className="input" name="location" maxLength={1000} /></label><label className="field"><span>Notes</span><textarea className="input" name="notes" maxLength={4000} /></label></>}{section === "Care notes" && <><label className="field"><span>Title</span><input className="input" name="title" required maxLength={160} /></label><label className="field"><span>Note</span><textarea className="input" name="body" rows={4} required maxLength={8000} /></label></>}{section === "Household funds" && <><label className="field"><span>Monthly household income (USD)</span><input className="input" name="monthlyIncome" type="number" min="0" step="0.01" /></label><label className="field"><span>Monthly care budget (USD)</span><input className="input" name="monthlyBudget" type="number" min="0" step="0.01" /></label><p className="fine">Financial values are encrypted before they are stored.</p></>}<button className="button primary" disabled={busy} data-tip="Save this item privately to the active family workspace.">{busy ? "Saving…" : "Save to family →"}</button></form></>}
    </section>
  </main>;
}

function TaskRow({ task, onToggle }: { task: Item; onToggle: (id: string, status: string) => void }) {
  return <div className="app-task"><button className={task.status === "done" ? "done" : ""} onClick={() => onToggle(task.id, task.status ?? "open")} data-tip={task.status === "done" ? "Mark this task open again." : "Mark this handoff complete."} aria-label={`Toggle task ${task.title}`}>{task.status === "done" ? "✓" : ""}</button><span><b>{task.title}</b><small>{task.dueAt ? new Date(task.dueAt).toLocaleString() : "No due time"}</small></span></div>;
}
