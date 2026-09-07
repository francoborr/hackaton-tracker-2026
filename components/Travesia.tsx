"use client";

import { currentHour, type Game } from "@/lib/game";

function hhmm(d: Date): string {
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(d);
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
  return (
    <div className="travesia">
      <span className="hora">⚓ Hora {currentHour(game, now)} de travesía</span>
      <span className="travesia-datos">
        Zarpamos a las {hhmm(new Date(game.startedAt))} · <b>free for all</b>: sin límite de cartas
      </span>
    </div>
  );
}
