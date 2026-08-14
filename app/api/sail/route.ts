import { checkPin, unauthorized } from "@/lib/pin";
import { updateGame } from "@/lib/store";

export async function POST(req: Request) {
  if (!checkPin(req)) return unauthorized();
  const game = await updateGame((g) => {
    if (!g.startedAt) g.startedAt = new Date().toISOString();
    return g;
  });
  return Response.json(game);
}
