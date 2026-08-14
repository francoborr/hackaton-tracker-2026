"use client";

import { useState } from "react";
import type { Game } from "@/lib/game";
import { mutate } from "@/lib/client";

export function Fleet({ game, onChange }: { game: Game; onChange: () => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      const res = await mutate("/api/teams", "POST", { name: trimmed });
      if (res.ok) {
        setName("");
        setError(null);
        onChange();
      } else {
        setError((await res.json()).error ?? "no se pudo sumar el barco");
      }
    } catch {
      setError("sin conexión — probá de nuevo");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, teamName: string) {
    if (!confirm(`¿Quitar a ${teamName} de la flota? Se borra también su maldición activa y su historial de cartas.`)) return;
    try {
      const res = await mutate(`/api/teams/${id}`, "DELETE");
      if (res.status === 401) alert("PIN inválido — recargá la página");
      else if (!res.ok) alert("No se pudo — probá de nuevo");
    } catch {
      alert("Sin conexión — probá de nuevo");
    }
    onChange();
  }

  return (
    <div className="creditos">
      <div className="fleet-list">
        {game.teams.map((t) => (
          <div className="crow" key={t.id}>
            <b>{t.name}</b>
            <button
              className="btn-x inline"
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
        <button className="btn-ghost" type="submit" disabled={busy}>
          {busy ? "Sumando…" : "Sumar barco"}
        </button>
      </form>
      {error && <p className="hintline">⚠ {error}</p>}
      <p className="hintline">
        El mazo de cartas no se edita desde la app: vive en el código (lib/cards.ts).
      </p>
    </div>
  );
}
