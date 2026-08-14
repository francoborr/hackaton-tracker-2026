import { checkPin, unauthorized } from "@/lib/pin";
import { updateGame } from "@/lib/store";

// Corre el zarpe una hora hacia atrás: todos los barcos ganan un crédito. Escotilla
// de escape para testear o para compensar un bug el día del evento.
export async function POST(req: Request) {
  if (!checkPin(req)) return unauthorized();
  try {
    const game = await updateGame((g) => {
      if (!g.startedAt) throw new Error("todavía no zarparon");
      g.startedAt = new Date(new Date(g.startedAt).getTime() - 3_600_000).toISOString();
      return g;
    });
    return Response.json(game);
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    if (message === "todavía no zarparon") {
      return Response.json({ error: message }, { status: 422 });
    }
    throw e;
  }
}
