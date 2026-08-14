import { checkPin, unauthorized } from "@/lib/pin";
import { loadGame, saveGame } from "@/lib/store";

// Corre el zarpe una hora hacia atrás: todos los barcos ganan un crédito. Escotilla
// de escape para testear o para compensar un bug el día del evento.
export async function POST(req: Request) {
  if (!checkPin(req)) return unauthorized();
  const game = await loadGame();
  if (!game.startedAt) {
    return Response.json({ error: "todavía no zarparon" }, { status: 422 });
  }
  game.startedAt = new Date(new Date(game.startedAt).getTime() - 3_600_000).toISOString();
  await saveGame(game);
  return Response.json(game);
}
