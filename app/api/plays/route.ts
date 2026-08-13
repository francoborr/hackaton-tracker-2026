import { resolvePlay, type PlayInput } from "@/lib/game";
import { checkPin, unauthorized } from "@/lib/pin";
import { loadGame, saveGame } from "@/lib/store";

export async function POST(req: Request) {
  if (!checkPin(req)) return unauthorized();
  const input = (await req.json()) as PlayInput;
  const game = await loadGame();
  let next;
  try {
    next = resolvePlay(game, input, new Date(), () => crypto.randomUUID());
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 422 });
  }
  await saveGame(next);
  return Response.json(next);
}
