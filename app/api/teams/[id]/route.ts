import { checkPin, unauthorized } from "@/lib/pin";
import { updateGame } from "@/lib/store";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!checkPin(req)) return unauthorized();
  const { id } = await params;
  const game = await updateGame((g) => {
    g.teams = g.teams.filter((t) => t.id !== id);
    // Solo se cancelan las maldiciones que sufría: las que lanzó siguen corriendo sobre
    // sus víctimas (el tablero muestra "¿?" como atacante).
    g.effects = g.effects.filter((e) => e.victimId !== id);
    g.usages = g.usages.filter((u) => u.teamId !== id);
    delete g.bonus[id];
    return g;
  });
  return Response.json(game);
}
