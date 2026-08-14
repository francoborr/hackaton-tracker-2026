import { cardById } from "./cards";

export type Team = { id: string; name: string };

export type Effect = {
  id: string;
  cardId: string;
  attackerId: string;
  victimId: string;
  endsAt: string;
};

export type Usage = { id: string; teamId: string; cardId: string; at: string };

export type Game = {
  startedAt: string | null;
  teams: Team[];
  effects: Effect[];
  usages: Usage[];
  bonus: Record<string, number>;
};

export type Defense = "casco" | "viento" | "kraken" | "botin";

export type PlayInput = {
  attackerId: string;
  cardId: string;
  victimId?: string;
  defense?: Defense;
  redirectId?: string;
};

export const DEFENSE_CARD: Record<Defense, string> = {
  casco: "casco-blindado",
  viento: "viento-en-contra",
  kraken: "maldicion-del-kraken",
  botin: "botin-de-repuesto",
};

export function emptyGame(): Game {
  return { startedAt: null, teams: [], effects: [], usages: [], bonus: {} };
}

export function activeEffects(game: Game, now: Date): Effect[] {
  return game.effects.filter((e) => new Date(e.endsAt) > now);
}

export function currentHour(game: Game, now: Date): number {
  if (!game.startedAt) return 0;
  const ms = now.getTime() - new Date(game.startedAt).getTime();
  if (ms < 0) return 0;
  return Math.floor(ms / 3_600_000) + 1;
}

export function credits(game: Game, teamId: string, now: Date): number {
  const used = game.usages.filter((u) => u.teamId === teamId).length;
  return currentHour(game, now) + (game.bonus[teamId] ?? 0) - used;
}

export function resolvePlay(game: Game, input: PlayInput, now: Date, id: () => string): Game {
  const card = cardById(input.cardId);
  if (!card || card.type === "defensa") throw new Error("carta inválida");

  const g: Game = structuredClone(game);
  const at = now.toISOString();
  g.usages.push({ id: id(), teamId: input.attackerId, cardId: card.id, at });

  if (card.type === "ayuda") {
    // Cada ayuda es un recurso exclusivo: mientras la bendición corre, nadie más la usa.
    if (game.effects.some((e) => e.cardId === card.id && new Date(e.endsAt) > now)) {
      throw new Error("esa ayuda ya está en uso");
    }
    const blessEndsAt = new Date(now.getTime() + (card.minutes ?? 0) * 60_000).toISOString();
    g.effects.push({
      id: id(), cardId: card.id, attackerId: input.attackerId, victimId: input.attackerId, endsAt: blessEndsAt,
    });
    return g;
  }

  const victimId = input.victimId;
  if (!victimId) throw new Error("falta la víctima");

  // Un barco maldito no puede recibir otra maldición — regla dura, sin override.
  // Solo cuentan los sabotajes: una bendición (ayuda) activa no bloquea nada.
  const cursed = (teamId: string) =>
    game.effects.some((e) =>
      e.victimId === teamId && cardById(e.cardId)?.type === "sabotaje" && new Date(e.endsAt) > now
    );
  if (cursed(victimId)) throw new Error("la víctima ya está bajo una maldición");

  const endsAt = new Date(now.getTime() + (card.minutes ?? 0) * 60_000).toISOString();
  const makeEffect = (attackerId: string, target: string): Effect => ({
    id: id(), cardId: card.id, attackerId, victimId: target, endsAt,
  });

  const defense = input.defense;
  if (defense && !Object.hasOwn(DEFENSE_CARD, defense)) throw new Error("defensa inválida");
  if (defense) g.usages.push({ id: id(), teamId: victimId, cardId: DEFENSE_CARD[defense], at });

  if (!defense) {
    g.effects.push(makeEffect(input.attackerId, victimId));
  } else if (defense === "viento") {
    if (!input.redirectId) throw new Error("falta el barco redirigido");
    if (cursed(input.redirectId)) throw new Error("el barco redirigido ya está bajo una maldición");
    g.effects.push(makeEffect(victimId, input.redirectId));
  } else if (defense === "kraken") {
    if (cursed(input.attackerId)) throw new Error("el atacante ya está bajo una maldición");
    g.effects.push(makeEffect(input.attackerId, victimId));
    g.effects.push(makeEffect(victimId, input.attackerId));
  } else if (defense === "botin") {
    g.effects.push(makeEffect(input.attackerId, victimId));
    g.bonus[victimId] = (g.bonus[victimId] ?? 0) + 1;
  }
  // casco: bloqueado, sin efecto

  return g;
}
