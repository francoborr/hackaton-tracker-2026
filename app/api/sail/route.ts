import { checkPin, unauthorized } from "@/lib/pin";
import { loadGame, saveGame } from "@/lib/store";

export async function POST(req: Request) {
  if (!checkPin(req)) return unauthorized();
  const game = await loadGame();
  if (!game.startedAt) game.startedAt = new Date().toISOString();
  await saveGame(game);
  return Response.json(game);
}
