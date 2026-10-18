"use client";

import { useState, type FormEvent, type ReactNode } from "react";

type Tab = "create" | "invite";

export default function Home() {
  const [tab, setTab] = useState<Tab>("create");
  const [workspace, setWorkspace] = useState(false);
  const [notice, setNotice] = useState("");
  const [section, setSection] = useState("Today");
  const [done, setDone] = useState(false);
  const [focus, setFocus] = useState("Aging parent");
  const [aiOpen, setAiOpen] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    setNotice(tab === "create"
      ? "The secure account and PayPal checkout flow will be connected in the backend phase."
      : "The secure invite check and account flow will be connected in the backend phase.");
  }

  function toast(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3800);
  }

  if (workspace) {
    return <Workspace section={section} setSection={setSection} done={done} setDone={setDone}
      onBack={() => setWorkspace(false)} onToast={toast} onAI={() => setAiOpen(true)}
      aiOpen={aiOpen} setAiOpen={setAiOpen} notice={notice} />;
  }

  return <main className="site">
    <header className="header">
      <a className="brand" href="#"><span className="brand-mark">✳</span><span><b>carecircle</b><small>FAMILY CARE, TOGETHER</small></span></a>
      <nav><a href="#how">How it works</a><a href="#plan">Membership</a><button onClick={() => { setTab("invite"); document.getElementById("join")?.scrollIntoView({ behavior: "smooth" }); }}>Join a family</button></nav>
      <button className="button outline" onClick={() => document.getElementById("join")?.scrollIntoView({ behavior: "smooth" })}>Log in <span>↗</span></button>
    </header>

    <section className="hero">
      <div className="hero-copy">
        <div className="eyebrow"><i /> CARE WORKS BETTER, TOGETHER</div>
        <h1>A little more<br />supported. <em>A lot more<br />together.</em></h1>
        <p>Keep the people you love close, even when care is shared across busy lives. One calm place for family updates, care plans, and the small things that matter.</p>
        <div className="hero-actions"><button className="button primary large" onClick={() => document.getElementById("join")?.scrollIntoView({ behavior: "smooth" })}>Start your free month <span>→</span></button><button className="play-link" onClick={() => setWorkspace(true)}><i>▶</i> Explore the workspace</button></div>
        <div className="proof"><div className="avatars"><span className="av peach">M</span><span className="av sage">J</span><span className="av lilac">E</span><span className="av cream">+</span></div>Make room for the whole family</div>
      </div>
      <div className="hero-art">
        <div className="orb orb-a" /><div className="orb orb-b" />
        <div className="floating float-top"><span>♡</span><div><b>Care, shared</b><small>Everyone can help in their own way</small></div></div>
        <div className="mini-dashboard">
          <div className="dash-head"><div><small>THE MORGAN FAMILY</small><h2>Good morning, Sarah</h2><p>Here’s your family’s day, at a glance.</p></div><i>●</i></div>
          <div className="mini-stats"><div><small>Care circle</small><b>4 people</b></div><div><small>Open handoffs</small><b>3 tasks</b></div></div>
          <div className="mini-update"><span className="av peach">EM</span><div><small>EMILY · 8:42 AM</small><b>Mom had a brighter morning</b><p>She enjoyed breakfast and sunshine in the garden.</p></div></div>
          <div className="mini-task"><i>✓</i><div><b>Confirm Wednesday ride</b><small>James · Care calendar</small></div><span>DONE</span></div>
          <div className="mini-appt"><b>WED<br /><strong>21</strong></b><span><strong>Dr. Priya Patel</strong><small>Cardiology · 10:30 am</small></span><i>↗</i></div>
        </div>
        <div className="floating float-bottom"><span className="gold">✦</span><div><b>One family, one rhythm</b><small>Less back-and-forth. More being there.</small></div></div>
        <div className="leaf leaf-one">✳</div><div className="leaf leaf-two">✳</div>
      </div>
    </section>

    <section className="trust" id="how"><p>Everything your family needs to care in sync</p><div><span>♡ &nbsp;Shared updates</span><span>✓ &nbsp;Clear handoffs</span><span>▦ &nbsp;Care calendar</span><span>✳ &nbsp;Personal guidance</span></div></section>

    <section className="features">
      <div><div className="eyebrow">A SHARED SPACE FOR REAL LIFE</div><h2>Support for the people<br />who show up.</h2><p>Care changes shape from family to family. CareCircle helps you make a plan that fits yours.</p></div>
      <div className="feature-cards">
        <article><span>◷</span><h3>Stay in the loop</h3><p>Share the day’s little updates so nobody has to wonder how things are going.</p></article>
        <article><span>✓</span><h3>Make handoffs easier</h3><p>Put the next task, appointment, and helpful note where everyone can find it.</p></article>
        <article><span>✳</span><h3>Care for every generation</h3><p>Thoughtful guidance for raising children and supporting aging parents.</p></article>
      </div>
    </section>

    <section className="join" id="join">
      <div className="join-copy"><div className="eyebrow">START WITH YOUR FAMILY</div><h2>Care is easier<br />when it’s shared.</h2><p>Create a family space and invite the people who help. Joining an existing family is free with an invite code.</p><div className="steps"><span><b>01</b> Start with one family coordinator</span><span><b>02</b> Invite up to four more people</span><span><b>03</b> Share care in the way that works for you</span></div><button className="plain-action" onClick={() => setWorkspace(true)}>See the family workspace <b>→</b></button></div>
      <div className="join-card">
        <div className="join-kicker"><span>YOUR FAMILY SPACE</span><small>◇ &nbsp;Private by design</small></div>
        <div className="tabs" role="tablist" aria-label="Create account or join family">
          <button role="tab" aria-selected={tab === "create"} className={tab === "create" ? "selected" : ""} onClick={() => { setTab("create"); setNotice(""); }}>Create a family</button>
          <button role="tab" aria-selected={tab === "invite"} className={tab === "invite" ? "selected" : ""} onClick={() => { setTab("invite"); setNotice(""); }}>I have an invite</button>
        </div>
        {tab === "create" ? <form onSubmit={submit}>
          <h3>Create your account</h3><p className="form-intro">You’ll be the coordinator for your family space.</p>
          <div className="fields"><Field label="Your name" placeholder="e.g. Sarah Morgan" auto="name" /><Field label="Email address" placeholder="you@example.com" type="email" auto="email" /></div>
          <div className="fields"><Field label="Age" placeholder="Your age" type="number" min="13" max="120" /><Relation label="Relationship to care recipient" /></div>
          <Field label="Password" placeholder="At least 10 characters" type="password" minLength="10" auto="new-password" />
          <div className="price-note"><span>✦</span><div><b>First month on us</b><small>Then $10/month for 5 family members. $2/month for each additional member.</small></div></div>
          <button className="button primary submit" type="submit">Create account &amp; start free month <b>→</b></button>
          <p className="fine">No charge today. PayPal checkout and account creation will connect in the backend phase.</p>
        </form> : <form onSubmit={submit}>
          <h3>Join your family</h3><p className="form-intro">Have a code from your family coordinator? Join without a purchase.</p>
          <Field label="Family invite code" placeholder="PASTE YOUR INVITE CODE" minLength="8" />
          <div className="fields"><Field label="Your name" placeholder="e.g. Emily Morgan" auto="name" /><Field label="Email address" placeholder="you@example.com" type="email" auto="email" /></div>
          <div className="fields"><Field label="Age" placeholder="Your age" type="number" min="13" max="120" /><Relation label="Relationship to family" /></div>
          <Field label="Create a password" placeholder="At least 10 characters" type="password" minLength="10" auto="new-password" />
          <button className="button primary submit" type="submit">Join my family <b>→</b></button>
          <p className="fine">Codes are single-use and expire after 7 days. We’ll check your code before adding you.</p>
        </form>}
        {notice && <div className="notice" role="status">{notice}</div>}
      </div>
    </section>

    <section className="plan" id="plan">
      <div><div className="eyebrow">STRAIGHTFORWARD MEMBERSHIP</div><h2>One family plan.<br />Room to grow.</h2><p>Your first month is free to get everyone settled in. The coordinator manages the subscription; invited members never need to purchase access.</p></div>
      <div className="plan-card"><div className="plan-top"><span>THE FAMILY PLAN</span><b>30 DAYS FREE</b></div><div className="price"><strong>$10</strong><span>/ month after free month</span></div><hr /><ul><li><b>✓</b> Up to 5 people in your family space</li><li><b>✓</b> Invite family members at no charge</li><li><b>✓</b> Add a person for $2/month each after 5</li><li><b>✓</b> One shared space for care coordination</li></ul><button className="button primary submit" onClick={() => document.getElementById("join")?.scrollIntoView({ behavior: "smooth" })}>Start your free month <b>→</b></button></div>
    </section>
    <footer className="footer"><a className="brand" href="#"><span className="brand-mark">✳</span><span><b>carecircle</b><small>FAMILY CARE, TOGETHER</small></span></a><span>Small steps, shared with love.</span><span>© 2026 CareCircle</span></footer>
  </main>;
}

function Field({ label, placeholder, type = "text", auto, min, max, minLength }: { label: string; placeholder: string; type?: string; auto?: string; min?: string; max?: string; minLength?: string }) {
  return <label className="field"><span>{label}</span><input required className="input" placeholder={placeholder} type={type} autoComplete={auto} min={min} max={max} minLength={minLength ? Number(minLength) : undefined} /></label>;
}

function Relation({ label }: { label: string }) {
  return <label className="field"><span>{label}</span><select className="input" required defaultValue=""><option value="" disabled>Select a relationship</option><option>Parent</option><option>Child</option><option>Partner</option><option>Sibling</option><option>Grandparent</option><option>Other family member</option><option>Caregiver</option></select></label>;
}

const sections = ["Today", "Daily updates", "Tasks & handoffs", "Care calendar", "Care notes", "Family chat", "Household funds", "People & roles", "AI guidance"];
const icons = ["⌂", "◷", "✓", "▦", "♡", "◌", "◉", "♧", "✳"];

function Workspace({ section, setSection, done, setDone, onBack, onToast, onAI, aiOpen, setAiOpen, notice }: {
  section: string; setSection: (value: string) => void; done: boolean; setDone: (value: boolean) => void;
  onBack: () => void; onToast: (message: string) => void; onAI: () => void; aiOpen: boolean;
  setAiOpen: (value: boolean) => void; notice: string;
}) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  return <div className="workspace">
    <aside className="sidebar"><a className="brand" href="#" onClick={(e) => { e.preventDefault(); onBack(); }}><span className="brand-mark">✳</span><span><b>carecircle</b><small>FAMILY CARE, TOGETHER</small></span></a><small className="nav-title">YOUR WORKSPACE</small>
      <nav>{sections.map((item, i) => <button key={item} className={section === item ? "active" : ""} onClick={() => { setSection(item); if (item === "AI guidance") onAI(); }}><i>{icons[i]}</i>{item}{i === 2 && <span className="count">3</span>}</button>)}</nav>
      <div className="family-box"><div><b>The Morgan family</b><span>4 of 5</span></div><p>A shared space for everyone who helps.</p><div className="avatars"><span className="av sage">SM</span><span className="av peach">JM</span><span className="av lilac">EM</span><span className="av cream">+1</span></div></div>
      <button className="user-row" onClick={() => onToast("Your profile settings will connect to your secure account.")}><span className="av sage">SM</span><span><b>Sarah Morgan</b><small>Family coordinator</small></span><i>···</i></button>
    </aside>
    <main className="dash-main"><div className="dash-top"><div><button className="back" onClick={onBack}>← <span>CareCircle home</span></button><i>/</i><b>{section}</b><small>SAMPLE PREVIEW</small></div><div><time>{new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date())}</time><button className="button outline" onClick={() => setInviteOpen(true)}>↗ &nbsp;Invite family</button><span className="av sage">SM</span></div></div>
      <div className="dash-greeting"><div><div className="eyebrow">A LITTLE MORE SUPPORTED</div><h1>{section === "Today" ? "Good morning, Sarah" : section}</h1><p>Here’s what’s happening with Mom today. You’re in this together.</p></div><button className="button primary" onClick={() => setUpdateOpen(true)}>＋ &nbsp;Share an update</button></div>
      <div className="stats"><Stat icon="♧" title="In your care circle" value="4 people" note="all connected" /><Stat icon="✓" title="Open handoffs" value={done ? "2 tasks" : "3 tasks"} note="1 due today" /><Stat icon="▦" title="Next appointment" value="Wednesday" note="2 days away" /></div>
      <div className="dash-grid"><div className="dash-col">
        <article className="update-card"><div className="update-head"><span className="av peach">EM</span><div><b>Emily Morgan</b><small>Shared a daily update</small></div><time>Today · 8:42 am</time></div><div className="update-body"><small>A NOTE FOR THE FAMILY</small><h2>Mom had a brighter morning today</h2><p>She ate most of her breakfast and wanted to sit by the garden. We took a short walk after her medication. She mentioned her knee is a little sore, so maybe keep an eye on it this afternoon.</p><div className="tags"><span>Morning visit</span><span>Medication taken</span><span>Knee soreness</span></div></div><div className="update-foot"><button onClick={() => onToast("Reaction saved in this sample preview.")}>♡ &nbsp;2</button><button onClick={() => onToast("Replies will appear here.")}>↩ &nbsp;1 reply</button><button onClick={() => setSection("Daily updates")}>Open update &nbsp;→</button></div></article>
        <Card title="Today’s handoffs" action="View all tasks →" click={() => setSection("Tasks & handoffs")}><Task title="Pick up Mom’s prescription" sub="Today, before 5 pm · Pharmacy" who="Emily" initials="EM" tone="lilac" onClick={() => setDone(!done)} checked={done} /><Task title="Call Dr. Patel about the new dosage" sub="Today · Follow-up" who="James" initials="JM" tone="peach" onClick={() => onToast("Task marked complete in this preview.")} /><Task title="Confirm the ride for Wednesday" sub="Completed at 9:10 am" who="Done" initials="" tone="sage" checked onClick={() => {}} /></Card>
        <Card title="A week at a glance" action="Open calendar →" click={() => setSection("Care calendar")}><div className="week">{["Sun|18", "Mon|19", "Tue|20", "Wed|21", "Thu|22", "Fri|23", "Sat|24"].map((d, i) => <div className={i === 1 ? "today" : ""} key={d}><small>{d.split("|")[0]}</small><b>{d.split("|")[1]}</b>{[1, 3, 5].includes(i) && <i />}</div>)}</div></Card>
      </div><div className="dash-col">
        <section className="appointment"><div><b>Coming up next</b><button onClick={() => setSection("Care calendar")}>See calendar</button></div><article><span><small>WED</small><b>21</b></span><div><b>Dr. Priya Patel</b><small>Cardiology · 10:30 am</small></div></article><p>⌖ &nbsp;Oak Valley Medical <span>James is taking Mom</span></p></section>
        <Card title="Family activity" action="See all →" click={() => setSection("Daily updates")}><Activity name="Emily shared an update" sub="Mom’s morning visit" time="18m" initials="EM" tone="lilac" /><Activity name="James completed a task" sub="Confirmed Wednesday ride" time="1h" initials="JM" tone="peach" /><Activity name="You added an appointment" sub="Dr. Patel · Wednesday" time="Yesterday" initials="SM" tone="sage" /></Card>
        <Card title="Household funds" action="View details →" click={() => setSection("Household funds")}><div className="fund-line"><span>Monthly care budget<b>$2,450</b></span><i>On track</i></div><div className="bars">{[40,60,48,77,57,88,69,53,74,62].map((h, i) => <i key={i} style={{ height: String(h) + "%" }} />)}</div><div className="months"><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span></div></Card>
        <div className="note-card"><b>A note to remember <span>♡</span></b><p>“Mom prefers her tea warm with honey, especially after her afternoon walk.”</p><small>Care preferences <i>Added by Sarah · Oct 14</i></small></div>
        <div className="ai-card"><small>✳ &nbsp;PERSONALIZED SUPPORT</small><b>Support for every generation</b><p>Explore tailored ideas for parenting and aging-parent care.</p><button onClick={onAI}>Get thoughtful guidance →</button></div>
        <div className="seats-card"><div><b>Family seats <small>One owner, one shared space</small></b><strong>4 / 5</strong></div><div className="meter"><i /></div><small>1 seat available on this plan</small><button onClick={() => setInviteOpen(true)}>Invite someone →</button></div>
      </div></div>
    </main>
    {inviteOpen && <Modal title="Invite your family" close={() => setInviteOpen(false)}><p>Invite members into this shared space. Invite codes are single-use and expire after 7 days.</p><Field label="Email address" placeholder="family@example.com" type="email" /><div className="price-note"><span>♧</span><div><b>4 of 5 seats used</b><small>Members after the first five add $2/month each.</small></div></div><button className="button primary submit" onClick={() => { setInviteOpen(false); onToast("Invite links and the native share sheet will connect in the backend phase."); }}>Create invite link <b>→</b></button></Modal>}
    {updateOpen && <Modal title="Share an update" close={() => setUpdateOpen(false)}><p>Let your family know how the day is going.</p><label className="field"><span>Your update</span><textarea className="input" rows={4} placeholder="Share what your family should know…" /></label><button className="button primary submit" onClick={() => { setUpdateOpen(false); onToast("Updates will save to your private family workspace."); }}>Share with family <b>→</b></button></Modal>}
    {aiOpen && <Modal title="Personalized family guidance" close={() => setAiOpen(false)}><p>Choose the kind of support you need and share what would help today.</p><div className="focus">{["Parenting children", "Aging parent"].map((value) => <button className={focus === value ? "chosen" : ""} onClick={() => setFocus(value)} key={value}>{value}</button>)}</div><label className="field"><span>Your question</span><textarea className="input" rows={4} placeholder={focus === "Aging parent" ? "Share a care challenge or family question…" : "Share a parenting question or a moment you want help with…"} /></label><button className="button primary submit" onClick={() => { setAiOpen(false); onToast("Personalized guidance will be generated after the AI service is connected."); }}>Get thoughtful ideas <b>→</b></button><p className="fine">Everyday support only; this is not medical advice.</p></Modal>}
    {notice && <div className="toast" role="status">{notice}</div>}
  </div>;
}

function Stat({ icon, title, value, note }: { icon: string; title: string; value: string; note: string }) {
  return <div className="stat"><i>{icon}</i><span><small>{title}</small><b>{value}</b></span><em>{note}</em></div>;
}

function Card({ title, action, click, children }: { title: string; action: string; click: () => void; children: ReactNode }) {
  return <section className="card"><div className="card-head"><b>{title}</b><button onClick={click}>{action}</button></div>{children}</section>;
}

function Task({ title, sub, who, initials, tone, checked, onClick }: { title: string; sub: string; who: string; initials: string; tone: string; checked?: boolean; onClick: () => void }) {
  return <div className="task"><button aria-label={"Toggle " + title} className={checked ? "check checked" : "check"} onClick={onClick}>{checked ? "✓" : ""}</button><span><b>{title}</b><small>{sub}</small></span>{who === "Done" ? <em>DONE</em> : <label><i className={"av " + tone}>{initials}</i>{who}</label>}</div>;
}

function Activity({ name, sub, time, initials, tone }: { name: string; sub: string; time: string; initials: string; tone: string }) {
  return <div className="activity"><i className={"av " + tone}>{initials}</i><span><b>{name}</b><small>{sub}</small></span><time>{time}</time></div>;
}

function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  return <div className="backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="close" onClick={close} aria-label="Close dialog">×</button><div className="eyebrow">YOUR FAMILY SPACE</div><h2 id="modal-title">{title}</h2>{children}</section></div>;
}

