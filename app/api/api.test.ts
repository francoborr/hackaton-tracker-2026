import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetMemory, loadGame, saveGame } from "@/lib/store";
import { emptyGame } from "@/lib/game";
import { GET as getState } from "@/app/api/state/route";
import { POST as postPlay } from "@/app/api/plays/route";
import { DELETE as deleteEffect } from "@/app/api/effects/[id]/route";
import { POST as postTeam } from "@/app/api/teams/route";
import { DELETE as deleteTeam } from "@/app/api/teams/[id]/route";
import { POST as postSail } from "@/app/api/sail/route";
import { GET as getPin } from "@/app/api/pin/route";

function req(body?: unknown, pin?: string): Request {
  return new Request("http://test.local/", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(pin ? { "x-jury-pin": pin } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function rawReq(body: string): Request {
  return new Request("http://test.local/", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

function clearEnv() {
  delete process.env.JURY_PIN;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
}

beforeEach(() => {
  resetMemory();
  clearEnv();
});

afterEach(() => {
  clearEnv();
  vi.unstubAllEnvs();
});

describe("PIN", () => {
  it("bloquea mutaciones sin PIN cuando JURY_PIN está seteado", async () => {
    process.env.JURY_PIN = "1234";
    expect((await postSail(req())).status).toBe(401);
    expect((await postSail(req(undefined, "1234"))).status).toBe(200);
    expect((await getPin(req(undefined, "9999"))).status).toBe(401);
    expect((await getPin(req(undefined, "1234"))).status).toBe(200);
  });

  it("sin JURY_PIN bloquea en producción y deja abierto en desarrollo", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect((await postSail(req())).status).toBe(401);

    vi.unstubAllEnvs(); // vuelve a NODE_ENV=test
    expect((await postSail(req())).status).toBe(200);
  });

  it("bloquea todas las rutas de mutación sin PIN o con PIN incorrecto", async () => {
    process.env.JURY_PIN = "1234";
    const mutations = (pin?: string) => [
      postPlay(req({ attackerId: "t1", cardId: "naufrago", victimId: "t2" }, pin)),
      postTeam(req({ name: "La Perla Negra" }, pin)),
      deleteTeam(req(undefined, pin), { params: Promise.resolve({ id: "t1" }) }),
      deleteEffect(req(undefined, pin), { params: Promise.resolve({ id: "e1" }) }),
      postSail(req(undefined, pin)),
    ];

    for (const res of await Promise.all(mutations())) expect(res.status).toBe(401);
    for (const res of await Promise.all(mutations("9999"))) expect(res.status).toBe(401);
    for (const res of await Promise.all(mutations("1234"))) expect(res.status).toBe(200);
  });
});

describe("flujo de juego", () => {
  it("zarpar + equipos + jugada + terminar", async () => {
    await postSail(req());
    await postTeam(req({ name: "La Perla Negra" }));
    await postTeam(req({ name: "Barbanegra" }));
    let game = await (await getState()).json();
    expect(game.teams).toHaveLength(2);
    expect(game.startedAt).not.toBeNull();

    const [t1, t2] = game.teams;
    const res = await postPlay(req({ attackerId: t2.id, cardId: "naufrago", victimId: t1.id }));
    expect(res.status).toBe(200);
    game = await (await getState()).json();
    expect(game.effects).toHaveLength(1);

    const del = await deleteEffect(req(), { params: Promise.resolve({ id: game.effects[0].id }) });
    expect(del.status).toBe(200);
    game = await (await getState()).json();
    expect(game.effects).toHaveLength(0);
    expect(game.usages).toHaveLength(1); // terminar no devuelve el crédito
  });

  it("rechaza jugadas inválidas con 422", async () => {
    const res = await postPlay(req({ attackerId: "t1", cardId: "nope" }));
    expect(res.status).toBe(422);
  });

  it("rechaza cuerpos ausentes o que no son JSON con 422", async () => {
    for (const res of [
      await postPlay(req()),
      await postPlay(rawReq("{")),
      await postTeam(req()),
      await postTeam(rawReq("{")),
    ]) {
      expect(res.status).toBe(422);
      expect(await res.json()).toEqual({ error: "cuerpo inválido" });
    }
  });

  it("no filtra mensajes internos cuando la jugada no es un objeto", async () => {
    const res = await postPlay(req(null));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "jugada inválida" });
  });

  it("rechaza equipo sin nombre o duplicado", async () => {
    expect((await postTeam(req({ name: "  " }))).status).toBe(422);
    await postTeam(req({ name: "El Kraken" }));
    expect((await postTeam(req({ name: "El Kraken" }))).status).toBe(422);
  });

  it("borrar equipo elimina sus efectos", async () => {
    await postTeam(req({ name: "A" }));
    await postTeam(req({ name: "B" }));
    let game = await (await getState()).json();
    const [a, b] = game.teams;
    await postPlay(req({ attackerId: a.id, cardId: "naufrago", victimId: b.id }));
    await deleteTeam(req(), { params: Promise.resolve({ id: b.id }) });
    game = await (await getState()).json();
    expect(game.teams.map((t: { name: string }) => t.name)).toEqual(["A"]);
    expect(game.effects).toHaveLength(0);
  });

  it("GET /api/state filtra efectos expirados", async () => {
    const g = emptyGame();
    g.effects.push({
      id: "e1", cardId: "naufrago", attackerId: "x", victimId: "y",
      endsAt: new Date(Date.now() - 1000).toISOString(),
    });
    await saveGame(g);
    const game = await (await getState()).json();
    expect(game.effects).toHaveLength(0);
    expect((await loadGame()).effects).toHaveLength(1); // el filtro es de lectura, no borra
  });

  it("zarpar es idempotente", async () => {
    await postSail(req());
    const first = (await loadGame()).startedAt;
    await postSail(req());
    expect((await loadGame()).startedAt).toBe(first);
  });
});
