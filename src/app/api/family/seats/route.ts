import { z } from "zod";
import { apiFailure } from "@/lib/errors";
import { db, inTransaction } from "@/lib/db";
import { reviseSubscription, showSubscription } from "@/lib/paypal";
import { currentUser, jsonError, requireActiveFamily, secureId, writeAudit, lockActiveFamily, limitRequest } from "@/lib/security";

export const runtime = "nodejs";
const seatSchema = z.object({ seatLimit: z.number().int().min(6).max(100) }).strict();

export async function POST(request: Request) {
  try {
    const access = await requireActiveFamily(request, 5);
    if ("response" in access) return access.response;
    if (access.family.ownerId !== access.user.id) return jsonError("Only the family owner can buy seats.", 403);
    const parsed = seatSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError("Choose a seat total between 6 and 100.", 400);
    const current = (await db().query("SELECT seat_limit,paypal_subscription_id,paypal_plan_id FROM families WHERE id=$1", [access.family.id])).rows[0];
    if (parsed.data.seatLimit <= current.seat_limit) return jsonError("Choose a number greater than the current seat limit.", 400);
    if (!current.paypal_subscription_id || !current.paypal_plan_id) return jsonError("PayPal is not connected to this family.", 503);
    const requestId = secureId();
    await inTransaction(async (client) => {
      await lockActiveFamily(client, access.family.id);
      const family = (await client.query("SELECT seat_limit FROM families WHERE id=$1", [access.family.id])).rows[0];
      if (parsed.data.seatLimit <= family.seat_limit) throw new Error("SEAT_LIMIT_CHANGED");
      const pending = await client.query("SELECT 1 FROM seat_change_requests WHERE family_id=$1 AND status='pending'", [access.family.id]);
      if (pending.rowCount) throw new Error("SEAT_CHANGE_PENDING");
      await client.query("INSERT INTO seat_change_requests(id,family_id,requested_limit) VALUES($1,$2,$3)", [requestId, access.family.id, parsed.data.seatLimit]);
    });
    try {
      const revision = await reviseSubscription(current.paypal_subscription_id, current.paypal_plan_id, parsed.data.seatLimit);
      const approveUrl = Array.isArray(revision.links) ? (revision.links as Array<{ rel?: string; href?: string }>).find((link) => link.rel === "approve")?.href : undefined;
      if (!approveUrl) throw new Error("PAYPAL_APPROVAL_LINK_MISSING");
      await db().query("UPDATE seat_change_requests SET approval_url=$2,updated_at=now() WHERE id=$1", [requestId, approveUrl]);
      return Response.json({ approvalUrl: approveUrl, seatLimit: parsed.data.seatLimit, monthlyTotal: parsed.data.seatLimit * 2 }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      await db().query("UPDATE seat_change_requests SET status='failed',updated_at=now() WHERE id=$1", [requestId]);
      throw error;
    }
  } catch (error) {
    if (error instanceof Error && error.message === "SEAT_CHANGE_PENDING") return jsonError("Finish the pending PayPal seat change before starting another.", 409);
    if (error instanceof Error && error.message === "SEAT_LIMIT_CHANGED") return jsonError("The family seat count changed. Refresh and try again.", 409);
    return apiFailure(error);
  }
}

export async function PATCH(request: Request) {
  try {
    if (!(await limitRequest(request, "family:seats:confirm", 8))) return jsonError("Too many requests.", 429);
    const user = await currentUser();
    if (!user) return jsonError("Sign in to continue.", 401);
    const parsed = seatSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError("Invalid seat total.", 400);
    const family = (await db().query("SELECT id,owner_id,seat_limit,paypal_subscription_id FROM families WHERE owner_id=$1 AND status='active'", [user.id])).rows[0];
    if (!family) return jsonError("Active owner access is required.", 403);
    const pending = (await db().query("SELECT id FROM seat_change_requests WHERE family_id=$1 AND requested_limit=$2 AND status='pending'", [family.id, parsed.data.seatLimit])).rows[0];
    if (!pending && family.seat_limit === parsed.data.seatLimit) return Response.json({ ok: true, seatLimit: family.seat_limit }, { headers: { "Cache-Control": "no-store" } });
    if (!pending || !family.paypal_subscription_id) return jsonError("No matching pending PayPal seat change was found.", 404);
    const subscription = await showSubscription(family.paypal_subscription_id);
    if (subscription.status !== "ACTIVE" || Number(subscription.quantity) !== parsed.data.seatLimit) return jsonError("PayPal has not confirmed the seat change yet.", 409);
    await inTransaction(async (client) => {
      await lockActiveFamily(client, family.id);
      const requestRow = (await client.query("SELECT id FROM seat_change_requests WHERE id=$1 AND status='pending' FOR UPDATE", [pending.id])).rows[0];
      if (!requestRow) return;
      await client.query("UPDATE families SET seat_limit=$2,updated_at=now() WHERE id=$1", [family.id, parsed.data.seatLimit]);
      await client.query("UPDATE seat_change_requests SET status='approved',updated_at=now() WHERE id=$1", [pending.id]);
      await writeAudit(client, family.id, user.id, "seats.updated", "family", family.id);
    });
    return Response.json({ ok: true, seatLimit: parsed.data.seatLimit }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiFailure(error); }
}
