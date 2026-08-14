import { checkPin, unauthorized } from "@/lib/pin";
import { updateGame } from "@/lib/store";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!checkPin(req)) return unauthorized();
  const { id } = await params;
  const game = await updateGame((g) => {
    g.effects = g.effects.filter((e) => e.id !== id);
    return g;
  });
  return Response.json(game);
}
