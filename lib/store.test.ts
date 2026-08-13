import { beforeEach, expect, it, vi } from "vitest";
import { emptyGame } from "./game";
import { resetMemory, saveGame } from "./store";

beforeEach(() => {
  resetMemory();
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
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
