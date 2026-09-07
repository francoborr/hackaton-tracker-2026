"use client";

import { Board } from "@/components/Board";
import { Masthead } from "@/components/Masthead";
import { Travesia } from "@/components/Travesia";
import { useGame } from "@/lib/client";

export default function PublicBoard() {
  const { game, nowMs, failed } = useGame();

  return (
    <>
      <Masthead />
      <main className="wrap">
        {game === null && (
          <div className="calm">
            {failed ? "Sin conexión con el navío — reintentando…" : "Cargando la travesía…"}
          </div>
        )}
        {game && nowMs !== null && (
          <>
            <div className="toolbar solo">
              <Travesia game={game} nowMs={nowMs} />
            </div>
            <h2>Maldiciones en curso</h2>
            <Board game={game} nowMs={nowMs} />
          </>
        )}
      </main>
    </>
  );
}
