import { describe, expect, it } from "vitest";
import {
  activeEffects, credits, currentHour, emptyGame, resolvePlay, type Game,
} from "./game";

const NOW = new Date("2026-09-07T14:00:00Z");

function seq(): () => string {
  let n = 0;
  return () => `id-${++n}`;
}

function baseGame(): Game {
  return {
    ...emptyGame(),
    startedAt: "2026-09-07T12:00:00Z", // hora 3 a las 14:00
    teams: [
      { id: "t1", name: "La Perla Negra" },
      { id: "t2", name: "Barbanegra" },
      { id: "t3", name: "El Kraken" },
    ],
  };
}

describe("currentHour", () => {
  it("es 0 antes de zarpar", () => {
    expect(currentHour(emptyGame(), NOW)).toBe(0);
  });

  it("es 1 al zarpar y suma cada hora", () => {
    const g = baseGame();
    expect(currentHour(g, new Date("2026-09-07T12:00:01Z"))).toBe(1);
    expect(currentHour(g, NOW)).toBe(3);
  });
});

describe("credits", () => {
  it("horas - usos + bonus", () => {
    const g = baseGame();
    g.usages.push({ id: "u1", teamId: "t1", cardId: "naufrago", at: "x" });
    g.bonus["t1"] = 1;
    expect(credits(g, "t1", NOW)).toBe(3); // 3 - 1 + 1
    expect(credits(g, "t2", NOW)).toBe(3);
  });
});

describe("activeEffects", () => {
  it("filtra expirados", () => {
    const g = baseGame();
    g.effects = [
      { id: "e1", cardId: "naufrago", attackerId: "t2", victimId: "t1", endsAt: "2026-09-07T14:05:00Z" },
      { id: "e2", cardId: "naufrago", attackerId: "t2", victimId: "t3", endsAt: "2026-09-07T13:59:00Z" },
    ];
    expect(activeEffects(g, NOW).map((e) => e.id)).toEqual(["e1"]);
  });
});

describe("resolvePlay", () => {
  it("ayuda: usage + bendición de 10 minutos sobre el propio barco", () => {
    const g = resolvePlay(baseGame(), { attackerId: "t1", cardId: "senal-de-humo" }, NOW, seq());
    expect(g.usages).toHaveLength(1);
    expect(g.usages[0]).toMatchObject({ teamId: "t1", cardId: "senal-de-humo" });
    expect(g.effects).toHaveLength(1);
    expect(g.effects[0]).toMatchObject({ attackerId: "t1", victimId: "t1", cardId: "senal-de-humo" });
    expect(g.effects[0].endsAt).toBe("2026-09-07T14:10:00.000Z");
  });

  it("rechaza una ayuda que ya está en uso por otro barco", () => {
    const g = baseGame();
    g.effects.push({ id: "e1", cardId: "senal-de-humo", attackerId: "t2", victimId: "t2", endsAt: "2026-09-07T14:08:00Z" });
    expect(() => resolvePlay(g, { attackerId: "t1", cardId: "senal-de-humo" }, NOW, seq()))
      .toThrow("esa ayuda ya está en uso");
    // otra ayuda distinta sí se puede, y una expirada no bloquea
    expect(resolvePlay(g, { attackerId: "t1", cardId: "consejo-cartografo" }, NOW, seq()).effects).toHaveLength(2);
    g.effects[0].endsAt = "2026-09-07T13:59:00Z";
    expect(resolvePlay(g, { attackerId: "t1", cardId: "senal-de-humo" }, NOW, seq()).effects).toHaveLength(2);
  });

  it("una bendición activa no cuenta como maldición", () => {
    const g = baseGame();
    g.effects.push({ id: "e1", cardId: "consejo-cartografo", attackerId: "t1", victimId: "t1", endsAt: "2026-09-07T14:08:00Z" });
    // t1 puede ser atacado aunque tenga una ayuda corriendo
    const attacked = resolvePlay(g, { attackerId: "t2", cardId: "naufrago", victimId: "t1" }, NOW, seq());
    expect(attacked.effects).toHaveLength(2);
    // y t1 puede usar el kraken como atacante sin que su bendición lo bloquee
    const kraken = resolvePlay(g, { attackerId: "t1", cardId: "naufrago", victimId: "t3", defense: "kraken" }, NOW, seq());
    expect(kraken.effects).toHaveLength(3);
  });

  it("sabotaje sin defensa: efecto sobre la víctima con duración de la carta", () => {
    const g = resolvePlay(baseGame(), { attackerId: "t2", cardId: "naufrago", victimId: "t1" }, NOW, seq());
    expect(g.effects).toHaveLength(1);
    expect(g.effects[0]).toMatchObject({ attackerId: "t2", victimId: "t1", cardId: "naufrago" });
    expect(g.effects[0].endsAt).toBe("2026-09-07T14:05:00.000Z"); // 5 min
    expect(g.usages).toHaveLength(1);
  });

  it("casco: dos usages y ningún efecto", () => {
    const g = resolvePlay(baseGame(), { attackerId: "t2", cardId: "naufrago", victimId: "t1", defense: "casco" }, NOW, seq());
    expect(g.effects).toHaveLength(0);
    expect(g.usages.map((u) => [u.teamId, u.cardId])).toEqual([
      ["t2", "naufrago"],
      ["t1", "casco-blindado"],
    ]);
  });

  it("viento: efecto sobre el redirigido, atacante pasa a ser la víctima original", () => {
    const g = resolvePlay(
      baseGame(),
      { attackerId: "t2", cardId: "naufrago", victimId: "t1", defense: "viento", redirectId: "t3" },
      NOW, seq(),
    );
    expect(g.effects).toHaveLength(1);
    expect(g.effects[0]).toMatchObject({ attackerId: "t1", victimId: "t3" });
    expect(g.usages).toHaveLength(2);
  });

  it("kraken: dos efectos gemelos (víctima y atacante)", () => {
    const g = resolvePlay(
      baseGame(),
      { attackerId: "t2", cardId: "mano-de-garfio", victimId: "t1", defense: "kraken" },
      NOW, seq(),
    );
    expect(g.effects).toHaveLength(2);
    expect(g.effects.map((e) => e.victimId).sort()).toEqual(["t1", "t2"]);
    expect(new Set(g.effects.map((e) => e.endsAt)).size).toBe(1);
  });

  it("botin: efecto normal + bonus para la víctima", () => {
    const g = resolvePlay(
      baseGame(),
      { attackerId: "t2", cardId: "naufrago", victimId: "t1", defense: "botin" },
      NOW, seq(),
    );
    expect(g.effects).toHaveLength(1);
    expect(g.effects[0]).toMatchObject({ victimId: "t1" });
    expect(g.bonus["t1"]).toBe(1);
  });

  it("no muta el juego original", () => {
    const original = baseGame();
    resolvePlay(original, { attackerId: "t1", cardId: "senal-de-humo" }, NOW, seq());
    expect(original.usages).toHaveLength(0);
  });

  it("rechaza una defensa desconocida", () => {
    expect(() =>
      resolvePlay(
        baseGame(),
        { attackerId: "t2", cardId: "naufrago", victimId: "t1", defense: "escudo" as never },
        NOW, seq(),
      ),
    ).toThrow();
  });

  it("rechaza una clave heredada de Object.prototype como defensa", () => {
    expect(() =>
      resolvePlay(
        baseGame(),
        { attackerId: "t2", cardId: "naufrago", victimId: "t1", defense: "toString" as never },
        NOW, seq(),
      ),
    ).toThrow("defensa inválida");
  });

  it("rechaza sabotear a un barco que ya está maldito", () => {
    const g = baseGame();
    g.effects.push({ id: "e1", cardId: "naufrago", attackerId: "t3", victimId: "t1", endsAt: "2026-09-07T14:05:00Z" });
    expect(() => resolvePlay(g, { attackerId: "t2", cardId: "mano-de-garfio", victimId: "t1" }, NOW, seq()))
      .toThrow("la víctima ya está bajo una maldición");
    expect(() => resolvePlay(g, { attackerId: "t2", cardId: "mano-de-garfio", victimId: "t1", defense: "casco" }, NOW, seq()))
      .toThrow("la víctima ya está bajo una maldición");
  });

  it("una maldición expirada no bloquea un sabotaje nuevo", () => {
    const g = baseGame();
    g.effects.push({ id: "e1", cardId: "naufrago", attackerId: "t3", victimId: "t1", endsAt: "2026-09-07T13:59:00Z" });
    const out = resolvePlay(g, { attackerId: "t2", cardId: "mano-de-garfio", victimId: "t1" }, NOW, seq());
    expect(out.effects).toHaveLength(2);
  });

  it("rechaza redirigir con viento hacia un barco maldito", () => {
    const g = baseGame();
    g.effects.push({ id: "e1", cardId: "naufrago", attackerId: "t1", victimId: "t3", endsAt: "2026-09-07T14:05:00Z" });
    expect(() => resolvePlay(
      g,
      { attackerId: "t2", cardId: "mano-de-garfio", victimId: "t1", defense: "viento", redirectId: "t3" },
      NOW, seq(),
    )).toThrow("el barco redirigido ya está bajo una maldición");
  });

  it("rechaza el kraken si el atacante ya está maldito", () => {
    const g = baseGame();
    g.effects.push({ id: "e1", cardId: "naufrago", attackerId: "t3", victimId: "t2", endsAt: "2026-09-07T14:05:00Z" });
    expect(() => resolvePlay(
      g,
      { attackerId: "t2", cardId: "mano-de-garfio", victimId: "t1", defense: "kraken" },
      NOW, seq(),
    )).toThrow("el atacante ya está bajo una maldición");
  });

  it("rechaza carta inexistente, defensa como jugada, y sabotaje sin víctima", () => {
    expect(() => resolvePlay(baseGame(), { attackerId: "t1", cardId: "nope" }, NOW, seq())).toThrow();
    expect(() => resolvePlay(baseGame(), { attackerId: "t1", cardId: "casco-blindado" }, NOW, seq())).toThrow();
    expect(() => resolvePlay(baseGame(), { attackerId: "t1", cardId: "naufrago" }, NOW, seq())).toThrow();
  });
});
