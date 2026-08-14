import { checkPin, unauthorized } from "@/lib/pin";
import { updateGame } from "@/lib/store";

export async function POST(req: Request) {
  if (!checkPin(req)) return unauthorized();

  let body: { name?: string };
  try {
    body = (await req.json()) as { name?: string };
  } catch {
    return Response.json({ error: "cuerpo inválido" }, { status: 422 });
  }

  const trimmed = typeof body?.name === "string" ? body.name.trim() : "";
  if (!trimmed) return Response.json({ error: "nombre requerido" }, { status: 422 });

  try {
    // El duplicado se chequea adentro del mutador: si otro jurado sumó el mismo barco
    // mientras tanto, el reintento lo ve.
    const game = await updateGame((g) => {
      if (g.teams.some((t) => t.name === trimmed)) throw new Error("ese barco ya existe");
      g.teams.push({ id: crypto.randomUUID(), name: trimmed });
      return g;
    });
    return Response.json(game);
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    if (message === "ese barco ya existe") {
      return Response.json({ error: message }, { status: 422 });
    }
    throw e;
  }
}
