import { Redis } from "@upstash/redis";
import { emptyGame, type Game } from "./game";

const KEY = "game";

function redisClient(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  return Redis.fromEnv();
}

const memory: { game: Game | null } = { game: null };

export async function loadGame(): Promise<Game> {
  const redis = redisClient();
  if (redis) return (await redis.get<Game>(KEY)) ?? emptyGame();
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
