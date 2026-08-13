import { checkPin, unauthorized } from "@/lib/pin";
import { loadGame, saveGame } from "@/lib/store";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!checkPin(req)) return unauthorized();
  const { id } = await params;
  const game = await loadGame();
  game.teams = game.teams.filter((t) => t.id !== id);
  game.effects = game.effects.filter((e) => e.attackerId !== id && e.victimId !== id);
  await saveGame(game);
  return Response.json(game);
}
