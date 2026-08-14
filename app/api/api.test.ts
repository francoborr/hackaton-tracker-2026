import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetMemory, loadGame, saveGame } from "@/lib/store";
import { emptyGame } from "@/lib/game";
import { GET as getState } from "@/app/api/state/route";
import { POST as postPlay } from "@/app/api/plays/route";
import { DELETE as deleteEffect } from "@/app/api/effects/[id]/route";
import { POST as postTeam } from "@/app/api/teams/route";
import { DELETE as deleteTeam } from "@/app/api/teams/[id]/route";
import { POST as postSail } from "@/app/api/sail/route";
import { POST as postReset } from "@/app/api/reset/route";
import { POST as postAdvance } from "@/app/api/advance-hour/route";
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
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
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

  it("sin JURY_PIN en producción /api/pin avisa que falta configurarlo", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = await getPin(req());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "el PIN del jurado no está configurado" });

    // con PIN configurado sigue siendo un 401 común
    process.env.JURY_PIN = "1234";
    expect((await getPin(req(undefined, "9999"))).status).toBe(401);
  });

  it("bloquea todas las rutas de mutación sin PIN o con PIN incorrecto", async () => {
    // la jugada exige barcos reales y créditos: hay que haber zarpado
    await saveGame({
      ...emptyGame(),
      startedAt: new Date().toISOString(),
      teams: [{ id: "t1", name: "A" }, { id: "t2", name: "B" }, { id: "t3", name: "C" }],
    });
    process.env.JURY_PIN = "1234";
    // Perezosas: con PIN válido van en orden, porque reiniciar le borra los créditos
    // a la jugada y saldría 422 según quién gane la carrera.
    const mutations = (pin?: string) => [
      () => postPlay(req({ attackerId: "t2", cardId: "naufrago", victimId: "t3" }, pin)),
      () => postTeam(req({ name: "La Perla Negra" }, pin)),
      () => deleteTeam(req(undefined, pin), { params: Promise.resolve({ id: "t1" }) }),
      () => deleteEffect(req(undefined, pin), { params: Promise.resolve({ id: "e1" }) }),
      () => postSail(req(undefined, pin)),
      () => postReset(req(undefined, pin)),
    ];

    for (const call of mutations()) expect((await call()).status).toBe(401);
    for (const call of mutations("9999")) expect((await call()).status).toBe(401);
    for (const call of mutations("1234")) expect((await call()).status).toBe(200);
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

  it("rechaza con 422 la jugada de un barco sin cartas, sin importar el PIN", async () => {
    await postSail(req());
    await postTeam(req({ name: "A" }));
    await postTeam(req({ name: "B" }));
    const { teams } = await (await getState()).json();
    const [a, b] = teams;

    // hora 1: A tiene una sola carta
    expect((await postPlay(req({ attackerId: a.id, cardId: "naufrago", victimId: b.id }))).status).toBe(200);
    const res = await postPlay(req({ attackerId: a.id, cardId: "senal-de-humo" }));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "el barco no tiene cartas disponibles" });

    // y tampoco puede defenderse
    const conDefensa = await postPlay(
      req({ attackerId: b.id, cardId: "mano-de-garfio", victimId: a.id, defense: "casco" }),
    );
    expect(conDefensa.status).toBe(422);
    expect(await conDefensa.json()).toEqual({
      error: "el barco no tiene cartas disponibles para defenderse",
    });
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

  // Una falla de infra no puede disfrazarse de jugada rechazada: el jurado buscaría el
  // error en la carta que eligió.
  it("una falla del store sale como 500, no como jugada inválida", async () => {
    await postTeam(req({ name: "A" }));
    await postTeam(req({ name: "B" }));
    const { teams } = await (await getState()).json();
    process.env.JURY_PIN = "1234";
    vi.stubEnv("NODE_ENV", "production"); // sin config de Redis: loadGame explota

    const res = await postPlay(
      req({ attackerId: teams[0].id, cardId: "naufrago", victimId: teams[1].id }, "1234"),
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "error del servidor" });
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

  it("borrar equipo elimina las maldiciones que sufre pero no las que lanzó", async () => {
    await postSail(req());
    await postTeam(req({ name: "A" }));
    await postTeam(req({ name: "B" }));
    await postTeam(req({ name: "C" }));
    let game = await (await getState()).json();
    const [a, b, c] = game.teams;
    await postPlay(req({ attackerId: a.id, cardId: "naufrago", victimId: b.id }));
    await postPlay(req({ attackerId: b.id, cardId: "mano-de-garfio", victimId: c.id }));

    await deleteTeam(req(), { params: Promise.resolve({ id: b.id }) });
    game = await (await getState()).json();
    expect(game.teams.map((t: { name: string }) => t.name)).toEqual(["A", "C"]);
    // el efecto donde B era víctima se va; el que B le lanzó a C sigue corriendo
    expect(game.effects.map((e: { victimId: string }) => e.victimId)).toEqual([c.id]);
  });

  it("borrar equipo limpia sus usos y su bonus", async () => {
    await postSail(req());
    await postTeam(req({ name: "A" }));
    await postTeam(req({ name: "B" }));
    let game = await (await getState()).json();
    const [a, b] = game.teams;
    // botín: B gasta la defensa y se lleva un bonus
    await postPlay(req({ attackerId: a.id, cardId: "naufrago", victimId: b.id, defense: "botin" }));

    await deleteTeam(req(), { params: Promise.resolve({ id: b.id }) });
    game = await loadGame();
    expect(game.usages.map((u: { teamId: string }) => u.teamId)).toEqual([a.id]);
    expect(game.bonus).toEqual({});
  });

  // Dos jurados registrando dentro del mismo round-trip: antes se perdía una jugada.
  it("dos jugadas simultáneas no se pisan", async () => {
    await postSail(req());
    await postTeam(req({ name: "A" }));
    await postTeam(req({ name: "B" }));
    await postTeam(req({ name: "C" }));
    await postTeam(req({ name: "D" }));
    let game = await (await getState()).json();
    const [a, b, c, d] = game.teams;

    const [r1, r2] = await Promise.all([
      postPlay(req({ attackerId: a.id, cardId: "naufrago", victimId: b.id })),
      postPlay(req({ attackerId: c.id, cardId: "mano-de-garfio", victimId: d.id })),
    ]);
    expect([r1.status, r2.status]).toEqual([200, 200]);

    game = await (await getState()).json();
    expect(game.effects.map((e: { victimId: string }) => e.victimId).sort()).toEqual(
      [b.id, d.id].sort(),
    );
    expect(game.usages).toHaveLength(2);
  });

  it("GET /api/state devuelve serverNow para el reloj del cliente", async () => {
    const game = await (await getState()).json();
    expect(Math.abs(Date.parse(game.serverNow) - Date.now())).toBeLessThan(5000);
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

  it("adelantar una hora corre el zarpe una hora hacia atrás", async () => {
    await postSail(req());
    const started = new Date((await loadGame()).startedAt as string).getTime();

    const res = await postAdvance(req());
    expect(res.status).toBe(200);
    const after = new Date((await loadGame()).startedAt as string).getTime();
    expect(after).toBe(started - 3_600_000);
  });

  it("adelantar una hora sin zarpar devuelve 422", async () => {
    const res = await postAdvance(req());
    expect(res.status).toBe(422);
  });

  it("adelantar una hora respeta el PIN", async () => {
    await postSail(req());
    process.env.JURY_PIN = "1234";
    expect((await postAdvance(req())).status).toBe(401);
    expect((await postAdvance(req(undefined, "9999"))).status).toBe(401);
    expect((await postAdvance(req(undefined, "1234"))).status).toBe(200);
  });

  it("reiniciar vuelve al estado previo al zarpe y conserva la flota", async () => {
    await postTeam(req({ name: "La Perla Negra" }));
    await postTeam(req({ name: "Barbanegra" }));
    await postSail(req());
    let game = await (await getState()).json();
    const [t1, t2] = game.teams;
    await postPlay(req({ attackerId: t2.id, cardId: "naufrago", victimId: t1.id, defense: "botin" }));

    game = await (await getState()).json();
    expect(game.effects.length).toBeGreaterThan(0);
    expect(game.usages.length).toBeGreaterThan(0);
    expect(Object.keys(game.bonus).length).toBeGreaterThan(0);

    const res = await postReset(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ startedAt: null, effects: [], usages: [], bonus: {} });

    game = await loadGame();
    expect(game.teams.map((t: { name: string }) => t.name)).toEqual(["La Perla Negra", "Barbanegra"]);
    expect(game.startedAt).toBeNull();
    expect(game.effects).toEqual([]);
    expect(game.usages).toEqual([]);
    expect(game.bonus).toEqual({});
  });
});
