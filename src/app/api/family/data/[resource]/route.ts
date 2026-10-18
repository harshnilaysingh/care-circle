import { z } from "zod";
import { apiFailure } from "@/lib/errors";
import { db, inTransaction } from "@/lib/db";
import { decrypt, encrypt, jsonError, requireActiveFamily, secureId, writeAudit, lockActiveFamily } from "@/lib/security";

export const runtime = "nodejs";
const resourceSchema = z.enum(["tasks", "updates", "chat", "appointments", "notes", "finances"]);

export async function GET(request: Request, context: { params: Promise<{ resource: string }> }) {
  try {
    const access = await requireActiveFamily(request, 90);
    if ("response" in access) return access.response;
    const { resource } = await context.params;
    const parsedResource = resourceSchema.safeParse(resource);
    if (!parsedResource.success) return jsonError("Unknown family record type.", 404);
    const familyId = access.family.id;
    let items: Record<string, unknown>[] = [];
    if (resource === "tasks") {
      items = (await db().query("SELECT id,title,detail_ciphertext,due_at,status,assigned_to,created_at FROM family_tasks WHERE family_id=$1 AND status<>'cancelled' ORDER BY due_at NULLS LAST,created_at DESC LIMIT 100", [familyId])).rows.map((row) => ({ id: row.id, title: row.title, detail: decrypt(row.detail_ciphertext), dueAt: row.due_at, status: row.status, assignedTo: row.assigned_to, createdAt: row.created_at }));
    } else if (resource === "updates") {
      items = (await db().query("SELECT id,created_by,body_ciphertext,created_at FROM daily_updates WHERE family_id=$1 ORDER BY created_at DESC LIMIT 100", [familyId])).rows.map((row) => ({ id: row.id, createdBy: row.created_by, body: decrypt(row.body_ciphertext), createdAt: row.created_at }));
    } else if (resource === "chat") {
      items = (await db().query("SELECT id,created_by,body_ciphertext,created_at FROM chat_messages WHERE family_id=$1 ORDER BY created_at DESC LIMIT 100", [familyId])).rows.map((row) => ({ id: row.id, createdBy: row.created_by, body: decrypt(row.body_ciphertext), createdAt: row.created_at }));
    } else if (resource === "appointments") {
      items = (await db().query("SELECT id,title,starts_at,location_ciphertext,notes_ciphertext,created_at FROM care_appointments WHERE family_id=$1 ORDER BY starts_at LIMIT 100", [familyId])).rows.map((row) => ({ id: row.id, title: row.title, startsAt: row.starts_at, location: decrypt(row.location_ciphertext), notes: decrypt(row.notes_ciphertext), createdAt: row.created_at }));
    } else if (resource === "notes") {
      items = (await db().query("SELECT id,title,body_ciphertext,created_at FROM care_notes WHERE family_id=$1 ORDER BY updated_at DESC LIMIT 100", [familyId])).rows.map((row) => ({ id: row.id, title: row.title, body: decrypt(row.body_ciphertext), createdAt: row.created_at }));
    } else {
      const row = (await db().query("SELECT monthly_income_ciphertext,monthly_budget_ciphertext,currency_code,updated_at FROM household_finances WHERE family_id=$1", [familyId])).rows[0];
      items = row ? [{ monthlyIncome: decrypt(row.monthly_income_ciphertext), monthlyBudget: decrypt(row.monthly_budget_ciphertext), currency: row.currency_code, updatedAt: row.updated_at }] : [];
    }
    return Response.json({ items }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiFailure(error); }
}

export async function POST(request: Request, context: { params: Promise<{ resource: string }> }) {
  try {
    const access = await requireActiveFamily(request, 40);
    if ("response" in access) return access.response;
    const { resource } = await context.params;
    if (!resourceSchema.safeParse(resource).success) return jsonError("Unknown family record type.", 404);
    const payload = await request.json();
    const id = secureId();
    let schema: z.ZodType;
    if (resource === "tasks") schema = z.object({ title: z.string().trim().min(1).max(160), detail: z.string().max(3000).optional(), dueAt: z.string().datetime().optional(), assignedTo: z.string().uuid().optional() }).strict();
    else if (["updates", "chat"].includes(resource)) schema = z.object({ body: z.string().trim().min(1).max(resource === "chat" ? 4000 : 8000) }).strict();
    else if (resource === "appointments") schema = z.object({ title: z.string().trim().min(1).max(160), startsAt: z.string().datetime(), location: z.string().max(1000).optional(), notes: z.string().max(4000).optional() }).strict();
    else if (resource === "notes") schema = z.object({ title: z.string().trim().min(1).max(160), body: z.string().trim().min(1).max(8000) }).strict();
    else schema = z.object({ monthlyIncome: z.number().nonnegative().max(100000000).optional(), monthlyBudget: z.number().nonnegative().max(100000000).optional(), currency: z.string().regex(/^[A-Z]{3}$/).default("USD") }).strict();
    const parsed = schema.safeParse(payload);
    if (!parsed.success) return jsonError("Check the information and try again.", 400);
    const data = parsed.data as Record<string, unknown>;
    await inTransaction(async (client) => {
      await lockActiveFamily(client, access.family.id);
      if (resource === "tasks") {
        if (data.assignedTo) {
          const member = await client.query("SELECT 1 FROM family_members WHERE family_id=$1 AND user_id=$2 AND status='active'", [access.family.id, data.assignedTo]);
          if (!member.rowCount) throw new Error("INVALID_ASSIGNEE");
        }
        await client.query("INSERT INTO family_tasks(id,family_id,created_by,assigned_to,title,detail_ciphertext,due_at) VALUES($1,$2,$3,$4,$5,$6,$7)", [id, access.family.id, access.user.id, data.assignedTo ?? null, data.title, data.detail ? encrypt(String(data.detail)) : null, data.dueAt ?? null]);
      } else if (resource === "updates") {
        await client.query("INSERT INTO daily_updates(id,family_id,created_by,body_ciphertext) VALUES($1,$2,$3,$4)", [id, access.family.id, access.user.id, encrypt(String(data.body))]);
      } else if (resource === "chat") {
        await client.query("INSERT INTO chat_messages(id,family_id,created_by,body_ciphertext) VALUES($1,$2,$3,$4)", [id, access.family.id, access.user.id, encrypt(String(data.body))]);
      } else if (resource === "appointments") {
        await client.query("INSERT INTO care_appointments(id,family_id,created_by,title,starts_at,location_ciphertext,notes_ciphertext) VALUES($1,$2,$3,$4,$5,$6,$7)", [id, access.family.id, access.user.id, data.title, data.startsAt, data.location ? encrypt(String(data.location)) : null, data.notes ? encrypt(String(data.notes)) : null]);
      } else if (resource === "notes") {
        await client.query("INSERT INTO care_notes(id,family_id,created_by,title,body_ciphertext) VALUES($1,$2,$3,$4,$5)", [id, access.family.id, access.user.id, data.title, encrypt(String(data.body))]);
      } else {
        await client.query(`INSERT INTO household_finances(family_id,monthly_income_ciphertext,monthly_budget_ciphertext,currency_code,updated_by)
          VALUES($1,$2,$3,$4,$5) ON CONFLICT(family_id) DO UPDATE SET monthly_income_ciphertext=EXCLUDED.monthly_income_ciphertext,
          monthly_budget_ciphertext=EXCLUDED.monthly_budget_ciphertext,currency_code=EXCLUDED.currency_code,updated_by=EXCLUDED.updated_by,updated_at=now()`,
          [access.family.id, data.monthlyIncome === undefined ? null : encrypt(String(data.monthlyIncome)), data.monthlyBudget === undefined ? null : encrypt(String(data.monthlyBudget)), data.currency, access.user.id]);
      }
      await writeAudit(client, access.family.id, access.user.id, resource === "finances" ? "finances.updated" : `${resource}.created`, resource, id);
    });
    return Response.json({ ok: true, id }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_ASSIGNEE") return jsonError("Choose a current family member for this task.", 400);
    return apiFailure(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ resource: string }> }) {
  try {
    const access = await requireActiveFamily(request, 50);
    if ("response" in access) return access.response;
    const { resource } = await context.params;
    if (resource !== "tasks") return jsonError("Only task status can be updated here.", 405);
    const parsed = z.object({ id: z.string().uuid(), status: z.enum(["open", "done"]) }).strict().safeParse(await request.json());
    if (!parsed.success) return jsonError("Invalid task update.", 400);
    const result = await inTransaction(async (client) => {
      await lockActiveFamily(client, access.family.id);
      const updated = await client.query("UPDATE family_tasks SET status=$3,updated_at=now() WHERE id=$1 AND family_id=$2 AND status<>'cancelled' RETURNING id", [parsed.data.id, access.family.id, parsed.data.status]);
      if (updated.rowCount) await writeAudit(client, access.family.id, access.user.id, "task.updated", "task", parsed.data.id);
      return updated.rowCount;
    });
    if (!result) return jsonError("Task not found.", 404);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiFailure(error); }
}

export async function DELETE(request: Request, context: { params: Promise<{ resource: string }> }) {
  try {
    const access = await requireActiveFamily(request, 30);
    if ("response" in access) return access.response;
    const { resource } = await context.params;
    const allowed = { tasks: "family_tasks", updates: "daily_updates", chat: "chat_messages", appointments: "care_appointments", notes: "care_notes" } as const;
    if (!(resource in allowed)) return jsonError("This record cannot be deleted here.", 405);
    const table = allowed[resource as keyof typeof allowed];
    const id = new URL(request.url).searchParams.get("id");
    if (!id || id.length > 80) return jsonError("Record id is required.", 400);
    const result = await inTransaction(async (client) => {
      await lockActiveFamily(client, access.family.id);
      const updated = await client.query(`DELETE FROM ${table} WHERE id=$1 AND family_id=$2 AND (created_by=$3 OR $4::boolean) RETURNING id`, [id, access.family.id, access.user.id, access.family.ownerId === access.user.id]);
      if (updated.rowCount) await writeAudit(client, access.family.id, access.user.id, `${resource}.deleted`, resource, id);
      return updated.rowCount;
    });
    if (!result) return jsonError("Record not found or you cannot remove it.", 404);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiFailure(error); }
}
