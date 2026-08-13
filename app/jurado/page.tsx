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
