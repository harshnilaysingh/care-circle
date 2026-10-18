import { z } from "zod";
import { apiFailure } from "@/lib/errors";
import { db } from "@/lib/db";
import { encrypt, currentUser, jsonError, limitRequest } from "@/lib/security";

export const runtime = "nodejs";
const profileSchema = z.object({ age: z.number().int().min(13).max(120), relation: z.string().trim().min(2).max(80), careFocus: z.array(z.enum(["parenting", "aging-parent"])).max(2) }).strict();

export async function GET(request: Request) {
  try {
    if (!(await limitRequest(request, "profile:get", 30))) return jsonError("Too many requests.", 429);
    const user = await currentUser();
    if (!user) return jsonError("Sign in to continue.", 401);
    const result = await db().query("SELECT profile_ciphertext FROM user_profiles WHERE user_id=$1", [user.id]);
    return Response.json({ profile: result.rows[0] ? JSON.parse((await import("@/lib/security")).decrypt(result.rows[0].profile_ciphertext) ?? "{}") : null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiFailure(error); }
}

export async function PUT(request: Request) {
  try {
    if (!(await limitRequest(request, "profile:put", 20))) return jsonError("Too many requests.", 429);
    const user = await currentUser();
    if (!user) return jsonError("Sign in to continue.", 401);
    const parsed = profileSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError("Check the profile details and try again.", 400);
    await db().query(`INSERT INTO user_profiles(user_id,profile_ciphertext) VALUES($1,$2)
      ON CONFLICT(user_id) DO UPDATE SET profile_ciphertext=EXCLUDED.profile_ciphertext,updated_at=now()`, [user.id, encrypt(JSON.stringify(parsed.data))]);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiFailure(error); }
}
