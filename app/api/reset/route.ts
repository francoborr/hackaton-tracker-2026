import { checkPin, unauthorized } from "@/lib/pin";
import { updateGame } from "@/lib/store";

// Vuelve la travesía al estado previo al zarpe: se borra todo lo jugado, la flota queda.
export async function POST(req: Request) {
  if (!checkPin(req)) return unauthorized();
  const game = await updateGame((g) => {
    g.startedAt = null;
    g.effects = [];
    g.usages = [];
    g.bonus = {};
    return g;
  });
  return Response.json(game);
}
