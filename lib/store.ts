import { Redis } from "@upstash/redis";
import { emptyGame, type Game } from "./game";

const KEY = "game";

// La integración de Upstash del marketplace de Vercel inyecta KV_*; una base creada a
// mano en Upstash usa UPSTASH_REDIS_*. Aceptamos ambos nombres.
function redisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

// En `next dev` cada route handler puede evaluar este módulo por separado, así que el
// doc en memoria cuelga de globalThis: una sola copia para todas las rutas.
const g = globalThis as typeof globalThis & { __gameMemory?: { game: Game | null } };
const memory = (g.__gameMemory ??= { game: null });

export async function loadGame(): Promise<Game> {
  const redis = redisClient();
  if (redis) {
    const doc = await redis.get<Partial<Game>>(KEY);
    return { ...emptyGame(), ...doc };
  }
  return memory.game ? structuredClone(memory.game) : emptyGame();
}

export async function saveGame(game: Game): Promise<void> {
  const redis = redisClient();
  if (redis) {
    await redis.set(KEY, game);
    return;
  }
  memory.game = structuredClone(game);
}

export function resetMemory(): void {
  memory.game = null;
}
