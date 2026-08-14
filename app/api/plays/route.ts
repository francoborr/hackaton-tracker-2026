import { resolvePlay, type PlayInput } from "@/lib/game";
import { checkPin, unauthorized } from "@/lib/pin";
import { updateGame } from "@/lib/store";

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
  "ese barco ya no está en la flota",
  "un barco no puede atacarse a sí mismo",
  "la redirección debe ir a otro barco",
]);

export async function POST(req: Request) {
  if (!checkPin(req)) return unauthorized();

  let input: PlayInput;
  try {
    input = (await req.json()) as PlayInput;
  } catch {
    return Response.json({ error: "cuerpo inválido" }, { status: 422 });
  }

  try {
    const next = await updateGame((game) =>
      resolvePlay(game, input, new Date(), () => crypto.randomUUID()),
    );
    return Response.json(next);
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    if (message === "conflicto de escritura") {
      return Response.json({ error: "hubo un choque de escrituras — probá de nuevo" }, { status: 409 });
    }
    return Response.json(
      { error: DOMAIN_ERRORS.has(message) ? message : "jugada inválida" },
      { status: 422 },
    );
  }
}
