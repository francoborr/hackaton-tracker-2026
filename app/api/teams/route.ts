import { checkPin, unauthorized } from "@/lib/pin";
import { loadGame, saveGame } from "@/lib/store";

export async function POST(req: Request) {
  if (!checkPin(req)) return unauthorized();

  let body: { name?: string };
  try {
    body = (await req.json()) as { name?: string };
  } catch {
    return Response.json({ error: "cuerpo inválido" }, { status: 422 });
  }

  const trimmed = typeof body?.name === "string" ? body.name.trim() : "";
  if (!trimmed) return Response.json({ error: "nombre requerido" }, { status: 422 });
  const game = await loadGame();
  if (game.teams.some((t) => t.name === trimmed)) {
    return Response.json({ error: "ese barco ya existe" }, { status: 422 });
  }
  game.teams.push({ id: crypto.randomUUID(), name: trimmed });
  await saveGame(game);
  return Response.json(game);
}
