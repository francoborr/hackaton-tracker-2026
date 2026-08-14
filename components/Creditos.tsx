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
            ) : c < 0 ? (
              <span className="none">debe {-c} {c === -1 ? "carta" : "cartas"}</span>
            ) : (
              <span className="none">sin cartas esta hora</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
