import { Redis } from "@upstash/redis";
import { emptyGame, type Game } from "./game";

const KEY = "game";

function redisClient(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  return Redis.fromEnv();
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
