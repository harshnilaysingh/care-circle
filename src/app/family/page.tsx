import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { activeFamily } from "@/lib/security";
import FamilyManager from "./family-manager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function FamilyPage() {
  try {
    const session = await auth().api.getSession({ headers: await headers() });
    if (!session?.user) redirect("/?signin=1");
    const family = await activeFamily(session.user.id);
    if (!family) redirect("/?access=required");
    if (family.ownerId !== session.user.id) redirect("/workspace");
    return <FamilyManager family={family} />;
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return <main className="service-state"><div className="brand-mark">✳</div><h1>Family management is not connected yet</h1><p>Connect the family database and sign in with the owner account to manage seats and invitations.</p><Link className="button primary" href="/">Back to CareCircle</Link></main>;
  }
}
