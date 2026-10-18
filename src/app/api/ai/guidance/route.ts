import { z } from "zod";
import { apiFailure } from "@/lib/errors";
import { jsonError, requireActiveFamily } from "@/lib/security";

export const runtime = "nodejs";
const inputSchema = z.object({ focus: z.enum(["parenting", "aging-parent"]), question: z.string().trim().min(10).max(1800), consent: z.literal(true) }).strict();

export async function POST(request: Request) {
  try {
    const access = await requireActiveFamily(request, 5);
    if ("response" in access) return access.response;
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError("Choose a care focus and share a little more detail.", 400);
    const key = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL;
    if (!key || !model) throw new Error("AI_NOT_CONFIGURED");
    const focus = parsed.data.focus === "parenting" ? "supporting a parent with everyday parenting of a child" : "supporting a family caring for an aging parent";
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, max_output_tokens: 700, store: false, input: [
        { role: "developer", content: "Give warm, practical, non-judgmental family care ideas. Ask clarifying questions only if essential. Do not diagnose, prescribe, or suggest stopping medication. For urgent danger or medical symptoms, tell them to contact qualified local help. Organize into a few concise steps and include one kind next action. Do not claim to be a clinician." },
        { role: "user", content: `Focus: ${focus}. Situation: ${parsed.data.question}` },
      ] }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`AI_PROVIDER_${response.status}`);
    const result = await response.json() as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
    const text = result.output?.flatMap((item) => item.content ?? []).filter((item) => item.type === "output_text").map((item) => item.text ?? "").join("\n").trim();
    if (!text) throw new Error("AI_EMPTY_RESPONSE");
    return Response.json({ guidance: text, disclaimer: "Everyday support only. For health concerns, contact a qualified clinician." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiFailure(error); }
}
