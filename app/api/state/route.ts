import { activeEffects } from "@/lib/game";
import { loadGame } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const now = new Date();
  const game = await loadGame();
  // serverNow deja que los clientes corrijan el reloj propio: los countdowns y los
  // créditos salen de la hora del server, no de la del teléfono del jurado.
  return Response.json({
    ...game,
    effects: activeEffects(game, now),
    serverNow: now.toISOString(),
  });
}
