"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function BillingSuccessPage() {
  const [message, setMessage] = useState("Confirming your PayPal subscription…");
  const [working, setWorking] = useState(true);
  useEffect(() => {
    const pendingSeats = Number(window.sessionStorage.getItem("carecircle_pending_seats"));
    if (pendingSeats >= 6 && pendingSeats <= 100) {
      fetch("/api/family/seats", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seatLimit: pendingSeats }) })
        .then(async (response) => {
          const result = await response.json().catch(() => ({}));
          if (response.ok) {
            window.sessionStorage.removeItem("carecircle_pending_seats");
            window.location.assign("/family?seats=updated");
            return;
          }
          setMessage(result.error || "PayPal has not confirmed the seat change yet. You can retry from family settings.");
          setWorking(false);
        })
        .catch(() => { setMessage("We could not check the seat change. Please retry from family settings."); setWorking(false); });
      return;
    }
    const subscriptionId = new URLSearchParams(window.location.search).get("subscription_id");
    if (!subscriptionId) { setMessage("PayPal returned without a subscription reference. Sign in and try confirming from your family page."); setWorking(false); return; }
    fetch(`/api/billing/confirm?subscription_id=${encodeURIComponent(subscriptionId)}`, { cache: "no-store" }).then(async (response) => {
      const result = await response.json().catch(() => ({}));
      if (response.ok) { window.location.assign(result.redirectTo || "/workspace"); return; }
      setMessage(result.error || "PayPal has not confirmed this subscription yet. Wait a moment and try again.");
      setWorking(false);
    }).catch(() => { setMessage("We could not reach PayPal. Please try again."); setWorking(false); });
  }, []);
  return <main className="service-state"><div className="brand-mark">✳</div><h1>{working ? "One moment" : "Checkout update"}</h1><p>{message}</p>{!working && <><Link className="button primary" href="/family">Return to family settings</Link><Link className="button outline" href="/">Return to CareCircle</Link></>}</main>;
}
