import { Redis } from "@upstash/redis";
import { emptyGame, type Game } from "./game";

const KEY = "game";

// Compare-and-set: solo escribe si la rev guardada sigue siendo la que leímos. Upstash
// REST no tiene WATCH, así que la comparación va del lado del server en Lua.
const CAS_SCRIPT = `
local cur = redis.call('GET', KEYS[1])
if cur then
  local ok, doc = pcall(cjson.decode, cur)
  local rev = (ok and doc.rev) or 0
  if rev ~= tonumber(ARGV[2]) then return 0 end
end
redis.call('SET', KEYS[1], ARGV[1])
return 1
`;

// La integración de Upstash del marketplace de Vercel inyecta KV_*; una base creada a
// mano en Upstash usa UPSTASH_REDIS_*. Aceptamos ambos nombres. Ojo: `||` y no `??`,
// que una env var vacía no tape a la otra.
function redisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

// Sin Redis cada lambda se guarda su propia copia en memoria: en producción es un bug
// silencioso, mejor romper fuerte. En local la memoria alcanza.
function client(): Redis | null {
  const redis = redisClient();
  if (!redis && process.env.NODE_ENV === "production") {
    throw new Error("falta la config de Redis");
  }
  return redis;
}

// En `next dev` cada route handler puede evaluar este módulo por separado, así que el
// doc en memoria cuelga de globalThis: una sola copia para todas las rutas.
const g = globalThis as typeof globalThis & { __gameMemory?: { game: Game | null } };
const memory = (g.__gameMemory ??= { game: null });

export async function loadGame(): Promise<Game> {
  const redis = client();
  if (redis) {
    const doc = await redis.get<Partial<Game>>(KEY);
    return { ...emptyGame(), ...doc };
  }
  return memory.game ? structuredClone(memory.game) : emptyGame();
}

// Escritura incondicional (semillas y tests). Las mutaciones del juego van por updateGame.
export async function saveGame(game: Game): Promise<void> {
  const redis = client();
  const doc: Game = { ...game, rev: (game.rev ?? 0) + 1 };
  if (redis) {
    await redis.set(KEY, doc);
    return;
  }
  memory.game = structuredClone(doc);
}

async function trySave(next: Game, expectedRev: number): Promise<boolean> {
  const redis = client();
  if (redis) {
    const ok = await redis.eval(CAS_SCRIPT, [KEY], [JSON.stringify(next), String(expectedRev)]);
    return Number(ok) === 1;
  }
  if ((memory.game?.rev ?? 0) !== expectedRev) return false;
  memory.game = structuredClone(next);
  return true;
}

// Lee, muta y guarda solo si nadie escribió en el medio; si perdió la carrera, reintenta
// sobre el doc nuevo. Los errores de dominio del mutador salen derecho, sin reintento.
export async function updateGame(mutate: (game: Game) => Game): Promise<Game> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const game = await loadGame();
    // La rev leída se guarda antes de mutar: los mutadores que devuelven el mismo objeto
    // (sail, reset) pisarían game.rev y el compare-and-set nunca cerraría.
    const rev = game.rev ?? 0;
    const next = mutate(game);
    next.rev = rev + 1;
    if (await trySave(next, rev)) return next;
  }
  throw new Error("conflicto de escritura");
}

export function resetMemory(): void {
  memory.game = null;
}
