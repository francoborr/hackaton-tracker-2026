"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Game } from "./game";

// El reloj de referencia es el del server: los teléfonos del jurado pueden estar
// corridos y los countdowns (y los créditos por hora) tienen que coincidir con el
// tablero proyectado.
export function useGame(): {
  game: Game | null;
  nowMs: number | null;
  refresh: () => Promise<void>;
  failed: boolean;
} {
  const [game, setGame] = useState<Game | null>(null);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const offsetRef = useRef(0);
  const seqRef = useRef(0);

  const refresh = useCallback(async () => {
    const seq = ++seqRef.current;
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      const doc = res.ok ? ((await res.json()) as Game & { serverNow?: string }) : null;
      if (seq < seqRef.current) return; // llegó tarde: ya hay un poll más nuevo
      if (!doc) {
        setFailed(true);
        return;
      }
      const { serverNow, ...rest } = doc;
      if (serverNow) offsetRef.current = Date.parse(serverNow) - Date.now();
      setGame(rest);
      setFailed(false);
    } catch {
      if (seq === seqRef.current) setFailed(true); // sin red: reintenta en el próximo poll
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  // nowMs arranca en null para que el server y el cliente rindan lo mismo en la
  // hidratación; después late cada segundo con el offset del server aplicado.
  useEffect(() => {
    const tick = () => setNowMs(Date.now() + offsetRef.current);
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  return { game, nowMs, refresh, failed };
}

export function getPin(): string {
  return localStorage.getItem("jury-pin") ?? "";
}

export function setPin(pin: string): void {
  localStorage.setItem("jury-pin", pin);
}

export async function mutate(path: string, method: string, body?: unknown): Promise<Response> {
  return fetch(path, {
    method,
    headers: { "content-type": "application/json", "x-jury-pin": getPin() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
