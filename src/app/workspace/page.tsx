import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { activeFamily } from "@/lib/security";
import WorkspaceClient from "./workspace-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function WorkspacePage() {
  try {
    const session = await auth().api.getSession({ headers: await headers() });
    if (!session?.user) redirect("/?signin=1");
    const family = await activeFamily(session.user.id);
    if (!family) redirect("/?access=required");
    return <WorkspaceClient user={{ id: session.user.id, name: session.user.name }} family={family} />;
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return <main className="service-state"><div className="brand-mark">✳</div><h1>Your private workspace is being prepared</h1><p>Secure sign-in and family storage need to be connected before members can enter.</p><Link className="button primary" href="/">Back to CareCircle</Link></main>;
  }
}
