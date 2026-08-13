"use client";

import { useState } from "react";
import type { Game } from "@/lib/game";
import { mutate } from "@/lib/client";

export function Fleet({ game, onChange }: { game: Game; onChange: () => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const res = await mutate("/api/teams", "POST", { name: trimmed });
    if (res.ok) {
      setName("");
      setError(null);
      onChange();
    } else {
      setError((await res.json()).error ?? "no se pudo sumar el barco");
    }
  }

  async function remove(id: string, teamName: string) {
    if (!confirm(`¿Quitar a ${teamName} de la flota?`)) return;
    await mutate(`/api/teams/${id}`, "DELETE");
    onChange();
  }

  return (
    <div className="creditos">
      <div className="fleet-list">
        {game.teams.map((t) => (
          <div className="crow" key={t.id}>
            <b>{t.name}</b>
            <button
              className="btn-x"
              style={{ position: "static" }}
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
        <button className="btn-ghost" type="submit">Sumar barco</button>
      </form>
      {error && <p className="hintline">⚠ {error}</p>}
      <p className="hintline">
        El mazo de cartas no se edita desde la app: vive en el código (lib/cards.ts).
      </p>
    </div>
  );
}
