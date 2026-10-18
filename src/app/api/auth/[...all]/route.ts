import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handler(method: "GET" | "POST", request: Request) {
  const route = toNextJsHandler(auth());
  return route[method](request);
}
export const GET = (request: Request) => handler("GET", request);
export const POST = (request: Request) => handler("POST", request);
