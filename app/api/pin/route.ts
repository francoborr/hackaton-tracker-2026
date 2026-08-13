import { checkPin, unauthorized } from "@/lib/pin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!checkPin(req)) return unauthorized();
  return Response.json({ ok: true });
}
