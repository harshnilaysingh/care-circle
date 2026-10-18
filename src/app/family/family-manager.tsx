"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

type Family = { id: string; name: string; seats: number; usedSeats: number };
type Member = { id: string; name: string; role: string; status: string };
type Invite = { id: string; name?: string; email?: string; relation?: string; expiresAt: string };

export default function FamilyManager({ family: initial }: { family: Family }) {
  const router = useRouter();
  const [family, setFamily] = useState(initial);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [shareLink, setShareLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [seatTarget, setSeatTarget] = useState(String(Math.max(6, initial.seats + 1)));
  const [seatPending, setSeatPending] = useState(0);
  const [cancelBusy, setCancelBusy] = useState(false);

  async function load() {
    const response = await fetch("/api/family", { cache: "no-store" });
    const result = await response.json().catch(() => ({}));
    if (response.ok) { setFamily(result.family); setMembers(result.members ?? []); setInvites(result.invites ?? []); }
    else setNotice(result.error ?? "Family data could not be loaded.");
  }
  useEffect(() => { const saved = Number(sessionStorage.getItem("carecircle_pending_seats")); if (saved >= 6 && saved <= 100) setSeatPending(saved); void load(); }, []);

  async function createInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice("");
    const form = event.currentTarget;
    const values = new FormData(form);
    const response = await fetch("/api/family/invites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: values.get("name"), email: values.get("email"), age: Number(values.get("age")), relation: values.get("relation") }) });
    const result = await response.json().catch(() => ({}));
    if (response.ok) { form.reset(); setShareLink(result.url); setNotice("Invitation created. It expires in 7 days and does not reserve a seat."); await load(); }
    else setNotice(result.error ?? "Could not create an invite.");
    setBusy(false);
  }
  async function share() {
    if (!shareLink) return;
    const text = `Join ${family.name} on CareCircle: ${shareLink}`;
    if (navigator.share) await navigator.share({ title: "CareCircle family invite", text, url: shareLink }).catch(() => undefined);
    else { await navigator.clipboard.writeText(shareLink); setNotice("Invite link copied to clipboard."); }
  }
  async function removeMember(id: string) {
    if (!window.confirm("Remove this member from the family?")) return;
    const response = await fetch(`/api/family/members/${encodeURIComponent(id)}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));
    setNotice(response.ok ? "Family member removed." : result.error ?? "Could not remove that member.");
    if (response.ok) await load();
  }
  async function cancelInvite(id: string) {
    const response = await fetch(`/api/family/invites/${encodeURIComponent(id)}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));
    setNotice(response.ok ? "Invitation cancelled." : result.error ?? "Could not cancel that invite.");
    if (response.ok) await load();
  }
  async function buySeats(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice("");
    const value = Number(new FormData(event.currentTarget).get("seatLimit"));
    const response = await fetch("/api/family/seats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seatLimit: value }) });
    const result = await response.json().catch(() => ({}));
    if (response.ok) { setSeatPending(value); sessionStorage.setItem("carecircle_pending_seats", String(value)); setNotice(`Approve the seat change with PayPal. New total: $${result.monthlyTotal}/month after the current billing period.`); window.location.assign(result.approvalUrl); }
    else { setNotice(result.error ?? "Could not start the PayPal seat change."); setBusy(false); }
  }
  async function confirmSeats() {
    if (!seatPending) { setNotice("Enter the new seat total, approve it with PayPal, then return here and confirm."); return; }
    const response = await fetch("/api/family/seats", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seatLimit: seatPending }) });
    const result = await response.json().catch(() => ({}));
    setNotice(response.ok ? "Your paid seats are ready to use." : result.error ?? "PayPal has not confirmed the seat change yet.");
    if (response.ok) { setSeatPending(0); sessionStorage.removeItem("carecircle_pending_seats"); await load(); }
  }
  async function cancelPlan() {
    if (!window.confirm("Cancel this family subscription? This will immediately end access for everyone in the family.")) return;
    setCancelBusy(true); setNotice("");
    const response = await fetch("/api/billing/cancel", { method: "POST" });
    const result = await response.json().catch(() => ({}));
    if (response.ok) { await authClient.signOut(); window.location.assign("/?access=required"); return; }
    setNotice(result.error ?? "Could not cancel the subscription.");
    setCancelBusy(false);
  }
  async function logout() { await authClient.signOut(); router.replace("/"); }

  return <main className="family-manage">
    <header className="manage-top"><Link className="brand" href="/workspace"><span className="brand-mark">✳</span><span><b>carecircle</b><small>FAMILY CARE, TOGETHER</small></span></Link><Link className="button outline" href="/workspace" data-tip="Return to your private family workspace.">Back to workspace</Link></header>
    <section className="manage-wrap"><p className="eyebrow">OWNER TOOLS</p><h1>{family.name}</h1><p className="manage-lead">Manage the people in your circle and choose how much room your family needs.</p>
      {notice && <div className="app-message" role="status">{notice}</div>}
      <section className="seat-summary" data-tip="Only active members use seats. Pending invitations do not take up space."><div><small>FAMILY SEATS</small><h2>{family.usedSeats} of {family.seats} seats used</h2><p>{Math.max(0, family.seats - family.usedSeats)} currently available</p></div><div className="seat-meter"><i style={{ width: `${Math.min(100, (family.usedSeats / family.seats) * 100)}%` }} /></div></section>
      <div className="manage-grid"><section className="app-panel"><div className="app-panel-head"><h2>Family members</h2><span>{members.length} active</span></div>{members.map((member) => <div className="manage-row" key={member.id}><span className="app-avatar">{member.name.slice(0,1).toUpperCase()}</span><div><b>{member.name}</b><small>{member.role === "owner" ? "Family owner" : "Member"}</small></div>{member.role !== "owner" && <button className="text-danger" onClick={() => void removeMember(member.id)} data-tip="Remove this person from the active family workspace.">Remove</button>}</div>)}</section>
      <section className="app-panel"><div className="app-panel-head"><h2>Invite a family member</h2><span>single use · 7 days</span></div><form className="manage-form" onSubmit={createInvite}><label className="field"><span>Name</span><input className="input" name="name" required maxLength={100} /></label><label className="field"><span>Email address</span><input className="input" name="email" type="email" required maxLength={254} /></label><div className="fields"><label className="field"><span>Age</span><input className="input" name="age" type="number" min="13" max="120" required /></label><label className="field"><span>Relationship</span><select className="input" name="relation" required defaultValue=""><option value="" disabled>Choose one</option>{["Parent", "Child", "Partner", "Sibling", "Grandparent", "Caregiver", "Other family member"].map((item) => <option key={item}>{item}</option>)}</select></label></div><button className="button primary" disabled={busy} data-tip="Generate a private, single-use invite link for this person.">{busy ? "Creating…" : "Create invite link →"}</button></form>{shareLink && <div className="share-box"><small>INVITE LINK</small><input readOnly value={shareLink} onFocus={(e) => e.currentTarget.select()} title="Copy or share this single-use invite link." /><button className="button outline" onClick={() => void share()} data-tip="Open the native share sheet or copy the invite link.">Share invite</button></div>}<p className="fine">Invite details are encrypted. The member must sign up with the invited email address.</p></section>
      <section className="app-panel"><div className="app-panel-head"><h2>Pending invites</h2><span>{invites.length}</span></div>{invites.map((invite) => <div className="manage-row" key={invite.id}><div><b>{invite.name ?? "Family invite"}</b><small>{invite.email} · {invite.relation} · expires {new Date(invite.expiresAt).toLocaleDateString()}</small></div><button className="text-danger" onClick={() => void cancelInvite(invite.id)} data-tip="Cancel this invite so its code can no longer be redeemed.">Cancel</button></div>)}{!invites.length && <p className="app-empty">No pending invitations. New links expire after 7 days.</p>}</section>
      <section className="app-panel"><div className="app-panel-head"><h2>Add paid seats</h2><span>$2 per seat / month</span></div><p>Choose a new total. PayPal will ask you to approve the subscription change. Added seats take effect after PayPal confirms the change and are billed from the next cycle.</p><form className="seat-buy" onSubmit={buySeats}><label className="field"><span>New seat limit</span><input className="input" name="seatLimit" type="number" min={Math.max(6, family.seats + 1)} max="100" value={seatTarget} onChange={(e) => setSeatTarget(e.target.value)} required /></label><p>Estimated monthly plan after free period: <b>${Number(seatTarget || 5) * 2} / month</b></p><button className="button primary" disabled={busy} data-tip="Request a PayPal quantity change for the family subscription.">Continue with PayPal →</button><button className="button outline" type="button" onClick={() => void confirmSeats()} data-tip="Check that PayPal approved the requested seat increase.">Confirm approved seats</button></form></section></div>
      <section className="app-panel billing-cancel"><div className="app-panel-head"><h2>Subscription</h2><span>Owner only</span></div><p>Canceling immediately ends access for every member in this family. Any refund request is handled separately under the refund policy.</p><button className="text-danger" disabled={cancelBusy} onClick={() => void cancelPlan()} data-tip="Cancel the PayPal family subscription and end access for its members.">{cancelBusy ? "Canceling…" : "Cancel family subscription"}</button></section>
      <div className="manage-bottom"><span>Owner access controls this family subscription.</span><button onClick={logout} data-tip="Sign out and close your secure session.">Log out</button></div>
    </section>
  </main>;
}

