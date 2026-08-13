import { checkPin, unauthorized } from "@/lib/pin";
import { loadGame, saveGame } from "@/lib/store";

export async function POST(req: Request) {
  if (!checkPin(req)) return unauthorized();
  const { name } = (await req.json()) as { name?: string };
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed) return Response.json({ error: "nombre requerido" }, { status: 422 });
  const game = await loadGame();
  if (game.teams.some((t) => t.name === trimmed)) {
    return Response.json({ error: "ese barco ya existe" }, { status: 422 });
  }
  game.teams.push({ id: crypto.randomUUID(), name: trimmed });
  await saveGame(game);
  return Response.json(game);
}
