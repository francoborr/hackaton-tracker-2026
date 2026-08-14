"use client";

import { useState } from "react";
import { Board } from "@/components/Board";
import { Creditos } from "@/components/Creditos";
import { Fleet } from "@/components/Fleet";
import { Masthead } from "@/components/Masthead";
import { PinGate, usePinVerified } from "@/components/PinGate";
import { Wizard } from "@/components/Wizard";
import { cardById } from "@/lib/cards";
import { mutate, useGame } from "@/lib/client";
import { currentHour } from "@/lib/game";

export default function Jurado() {
  const [pinOk, markVerified] = usePinVerified();
  const { game, nowMs, refresh, failed } = useGame();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

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
    const effect = game?.effects.find((e) => e.id === id);
    const carta = cardById(effect?.cardId ?? "")?.name ?? effect?.cardId ?? "esta carta";
    const victima = game?.teams.find((t) => t.id === effect?.victimId)?.name ?? "¿?";
    if (!confirm(`¿Terminar ${carta} sobre ${victima}?`)) return;
    try {
      const res = await mutate(`/api/effects/${id}`, "DELETE");
      if (res.status === 401) alert("PIN inválido — recargá la página");
    } catch {
      alert("Sin conexión — probá de nuevo");
    }
    refresh();
  }

  async function sail() {
    try {
      const res = await mutate("/api/sail", "POST");
      if (res.status === 401) alert("PIN inválido — recargá la página");
    } catch {
      alert("Sin conexión — probá de nuevo");
    }
    refresh();
  }

  async function advanceHour() {
    if (!confirm("¿Adelantar una hora de travesía? Todos los barcos ganan una carta.")) return;
    try {
      const res = await mutate("/api/advance-hour", "POST");
      if (res.status === 401) alert("PIN inválido — recargá la página");
      if (res.status === 422) alert("Todavía no zarparon — no hay hora que adelantar");
    } catch {
      alert("Sin conexión — probá de nuevo");
    }
    refresh();
  }

  async function reset() {
    try {
      const res = await mutate("/api/reset", "POST");
      if (res.status === 401) alert("PIN inválido — recargá la página");
    } catch {
      alert("Sin conexión — probá de nuevo");
    }
    setResetOpen(false);
    refresh();
  }

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
            <div className="toolbar">
              {game.startedAt ? (
                <span className="hora">⚓ Hora {currentHour(game, new Date(nowMs))} de travesía</span>
              ) : (
                <button className="btn-main" onClick={sail}>⚓ Zarpar</button>
              )}
              <button
                className="btn-main"
                disabled={game.teams.length === 0}
                onClick={() => setWizardOpen(true)}
              >
                ⚓ Registrar carta
              </button>
            </div>

            <h2>Maldiciones en curso</h2>
            <Board game={game} nowMs={nowMs} onEnd={endEffect} />

            <h2>Cartas disponibles por barco</h2>
            <Creditos game={game} nowMs={nowMs} />

            <h2>La flota</h2>
            <Fleet game={game} onChange={refresh} />

            <div className="danger-zone">
              <div className="danger-actions">
                <button className="btn-danger" onClick={advanceHour}>⏩ Adelantar una hora</button>
                <button className="btn-danger" onClick={() => setResetOpen(true)}>↺ Reiniciar la travesía</button>
              </div>
              <p className="hintline">
                Adelantar da una carta más a todos los barcos. Reiniciar vuelve el juego al estado
                previo al zarpe. Ambos piden confirmación.
              </p>
            </div>

            {resetOpen && (
              <div className="overlay open">
                <div className="modal">
                  <div className="inner">
                    <h2>¿Reiniciar la travesía?</h2>
                    <div className="reset-body">
                      Esto vuelve el juego al estado previo al zarpe:
                      <ul>
                        <li>✕ Se borra la hora de zarpe</li>
                        <li>✕ Se borran todas las maldiciones en curso</li>
                        <li>✕ Se borran los usos de cartas y créditos</li>
                        <li className="keeps">✓ La flota (los barcos) se mantiene</li>
                      </ul>
                      No se puede deshacer.
                    </div>
                    <div className="modal-actions">
                      <span></span>
                      <div className="right">
                        <button className="btn-ghost" onClick={() => setResetOpen(false)}>Cancelar</button>
                        <button className="btn-danger" onClick={reset}>↺ Sí, reiniciar</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {wizardOpen && (
              <Wizard
                game={game}
                nowMs={nowMs}
                onClose={() => setWizardOpen(false)}
                onDone={() => { setWizardOpen(false); refresh(); }}
              />
            )}
          </>
        )}
      </main>
    </>
  );
}
