import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { emptyGame, type Game } from "./game";
import { resetMemory, saveGame, loadGame, updateGame } from "./store";

beforeEach(() => {
  resetMemory();
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock("@upstash/redis");
  vi.resetModules();
});

// En `next dev` cada route handler puede evaluar el módulo por separado: el doc en
// memoria tiene que vivir en globalThis para que /api/teams y /api/state vean lo mismo.
it("comparte el doc en memoria entre instancias del módulo", async () => {
  const game = { ...emptyGame(), teams: [{ id: "t1", name: "La Perla Negra" }] };
  await saveGame(game);

  vi.resetModules();
  const fresh = await import("./store");
  expect((await fresh.loadGame()).teams).toEqual([{ id: "t1", name: "La Perla Negra" }]);
});

it("con las env vars vacías cae a memoria en desarrollo", async () => {
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  vi.stubEnv("KV_REST_API_URL", "");
  vi.stubEnv("KV_REST_API_TOKEN", "");

  await saveGame({ ...emptyGame(), teams: [{ id: "t1", name: "La Perla Negra" }] });
  expect((await loadGame()).teams).toHaveLength(1);
});

// Un UPSTASH_* vacío no tiene que tapar al KV_* que inyecta Vercel.
it("usa las KV_* cuando las UPSTASH_* vienen vacías", async () => {
  const seen: { url?: string } = {};
  const store = new Map<string, unknown>();
  vi.doMock("@upstash/redis", () => ({
    Redis: class {
      constructor(opts: { url: string }) {
        seen.url = opts.url;
      }
      async get(key: string) {
        return store.get(key) ?? null;
      }
      async set(key: string, value: unknown) {
        store.set(key, value);
      }
    },
  }));
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  vi.stubEnv("KV_REST_API_URL", "https://fake.upstash.io");
  vi.stubEnv("KV_REST_API_TOKEN", "tok");
  vi.resetModules();

  const fresh = await import("./store");
  await fresh.saveGame({ ...emptyGame(), teams: [{ id: "t1", name: "La Perla Negra" }] });
  expect(seen.url).toBe("https://fake.upstash.io");
  expect(store.get("game")).toMatchObject({ teams: [{ id: "t1", name: "La Perla Negra" }] });
  expect((await fresh.loadGame()).teams).toHaveLength(1);
});

// En producción sin Redis cada lambda tendría su propia copia en memoria: mejor romper.
it("en producción sin config de Redis explota en vez de usar memoria", async () => {
  vi.stubEnv("NODE_ENV", "production");
  await expect(loadGame()).rejects.toThrow("falta la config de Redis");
  await expect(saveGame(emptyGame())).rejects.toThrow("falta la config de Redis");
  await expect(updateGame((g) => g)).rejects.toThrow("falta la config de Redis");
});

it("saveGame sube la rev en cada escritura", async () => {
  await saveGame(emptyGame());
  expect((await loadGame()).rev).toBe(1);
  await saveGame(await loadGame());
  expect((await loadGame()).rev).toBe(2);
});

// Dos jurados registrando dentro de un mismo round-trip: el segundo tiene que reintentar
// sobre el doc nuevo, no pisar la jugada del primero.
it("updateGame reintenta cuando otro escritor gana la carrera", async () => {
  await saveGame(emptyGame());
  const add = (team: { id: string; name: string }) => (game: Game) => ({
    ...game,
    teams: [...game.teams, team],
  });

  await Promise.all([
    updateGame(add({ id: "t1", name: "La Perla Negra" })),
    updateGame(add({ id: "t2", name: "Barbanegra" })),
  ]);

  expect((await loadGame()).teams.map((t) => t.id)).toEqual(["t1", "t2"]);
});

it("updateGame se rinde con 'conflicto de escritura' si nunca gana", async () => {
  await saveGame(emptyGame());
  let attempts = 0;
  const alwaysRaced = (game: Game) => {
    attempts++;
    void saveGame(game); // otro escritor mete la cuchara justo antes del guardado
    return game;
  };

  await expect(updateGame(alwaysRaced)).rejects.toThrow("conflicto de escritura");
  expect(attempts).toBe(5);
});

it("updateGame propaga los errores del dominio sin reintentar", async () => {
  await saveGame(emptyGame());
  let attempts = 0;
  await expect(
    updateGame(() => {
      attempts++;
      throw new Error("carta inválida");
    }),
  ).rejects.toThrow("carta inválida");
  expect(attempts).toBe(1);
});
