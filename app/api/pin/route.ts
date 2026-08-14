import { checkPin, unauthorized } from "@/lib/pin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Sin JURY_PIN en producción la puerta queda cerrada para todos: mejor decirlo que
  // hacerle creer al jurado que se equivocó de PIN.
  if (!process.env.JURY_PIN && process.env.NODE_ENV === "production") {
    return Response.json({ error: "el PIN del jurado no está configurado" }, { status: 503 });
  }
  if (!checkPin(req)) return unauthorized();
  return Response.json({ ok: true });
}
