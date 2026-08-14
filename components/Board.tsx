"use client";

import { cardById } from "@/lib/cards";
import type { Effect, Game } from "@/lib/game";

function fmt(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function Tile({ effect, game, nowMs, onEnd }: {
  effect: Effect; game: Game; nowMs: number; onEnd?: (id: string) => void;
}) {
  const card = cardById(effect.cardId);
  const bless = card?.type === "ayuda";
  const totalMs = (card?.minutes ?? 0) * 60_000;
  const leftMs = new Date(effect.endsAt).getTime() - nowMs;
  const name = (id: string) => game.teams.find((t) => t.id === id)?.name ?? "¿?";

  return (
    <div className={bless ? "btile bless" : "btile"}>
      {onEnd && (
        <button className="btn-x" title="Terminar ahora" onClick={() => onEnd(effect.id)}>✕</button>
      )}
      {bless ? (
        <div className="atk">🕊 bendición para</div>
      ) : (
        <div className="atk">⚔ <b>{name(effect.attackerId)}</b> maldijo a</div>
      )}
      <div className="who">{name(effect.victimId)}</div>
      <div className="what">{card?.name}</div>
      <div className="desc">{card?.effect}</div>
      <div className="big">{fmt(leftMs)}</div>
      <div className="fuse">
        <div className="fuse-fill" style={{ width: `${totalMs ? Math.min(100, (leftMs / totalMs) * 100) : 0}%` }} />
      </div>
    </div>
  );
}

export function Board({ game, nowMs, onEnd }: { game: Game; nowMs: number; onEnd?: (id: string) => void }) {
  const active = game.effects.filter((e) => new Date(e.endsAt).getTime() > nowMs);
  const curses = active.filter((e) => cardById(e.cardId)?.type === "sabotaje");
  const blessings = active.filter((e) => cardById(e.cardId)?.type === "ayuda");

  return (
    <>
      {curses.length === 0 ? (
        <div className="calm">El mar está en calma — ninguna maldición activa</div>
      ) : (
        <div className="board">
          {curses.map((e) => <Tile key={e.id} effect={e} game={game} nowMs={nowMs} onEnd={onEnd} />)}
        </div>
      )}
      {blessings.length > 0 && (
        <>
          <h2>Bendiciones en curso</h2>
          <div className="board">
            {blessings.map((e) => <Tile key={e.id} effect={e} game={game} nowMs={nowMs} onEnd={onEnd} />)}
          </div>
        </>
      )}
    </>
  );
}
