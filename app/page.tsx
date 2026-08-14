"use client";

import { Board } from "@/components/Board";
import { Creditos } from "@/components/Creditos";
import { Masthead } from "@/components/Masthead";
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
