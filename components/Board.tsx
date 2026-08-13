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
