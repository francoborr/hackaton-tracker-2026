# Hackaton Tracker 2026 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the power-cards tracker per `SPEC.md`: shared game state in Upstash Redis, jury view with PIN + registration wizard, public read-only board, automatic effect expiry.

**Architecture:** Next.js App Router with a single JSON game document in Redis (in-memory fallback for dev). Pure game logic in `lib/game.ts` (tested), thin API route handlers, two client pages polling `GET /api/state` every 5s with a 1s local tick for countdowns.

**Tech Stack:** Next.js 15 (App Router) + TypeScript, React 19, @upstash/redis, vitest. No UI library — hand CSS ported from `docs/mockup.html`.

**Spec:** `SPEC.md` (repo root). Visual/flow source of truth: `docs/mockup.html`.

## Global Constraints

- All UI copy in Spanish, exactly as it appears in `docs/mockup.html` (e.g. "El mar está en calma — ninguna maldición activa", "sin cartas esta hora", "⚓ Registrar carta").
- No UI/CSS libraries. `app/globals.css` is ported from the `<style>` block of `docs/mockup.html`; components reuse its class names (`btile`, `fuse`, `crow`, `chip`, etc.).
- Single dark theme (deliberate). Font stacks from the mockup (`Palatino …, Georgia, serif`) — no webfonts.
- Mutations require header `x-jury-pin` matching env `JURY_PIN`; if `JURY_PIN` is unset (dev), everything is allowed. Reads are public.
- Elixir conventions do NOT apply — this is a TypeScript repo. Match Next.js idioms.
- Work in `~/Desktop/Mimiquate/projectos_personales/hackaton-tracker-2026`. Commit messages: short, imperative, no co-author line.
- Run tests with `npm test` (vitest run). Build with `npm run build`.

---

### Task 1: Scaffold Next.js + vitest

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `.gitignore`, `app/layout.tsx`, `app/globals.css` (placeholder), `app/page.tsx` (placeholder)

**Interfaces:**
- Produces: a repo where `npm test`, `npm run build`, and `npm run dev` all work; path alias `@/*` → repo root.

- [ ] **Step 1: Write config files**

`package.json`:
```json
{
  "name": "hackaton-tracker-2026",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run"
  },
  "dependencies": {
    "@upstash/redis": "^1.34.0",
    "next": "^15.4.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
  "devDependencies": {
    "@types/node": "^22",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "typescript": "^5",
    "vitest": "^3.2.0"
  }
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`next.config.ts`:
```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: { environment: "node" },
});
```

`.gitignore`:
```
node_modules/
.next/
.env*.local
.vercel
*.tsbuildinfo
next-env.d.ts
```

`app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hackathon 2026 — Cartas de Poder",
  description: "Tracker de cartas de poder de la Hackathon 2026 de Mimiquate",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
```

`app/globals.css` (placeholder for now):
```css
* { box-sizing: border-box; }
body { margin: 0; }
```

`app/page.tsx` (placeholder for now):
```tsx
export default function Home() {
  return <main>Hackathon 2026</main>;
}
```

- [ ] **Step 2: Install and verify**

Run: `npm install`
Run: `npm run build` — Expected: build succeeds.
Run: `npm test` — Expected: vitest exits 0 reporting "no test files found" is NOT ok — vitest fails with no tests by default, so pass `--passWithNoTests`: change the script to `"test": "vitest run --passWithNoTests"`. Re-run and expect exit 0.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "Scaffold Next.js + vitest"
```

---

### Task 2: Cards + game logic (pure, TDD)

**Files:**
- Create: `lib/cards.ts`, `lib/game.ts`
- Test: `lib/game.test.ts`

**Interfaces:**
- Produces (used by every later task):
  - `lib/cards.ts`: `type Card = { id: string; name: string; type: "sabotaje" | "ayuda" | "defensa"; effect: string; minutes?: number }`, `const CARDS: Card[]`, `cardById(id: string): Card | undefined`.
  - `lib/game.ts`: `const DEFENSE_CARD: Record<Defense, string>`; types `Team { id, name }`, `Effect { id, cardId, attackerId, victimId, endsAt }`, `Usage { id, teamId, cardId, at }`, `Game { startedAt: string | null; teams: Team[]; effects: Effect[]; usages: Usage[]; bonus: Record<string, number> }`, `type Defense = "casco" | "viento" | "kraken" | "botin"`, `type PlayInput = { attackerId: string; cardId: string; victimId?: string; defense?: Defense; redirectId?: string }`; functions `emptyGame(): Game`, `activeEffects(game, now: Date): Effect[]`, `currentHour(game, now: Date): number`, `credits(game, teamId: string, now: Date): number`, `resolvePlay(game, input: PlayInput, now: Date, id: () => string): Game` (throws `Error` on invalid input).

- [ ] **Step 1: Write `lib/cards.ts`** (data, no test needed beyond compilation)

```ts
export type CardType = "sabotaje" | "ayuda" | "defensa";

export type Card = {
  id: string;
  name: string;
  type: CardType;
  effect: string;
  minutes?: number; // solo sabotaje
};

export const CARDS: Card[] = [
  { id: "naufrago", name: "Naufrago", type: "sabotaje", effect: "Sin internet", minutes: 5 },
  { id: "guardia-nocturna", name: "Guardia nocturna", type: "sabotaje", effect: "Sin hablar", minutes: 5 },
  { id: "catalejo", name: "El catalejo del capitán", type: "sabotaje", effect: "Una sola pantalla", minutes: 15 },
  { id: "secuestro", name: "Secuestro de tripulación", type: "sabotaje", effect: "Sin un integrante", minutes: 10 },
  { id: "mano-de-garfio", name: "Mano de garfio", type: "sabotaje", effect: "Escriben con una mano", minutes: 10 },
  { id: "tabla-de-castigo", name: "Tabla de castigo", type: "sabotaje", effect: "Sin sillas", minutes: 15 },
  { id: "bandera-extranjera", name: "Bandera extranjera", type: "sabotaje", effect: "Hablan en inglés", minutes: 15 },
  { id: "codigo-del-corsario", name: "Código del corsario", type: "sabotaje", effect: "Disfrazados de pirata", minutes: 15 },
  { id: "consejo-cartografo", name: "Consejo de cartógrafo", type: "ayuda", effect: "Consulta a Javi" },
  { id: "consejo-almirante", name: "Consejo del almirante", type: "ayuda", effect: "Consulta a un CEO" },
  { id: "senal-de-humo", name: "Señal de humo", type: "ayuda", effect: "Consulta al jurado" },
  { id: "casco-blindado", name: "Casco blindado", type: "defensa", effect: "Bloquea el próximo poder recibido" },
  { id: "viento-en-contra", name: "Viento en contra", type: "defensa", effect: "Redirige un poder que te lanzaron" },
  { id: "maldicion-del-kraken", name: "Maldición del Kraken", type: "defensa", effect: "La carta aplica también al atacante" },
  { id: "botin-de-repuesto", name: "Botín de repuesto", type: "defensa", effect: "Sufrís el sabotaje y ganás una ayuda" },
];

export function cardById(id: string): Card | undefined {
  return CARDS.find((c) => c.id === id);
}
```

- [ ] **Step 2: Write the failing tests** — `lib/game.test.ts`

```ts
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
  it("ayuda: solo un usage, sin efecto", () => {
    const g = resolvePlay(baseGame(), { attackerId: "t1", cardId: "senal-de-humo" }, NOW, seq());
    expect(g.effects).toHaveLength(0);
    expect(g.usages).toHaveLength(1);
    expect(g.usages[0]).toMatchObject({ teamId: "t1", cardId: "senal-de-humo" });
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

  it("rechaza carta inexistente, defensa como jugada, y sabotaje sin víctima", () => {
    expect(() => resolvePlay(baseGame(), { attackerId: "t1", cardId: "nope" }, NOW, seq())).toThrow();
    expect(() => resolvePlay(baseGame(), { attackerId: "t1", cardId: "casco-blindado" }, NOW, seq())).toThrow();
    expect(() => resolvePlay(baseGame(), { attackerId: "t1", cardId: "naufrago" }, NOW, seq())).toThrow();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `lib/game.ts` does not exist.

- [ ] **Step 4: Write `lib/game.ts`**

```ts
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

  if (card.type === "ayuda") return g;

  const victimId = input.victimId;
  if (!victimId) throw new Error("falta la víctima");

  const endsAt = new Date(now.getTime() + (card.minutes ?? 0) * 60_000).toISOString();
  const makeEffect = (attackerId: string, target: string): Effect => ({
    id: id(), cardId: card.id, attackerId, victimId: target, endsAt,
  });

  const defense = input.defense;
  if (defense) g.usages.push({ id: id(), teamId: victimId, cardId: DEFENSE_CARD[defense], at });

  if (!defense) {
    g.effects.push(makeEffect(input.attackerId, victimId));
  } else if (defense === "viento") {
    if (!input.redirectId) throw new Error("falta el barco redirigido");
    g.effects.push(makeEffect(victimId, input.redirectId));
  } else if (defense === "kraken") {
    g.effects.push(makeEffect(input.attackerId, victimId));
    g.effects.push(makeEffect(victimId, input.attackerId));
  } else if (defense === "botin") {
    g.effects.push(makeEffect(input.attackerId, victimId));
    g.bonus[victimId] = (g.bonus[victimId] ?? 0) + 1;
  }
  // casco: bloqueado, sin efecto

  return g;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all).

- [ ] **Step 6: Commit**

```bash
git add lib/ && git commit -m "Cards y lógica de juego"
```

---

### Task 3: Store, PIN y API routes

**Files:**
- Create: `lib/store.ts`, `lib/pin.ts`, `app/api/state/route.ts`, `app/api/plays/route.ts`, `app/api/effects/[id]/route.ts`, `app/api/teams/route.ts`, `app/api/teams/[id]/route.ts`, `app/api/sail/route.ts`, `app/api/pin/route.ts`
- Test: `app/api/api.test.ts`

**Interfaces:**
- Consumes: everything from Task 2.
- Produces:
  - `lib/store.ts`: `loadGame(): Promise<Game>`, `saveGame(game: Game): Promise<void>`, `resetMemory(): void` (test-only helper). Uses Upstash when `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` are set, else a module-level in-memory doc.
  - `lib/pin.ts`: `checkPin(req: Request): boolean`, `unauthorized(): Response`.
  - HTTP API (used by Tasks 4–6 frontends): `GET /api/state` → `Game` with expired effects filtered; `GET /api/pin` → 200/401 (PIN verification); `POST /api/plays` body `PlayInput` → 200 `Game` | 401 | 422 `{error}`; `DELETE /api/effects/:id` → `Game`; `POST /api/teams` body `{name}` → `Game` | 422; `DELETE /api/teams/:id` → `Game` (also removes the team's effects); `POST /api/sail` → `Game` (sets `startedAt` once).

- [ ] **Step 1: Write `lib/store.ts` and `lib/pin.ts`**

`lib/store.ts`:
```ts
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
```

`lib/pin.ts`:
```ts
export function checkPin(req: Request): boolean {
  const pin = process.env.JURY_PIN;
  if (!pin) return true;
  return req.headers.get("x-jury-pin") === pin;
}

export function unauthorized(): Response {
  return Response.json({ error: "PIN inválido" }, { status: 401 });
}
```

- [ ] **Step 2: Write the failing tests** — `app/api/api.test.ts`

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

beforeEach(() => {
  resetMemory();
  delete process.env.JURY_PIN;
});

afterEach(() => {
  delete process.env.JURY_PIN;
});

describe("PIN", () => {
  it("bloquea mutaciones sin PIN cuando JURY_PIN está seteado", async () => {
    process.env.JURY_PIN = "1234";
    expect((await postSail(req())).status).toBe(401);
    expect((await postSail(req(undefined, "1234"))).status).toBe(200);
    expect((await getPin(req(undefined, "9999"))).status).toBe(401);
    expect((await getPin(req(undefined, "1234"))).status).toBe(200);
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — route modules don't exist.

- [ ] **Step 4: Write the routes**

`app/api/state/route.ts`:
```ts
import { activeEffects } from "@/lib/game";
import { loadGame } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const game = await loadGame();
  return Response.json({ ...game, effects: activeEffects(game, new Date()) });
}
```

`app/api/pin/route.ts`:
```ts
import { checkPin, unauthorized } from "@/lib/pin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!checkPin(req)) return unauthorized();
  return Response.json({ ok: true });
}
```

`app/api/plays/route.ts`:
```ts
import { resolvePlay, type PlayInput } from "@/lib/game";
import { checkPin, unauthorized } from "@/lib/pin";
import { loadGame, saveGame } from "@/lib/store";

export async function POST(req: Request) {
  if (!checkPin(req)) return unauthorized();
  const input = (await req.json()) as PlayInput;
  const game = await loadGame();
  let next;
  try {
    next = resolvePlay(game, input, new Date(), () => crypto.randomUUID());
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 422 });
  }
  await saveGame(next);
  return Response.json(next);
}
```

`app/api/effects/[id]/route.ts`:
```ts
import { checkPin, unauthorized } from "@/lib/pin";
import { loadGame, saveGame } from "@/lib/store";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!checkPin(req)) return unauthorized();
  const { id } = await params;
  const game = await loadGame();
  game.effects = game.effects.filter((e) => e.id !== id);
  await saveGame(game);
  return Response.json(game);
}
```

`app/api/teams/route.ts`:
```ts
import { checkPin, unauthorized } from "@/lib/pin";
import { loadGame, saveGame } from "@/lib/store";

export async function POST(req: Request) {
  if (!checkPin(req)) return unauthorized();
  const { name } = (await req.json()) as { name?: string };
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed) return Response.json({ error: "nombre requerido" }, { status: 422 });
  const game = await loadGame();
  if (game.teams.some((t) => t.name === trimmed)) {
    return Response.json({ error: "ese barco ya existe" }, { status: 422 });
  }
  game.teams.push({ id: crypto.randomUUID(), name: trimmed });
  await saveGame(game);
  return Response.json(game);
}
```

`app/api/teams/[id]/route.ts`:
```ts
import { checkPin, unauthorized } from "@/lib/pin";
import { loadGame, saveGame } from "@/lib/store";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!checkPin(req)) return unauthorized();
  const { id } = await params;
  const game = await loadGame();
  game.teams = game.teams.filter((t) => t.id !== id);
  game.effects = game.effects.filter((e) => e.attackerId !== id && e.victimId !== id);
  await saveGame(game);
  return Response.json(game);
}
```

`app/api/sail/route.ts`:
```ts
import { checkPin, unauthorized } from "@/lib/pin";
import { loadGame, saveGame } from "@/lib/store";

export async function POST(req: Request) {
  if (!checkPin(req)) return unauthorized();
  const game = await loadGame();
  if (!game.startedAt) game.startedAt = new Date().toISOString();
  await saveGame(game);
  return Response.json(game);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS. Also run `npm run build` — expected: success.

- [ ] **Step 6: Commit**

```bash
git add lib/ app/api/ && git commit -m "Store, PIN y API routes"
```

---

### Task 4: CSS global, componentes compartidos y tablero público

**Files:**
- Create: `lib/client.ts`, `components/Board.tsx`, `components/Creditos.tsx`, `components/Masthead.tsx`
- Modify: `app/globals.css` (full port), `app/page.tsx` (public board)

**Interfaces:**
- Consumes: `Game`, `credits`, `cardById` from Task 2; `GET /api/state` from Task 3.
- Produces (used by Tasks 5–6):
  - `lib/client.ts`: `useGame(): { game: Game | null; refresh: () => Promise<void> }` (polls every 5s), `useNowMs(): number | null` (1s tick, `null` until mounted), `getPin(): string`, `setPin(pin: string): void`, `mutate(path: string, method: string, body?: unknown): Promise<Response>` (adds `x-jury-pin` header).
  - `components/Board.tsx`: `Board({ game, nowMs, onEnd }: { game: Game; nowMs: number; onEnd?: (id: string) => void })` — tiles of active effects; renders ✕ only when `onEnd` given.
  - `components/Creditos.tsx`: `Creditos({ game, nowMs }: { game: Game; nowMs: number })`.
  - `components/Masthead.tsx`: `Masthead()` — shared page header.

- [ ] **Step 1: Port the CSS**

Open `docs/mockup.html` and copy its entire `<style>` block into `app/globals.css`, with these changes:
1. Prepend the reset already there (`* { box-sizing: border-box; }`) — keep body styles from the mockup (background texture data-URI included).
2. Delete mockup-only rules: `.tabs`, `.tab`, `.note`, and `#view-public` / `#view-jury` display rules (views are separate pages now). Keep `:focus-visible` rules, moving the `.tab:focus-visible` selector to `button:focus-visible, input:focus-visible`.
3. Replace the `#view-public .btn-x { display: none; }` rule with nothing (public page simply doesn't render ✕).
4. Replace `#fleet` selector with `.fleet-list` (used by Task 5).
5. Add a `.gate` block for the PIN screen (Task 5) and `.zarpar-hint`:

```css
.gate {
  max-width: 380px;
  margin: 4rem auto;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.gate input {
  background: rgba(0,0,0,.35);
  border: 1px solid var(--frame);
  color: var(--parch);
  font-family: var(--body);
  font-size: 1.1rem;
  text-align: center;
  letter-spacing: .3em;
  padding: .6rem;
}
.gate .error { color: var(--ember-hi); font-size: .85rem; }
```

- [ ] **Step 2: Write `lib/client.ts`**

```ts
"use client";

import { useCallback, useEffect, useState } from "react";
import type { Game } from "./game";

export function useGame(): { game: Game | null; refresh: () => Promise<void> } {
  const [game, setGame] = useState<Game | null>(null);
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      if (res.ok) setGame(await res.json());
    } catch {
      // sin red: reintenta en el próximo poll
    }
  }, []);
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);
  return { game, refresh };
}

export function useNowMs(): number | null {
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    setNowMs(Date.now());
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return nowMs;
}

export function getPin(): string {
  return localStorage.getItem("jury-pin") ?? "";
}

export function setPin(pin: string): void {
  localStorage.setItem("jury-pin", pin);
}

export async function mutate(path: string, method: string, body?: unknown): Promise<Response> {
  return fetch(path, {
    method,
    headers: { "content-type": "application/json", "x-jury-pin": getPin() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
```

- [ ] **Step 3: Write the shared components**

`components/Masthead.tsx`:
```tsx
export function Masthead() {
  return (
    <header className="masthead">
      <div className="over">Mimiquate · 7 de Septiembre</div>
      <h1>Hackathon 2026 — Cartas de Poder</h1>
      <div className="rule" />
    </header>
  );
}
```

`components/Board.tsx`:
```tsx
"use client";

import { cardById } from "@/lib/cards";
import type { Game } from "@/lib/game";

function fmt(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function Board({ game, nowMs, onEnd }: { game: Game; nowMs: number; onEnd?: (id: string) => void }) {
  const active = game.effects.filter((e) => new Date(e.endsAt).getTime() > nowMs);
  const name = (id: string) => game.teams.find((t) => t.id === id)?.name ?? "¿?";

  if (active.length === 0) {
    return <div className="calm">El mar está en calma — ninguna maldición activa</div>;
  }

  return (
    <div className="board">
      {active.map((e) => {
        const card = cardById(e.cardId);
        const totalMs = (card?.minutes ?? 0) * 60_000;
        const leftMs = new Date(e.endsAt).getTime() - nowMs;
        return (
          <div className="btile" key={e.id}>
            {onEnd && (
              <button className="btn-x" title="Terminar ahora" onClick={() => onEnd(e.id)}>✕</button>
            )}
            <div className="atk">⚔ <b>{name(e.attackerId)}</b> maldijo a</div>
            <div className="who">{name(e.victimId)}</div>
            <div className="what">{card?.name}</div>
            <div className="desc">{card?.effect}</div>
            <div className="big">{fmt(leftMs)}</div>
            <div className="fuse">
              <div className="fuse-fill" style={{ width: `${totalMs ? Math.min(100, (leftMs / totalMs) * 100) : 0}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

`components/Creditos.tsx`:
```tsx
"use client";

import { credits, type Game } from "@/lib/game";

export function Creditos({ game, nowMs }: { game: Game; nowMs: number }) {
  const now = new Date(nowMs);
  return (
    <div className="creditos">
      {game.teams.map((t) => {
        const c = credits(game, t.id, now);
        return (
          <div className="crow" key={t.id}>
            <b>{t.name}</b>
            {c > 0 ? (
              <span>
                <span className="on">{"⚓".repeat(Math.min(c, 5))}</span>
                {c > 5 ? ` ×${c}` : ""}
              </span>
            ) : (
              <span className="none">sin cartas esta hora</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Write the public page** — replace `app/page.tsx`:

```tsx
"use client";

import { Board } from "@/components/Board";
import { Creditos } from "@/components/Creditos";
import { Masthead } from "@/components/Masthead";
import { useGame, useNowMs } from "@/lib/client";

export default function PublicBoard() {
  const { game } = useGame();
  const nowMs = useNowMs();

  return (
    <>
      <Masthead />
      <main className="wrap">
        {game && nowMs !== null && (
          <>
            <h2>Maldiciones en curso</h2>
            <Board game={game} nowMs={nowMs} />
            <h2>Cartas disponibles por barco</h2>
            <Creditos game={game} nowMs={nowMs} />
          </>
        )}
      </main>
    </>
  );
}
```

- [ ] **Step 5: Verify**

Run: `npm test` — Expected: PASS (nothing broken).
Run: `npm run build` — Expected: success.
Run: `npm run dev &` then `curl -s localhost:3000 | grep -o "Cartas de Poder" | head -1` — Expected: `Cartas de Poder`. Then `curl -s localhost:3000/api/state` — Expected: JSON with `"teams":[]`. Kill the dev server.

- [ ] **Step 6: Commit**

```bash
git add app/ components/ lib/ && git commit -m "CSS global, componentes compartidos y tablero público"
```

---

### Task 5: Vista jurado (PIN gate, zarpar, terminar efectos, flota)

**Files:**
- Create: `app/jurado/page.tsx`, `components/PinGate.tsx`, `components/Fleet.tsx`

**Interfaces:**
- Consumes: Task 4 components/hooks; API from Task 3; `currentHour` from Task 2.
- Produces: `/jurado` page. Exposes `wizardOpen` state and renders `<Wizard>` from Task 6 — until Task 6 exists, the "⚓ Registrar carta" button renders but the wizard import is added in Task 6 (leave a disabled button with `title="próximamente"`? NO — Task 6 lands immediately after; to keep this task shippable, the button opens `alert("wizard en la próxima tarea")` placeholder is forbidden by plan rules, so instead: this task renders the button only when a `Wizard` module exists — concretely, this task creates the page WITHOUT the register button, and Task 6 adds the button + wizard together).

- [ ] **Step 1: Write `components/PinGate.tsx`**

```tsx
"use client";

import { useState } from "react";
import { getPin, setPin } from "@/lib/client";

export function PinGate({ onOk }: { onOk: () => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);

  async function verify(pin: string) {
    setChecking(true);
    const res = await fetch("/api/pin", { headers: { "x-jury-pin": pin } });
    setChecking(false);
    if (res.ok) {
      setPin(pin);
      onOk();
    } else {
      setError(true);
    }
  }

  return (
    <form
      className="gate"
      onSubmit={(e) => {
        e.preventDefault();
        verify(value.trim());
      }}
    >
      <div className="wizq">Santo y seña del jurado</div>
      <input
        type="password"
        value={value}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
        placeholder="PIN"
      />
      {error && <div className="error">PIN inválido — probá de nuevo</div>}
      <button className="btn-main" type="submit" disabled={checking}>
        Abordar
      </button>
    </form>
  );
}

export function usePinVerified(): [boolean | null, () => void] {
  const [ok, setOk] = useState<boolean | null>(null);
  // verificación inicial con el PIN guardado
  useState(() => {
    fetch("/api/pin", { headers: { "x-jury-pin": getPin() } }).then((res) => setOk(res.ok));
  });
  return [ok, () => setOk(true)];
}
```

Note for the implementer: `useState(() => { ... })` as an effect is a bug — use `useEffect`:

```tsx
export function usePinVerified(): [boolean | null, () => void] {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/api/pin", { headers: { "x-jury-pin": getPin() } }).then((res) => setOk(res.ok));
  }, []);
  return [ok, () => setOk(true)];
}
```
(import `useEffect` from react). Use this second version.

- [ ] **Step 2: Write `components/Fleet.tsx`**

```tsx
"use client";

import { useState } from "react";
import type { Game } from "@/lib/game";
import { mutate } from "@/lib/client";

export function Fleet({ game, onChange }: { game: Game; onChange: () => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const res = await mutate("/api/teams", "POST", { name: trimmed });
    if (res.ok) {
      setName("");
      setError(null);
      onChange();
    } else {
      setError((await res.json()).error ?? "no se pudo sumar el barco");
    }
  }

  async function remove(id: string, teamName: string) {
    if (!confirm(`¿Quitar a ${teamName} de la flota?`)) return;
    await mutate(`/api/teams/${id}`, "DELETE");
    onChange();
  }

  return (
    <div className="creditos">
      <div className="fleet-list">
        {game.teams.map((t) => (
          <div className="crow" key={t.id}>
            <b>{t.name}</b>
            <button
              className="btn-x"
              style={{ position: "static" }}
              title="Quitar barco"
              onClick={() => remove(t.id, t.name)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <form className="crow addrow" onSubmit={add}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre del nuevo barco…"
          maxLength={30}
        />
        <button className="btn-ghost" type="submit">Sumar barco</button>
      </form>
      {error && <p className="hintline">⚠ {error}</p>}
      <p className="hintline">
        El mazo de cartas no se edita desde la app: vive en el código (lib/cards.ts).
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Write `app/jurado/page.tsx`** (without the wizard yet — Task 6 adds it)

```tsx
"use client";

import { Board } from "@/components/Board";
import { Creditos } from "@/components/Creditos";
import { Fleet } from "@/components/Fleet";
import { Masthead } from "@/components/Masthead";
import { PinGate, usePinVerified } from "@/components/PinGate";
import { mutate, useGame, useNowMs } from "@/lib/client";
import { currentHour } from "@/lib/game";

export default function Jurado() {
  const [pinOk, markVerified] = usePinVerified();
  const { game, refresh } = useGame();
  const nowMs = useNowMs();

  if (pinOk === null) return <Masthead />;
  if (!pinOk) {
    return (
      <>
        <Masthead />
        <PinGate onOk={markVerified} />
      </>
    );
  }

  async function endEffect(id: string) {
    await mutate(`/api/effects/${id}`, "DELETE");
    refresh();
  }

  async function sail() {
    await mutate("/api/sail", "POST");
    refresh();
  }

  return (
    <>
      <Masthead />
      <main className="wrap">
        {game && nowMs !== null && (
          <>
            <div className="toolbar">
              {game.startedAt ? (
                <span className="hora">⚓ Hora {currentHour(game, new Date(nowMs))} de travesía</span>
              ) : (
                <button className="btn-main" onClick={sail}>⚓ Zarpar</button>
              )}
            </div>

            <h2>Maldiciones en curso</h2>
            <Board game={game} nowMs={nowMs} onEnd={endEffect} />

            <h2>Cartas disponibles por barco</h2>
            <Creditos game={game} nowMs={nowMs} />

            <h2>La flota</h2>
            <Fleet game={game} onChange={refresh} />
          </>
        )}
      </main>
    </>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npm test` && `npm run build` — Expected: PASS / success.
Run: `npm run dev &`; `curl -s localhost:3000/jurado | grep -c "masthead"` — Expected: ≥1. With `JURY_PIN` unset, open flow works without PIN (the gate auto-passes because `/api/pin` returns 200). Kill dev server.

- [ ] **Step 5: Commit**

```bash
git add app/jurado components/ && git commit -m "Vista jurado: PIN, zarpar, terminar efectos y flota"
```

---

### Task 6: Wizard de registro

**Files:**
- Create: `components/Wizard.tsx`
- Modify: `app/jurado/page.tsx` (add "⚓ Registrar carta" button + render wizard)

**Interfaces:**
- Consumes: `CARDS`, `cardById` (Task 2), `credits`, `Game`, `Defense`, `PlayInput` (Task 2), `mutate` (Task 4), `POST /api/plays` (Task 3).
- Produces: `Wizard({ game, nowMs, onClose, onDone }: { game: Game; nowMs: number; onClose: () => void; onDone: () => void })`.

- [ ] **Step 1: Write `components/Wizard.tsx`**

Steps mirror `docs/mockup.html` exactly: `atk → card → (ayuda ⇒ confirm) target → def → (viento ⇒ redirect) → confirm`. Selecting a chip advances; "← Atrás" pops the trail; "Registrar" only on confirm.

```tsx
"use client";

import { useState } from "react";
import { CARDS, cardById, type Card } from "@/lib/cards";
import { credits, type Defense, type Game, type Team } from "@/lib/game";
import { mutate } from "@/lib/client";

type Step = "atk" | "card" | "target" | "def" | "redirect" | "confirm";

const DEFENSES: { key: Defense | "no"; name: string; hint?: string }[] = [
  { key: "no", name: "No" },
  { key: "casco", name: "Casco blindado", hint: "bloquea" },
  { key: "viento", name: "Viento en contra", hint: "redirige" },
  { key: "kraken", name: "Maldición del Kraken", hint: "a ambos" },
  { key: "botin", name: "Botín de repuesto", hint: "sufre +1 ayuda" },
];

const CRUMBS: Record<Step, string> = {
  atk: "Paso 1 · Barco",
  card: "Paso 2 · Carta",
  target: "Paso 3 · Objetivo",
  def: "Paso 4 · Defensa",
  redirect: "Paso 4b · Redirigir",
  confirm: "Paso final · Confirmar",
};

export function Wizard({ game, nowMs, onClose, onDone }: {
  game: Game; nowMs: number; onClose: () => void; onDone: () => void;
}) {
  const [trail, setTrail] = useState<Step[]>(["atk"]);
  const [atk, setAtk] = useState<Team | null>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [target, setTarget] = useState<Team | null>(null);
  const [defense, setDefense] = useState<Defense | "no" | null>(null);
  const [redirect, setRedirect] = useState<Team | null>(null);
  const [sending, setSending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const step = trail[trail.length - 1];
  const go = (s: Step) => setTrail((t) => [...t, s]);
  const back = () => setTrail((t) => (t.length > 1 ? t.slice(0, -1) : t));

  async function register() {
    if (!atk || !card) return;
    setSending(true);
    const body = {
      attackerId: atk.id,
      cardId: card.id,
      ...(card.type === "sabotaje" && target ? { victimId: target.id } : {}),
      ...(defense && defense !== "no" ? { defense } : {}),
      ...(defense === "viento" && redirect ? { redirectId: redirect.id } : {}),
    };
    const res = await mutate("/api/plays", "POST", body);
    setSending(false);
    if (res.ok) {
      onDone();
    } else {
      setServerError((await res.json()).error ?? "no se pudo registrar");
    }
  }

  const now = new Date(nowMs);
  const finalVictim = defense === "viento" ? redirect : target;
  const victimCursed =
    card?.type === "sabotaje" &&
    defense !== "casco" &&
    finalVictim !== null &&
    game.effects.some((e) => e.victimId === finalVictim.id && new Date(e.endsAt).getTime() > nowMs);

  return (
    <div className="overlay open">
      <div className="modal">
        <div className="inner">
          <h2>Registrar carta</h2>
          <div className="crumb">{CRUMBS[step]}</div>

          {step === "atk" && (
            <>
              <div className="wizq">¿Qué barco juega la carta?</div>
              <div className="chips">
                {game.teams.map((t) => (
                  <button key={t.id} className="chip" onClick={() => { setAtk(t); go("card"); }}>
                    {t.name}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === "card" && (
            <>
              <div className="wizq">¿Qué carta juega {atk?.name}?</div>
              <div className="grp">
                <div className="g sab">Sabotaje</div>
                <div className="chips">
                  {CARDS.filter((c) => c.type === "sabotaje").map((c) => (
                    <button key={c.id} className="chip" onClick={() => { setCard(c); go("target"); }}>
                      {c.name} <small>{c.minutes} min</small>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grp">
                <div className="g ayu">Ayuda</div>
                <div className="chips">
                  {CARDS.filter((c) => c.type === "ayuda").map((c) => (
                    <button key={c.id} className="chip" onClick={() => { setCard(c); go("confirm"); }}>
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === "target" && (
            <>
              <div className="wizq">¿Contra qué barco?</div>
              <div className="chips">
                {game.teams.filter((t) => t.id !== atk?.id).map((t) => (
                  <button key={t.id} className="chip" onClick={() => { setTarget(t); go("def"); }}>
                    {t.name}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === "def" && (
            <>
              <div className="wizq">¿{target?.name} responde con defensa?</div>
              <div className="chips">
                {DEFENSES.map((d) => (
                  <button
                    key={d.key}
                    className="chip"
                    onClick={() => {
                      setDefense(d.key);
                      go(d.key === "viento" ? "redirect" : "confirm");
                    }}
                  >
                    {d.name} {d.hint && <small>{d.hint}</small>}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === "redirect" && (
            <>
              <div className="wizq">Viento en contra: ¿hacia qué barco se redirige?</div>
              <div className="chips">
                {game.teams.filter((t) => t.id !== target?.id).map((t) => (
                  <button key={t.id} className="chip" onClick={() => { setRedirect(t); go("confirm"); }}>
                    {t.name}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === "confirm" && atk && card && (
            <>
              <div className="resumen">
                <b>{atk.name}</b> juega <span className="cardname">{card.name}</span>
                {card.type === "ayuda" && <> — {card.effect}.</>}
                {card.type === "sabotaje" && target && (
                  <>
                    {" "}contra <b>{target.name}</b>
                    {(!defense || defense === "no") && <>. Sin defensa: la maldición corre <b>{card.minutes} min</b>.</>}
                    {defense === "casco" && <>. <b>Casco blindado</b>: bloqueada, ambas cartas usadas, sin efecto.</>}
                    {defense === "viento" && redirect && (
                      <>. <b>Viento en contra</b>: la maldición se redirige a <b>{redirect.name}</b> por {card.minutes} min.</>
                    )}
                    {defense === "kraken" && <>. <b>Maldición del Kraken</b>: el efecto corre para ambos barcos por {card.minutes} min.</>}
                    {defense === "botin" && <>. <b>Botín de repuesto</b>: sufre la maldición {card.minutes} min y gana una carta de ayuda.</>}
                  </>
                )}
              </div>
              {credits(game, atk.id, now) <= 0 && (
                <div className="warn">⚠ {atk.name} no tiene cartas disponibles esta hora — podés registrar igual si el jurado lo avala.</div>
              )}
              {victimCursed && finalVictim && (
                <div className="warn">⚠ {finalVictim.name} ya está bajo una maldición — solo puede sufrir una a la vez. Terminá la anterior o registrá igual.</div>
              )}
              {serverError && <div className="warn">⚠ {serverError}</div>}
            </>
          )}

          <div className="modal-actions">
            <button
              className="btn-ghost"
              style={{ visibility: trail.length > 1 ? "visible" : "hidden" }}
              onClick={back}
            >
              ← Atrás
            </button>
            <div className="right">
              <button className="btn-ghost" onClick={onClose}>Cancelar</button>
              {step === "confirm" && (
                <button className="btn-main" onClick={register} disabled={sending}>Registrar</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into `app/jurado/page.tsx`**

Add state and the button inside the component (after the existing hooks):

```tsx
const [wizardOpen, setWizardOpen] = useState(false);
```
(import `useState` from react and `Wizard` from `@/components/Wizard`).

In the toolbar, next to the hora/Zarpar element, add:
```tsx
<button className="btn-main" onClick={() => setWizardOpen(true)}>⚓ Registrar carta</button>
```
so the toolbar becomes: hora/zarpar on the left, register button on the right (same `.toolbar` flex layout as the mockup).

At the bottom of the returned JSX (inside the `game && nowMs !== null` guard):
```tsx
{wizardOpen && (
  <Wizard
    game={game}
    nowMs={nowMs}
    onClose={() => setWizardOpen(false)}
    onDone={() => { setWizardOpen(false); refresh(); }}
  />
)}
```

- [ ] **Step 3: Verify**

Run: `npm test` && `npm run build` — Expected: PASS / success.

- [ ] **Step 4: Commit**

```bash
git add components/Wizard.tsx app/jurado/ && git commit -m "Wizard de registro de cartas"
```

---

### Task 7: README de deploy y verificación final

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: everything.
- Produces: deploy/run instructions; final green build.

- [ ] **Step 1: Extend `README.md`** — append after the existing links:

```markdown
## Correr local

​```bash
npm install
npm run dev
​```

Sin variables de entorno usa un estado en memoria (se pierde al reiniciar) y no pide PIN.

- Tablero público: http://localhost:3000
- Vista jurado: http://localhost:3000/jurado

## Deploy (Vercel)

1. Importar el repo en Vercel.
2. En el marketplace de Vercel agregar **Upstash Redis** al proyecto — inyecta
   `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`.
3. Agregar la env var `JURY_PIN` (el PIN compartido del jurado).
4. Deploy. `/` es el tablero público, `/jurado` la vista del jurado.

## Tests

​```bash
npm test
​```
```
(remove the zero-width markers `​` — they exist only so this plan's code fence doesn't break; the real README uses plain triple backticks.)

- [ ] **Step 2: Full verification**

Run: `npm test` — Expected: PASS.
Run: `npm run build` — Expected: success.
Manual smoke (memory store): `npm run dev &`, then:
```bash
curl -s -X POST localhost:3000/api/teams -H 'content-type: application/json' -d '{"name":"La Perla Negra"}'
curl -s -X POST localhost:3000/api/teams -H 'content-type: application/json' -d '{"name":"Barbanegra"}'
curl -s -X POST localhost:3000/api/sail
curl -s localhost:3000/api/state
```
Expected: state JSON with 2 teams and `startedAt` set. Register a play with the two team ids from the state response and confirm one effect appears in `/api/state`. Kill dev server.

- [ ] **Step 3: Commit**

```bash
git add README.md && git commit -m "README: correr local y deploy"
```
