import { resolvePlay, type PlayInput } from "@/lib/game";
import { checkPin, unauthorized } from "@/lib/pin";
import { loadGame, saveGame } from "@/lib/store";

// Los únicos mensajes de resolvePlay que se le muestran al jurado; cualquier otra
// falla (input que no es un objeto, bug) sale como "jugada inválida".
const DOMAIN_ERRORS = new Set([
  "carta inválida",
  "falta la víctima",
  "defensa inválida",
  "falta el barco redirigido",
  "la víctima ya está bajo una maldición",
  "el barco redirigido ya está bajo una maldición",
  "el atacante ya está bajo una maldición",
  "esa ayuda ya está en uso",
]);

export async function POST(req: Request) {
  if (!checkPin(req)) return unauthorized();

  let input: PlayInput;
  try {
    input = (await req.json()) as PlayInput;
  } catch {
    return Response.json({ error: "cuerpo inválido" }, { status: 422 });
  }

  const game = await loadGame();
  let next;
  try {
    next = resolvePlay(game, input, new Date(), () => crypto.randomUUID());
  } catch (e) {
    const message = e instanceof Error && DOMAIN_ERRORS.has(e.message) ? e.message : "jugada inválida";
    return Response.json({ error: message }, { status: 422 });
  }
  await saveGame(next);
  return Response.json(next);
}
