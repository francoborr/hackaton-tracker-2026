import { checkPin, unauthorized } from "@/lib/pin";
import { loadGame, saveGame } from "@/lib/store";

// Vuelve la travesía al estado previo al zarpe: se borra todo lo jugado, la flota queda.
export async function POST(req: Request) {
  if (!checkPin(req)) return unauthorized();
  const game = await loadGame();
  game.startedAt = null;
  game.effects = [];
  game.usages = [];
  game.bonus = {};
  await saveGame(game);
  return Response.json(game);
}
