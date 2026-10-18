import Link from "next/link";
import type { ReactNode } from "react";

export default function PolicyPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return <main className="policy-shell">
    <header className="policy-header">
      <Link className="brand" href="/"><span className="brand-mark">✳</span><span><b>carecircle</b><small>FAMILY CARE, TOGETHER</small></span></Link>
      <nav aria-label="Policies"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/refunds">Billing</Link><Link href="/support">Support</Link></nav>
    </header>
    <article className="policy-content">
      <p className="eyebrow">CARECIRCLE · LAST UPDATED OCTOBER 18, 2026</p>
      <h1>{title}</h1>
      <p className="policy-intro">{intro}</p>
      {children}
      <p className="policy-contact">Questions? Visit <Link href="/support">CareCircle Support</Link>.</p>
    </article>
    <footer className="policy-footer"><Link href="/">← Back to CareCircle</Link><span>Small steps, shared with love.</span></footer>
  </main>;
}

