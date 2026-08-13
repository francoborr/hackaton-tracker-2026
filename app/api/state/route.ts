import { activeEffects } from "@/lib/game";
import { loadGame } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const game = await loadGame();
  return Response.json({ ...game, effects: activeEffects(game, new Date()) });
}
