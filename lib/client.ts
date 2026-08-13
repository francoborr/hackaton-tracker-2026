"use client";

import { useCallback, useEffect, useState } from "react";
import type { Game } from "./game";

export function useGame(): { game: Game | null; refresh: () => Promise<void> } {
  const [game, setGame] = useState<Game | null>(null);
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      if (res.ok) setGame(await res.json());
    } catch {
      // sin red: reintenta en el próximo poll
    }
  }, []);
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);
  return { game, refresh };
}

export function useNowMs(): number | null {
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    setNowMs(Date.now());
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return nowMs;
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
