"use client";

import { currentHour, nextCardAt, type Game } from "@/lib/game";

function hhmm(d: Date): string {
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(d);
}

function fmt(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function Travesia({ game, nowMs }: { game: Game; nowMs: number }) {
  if (!game.startedAt) {
    return (
      <div className="travesia">
        <span className="hora">⚓ La flota aún no zarpó</span>
      </div>
    );
  }
  const now = new Date(nowMs);
  const next = nextCardAt(game, now)!;
  return (
    <div className="travesia">
      <span className="hora">⚓ Hora {currentHour(game, now)} de travesía</span>
      <span className="travesia-datos">
        Zarpamos a las {hhmm(new Date(game.startedAt))} · próxima carta a las {hhmm(next)}{" "}
        (en <b>{fmt(next.getTime() - nowMs)}</b>)
      </span>
    </div>
  );
}
