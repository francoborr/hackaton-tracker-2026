"use client";

import { useEffect, useState } from "react";
import { getPin, setPin } from "@/lib/client";

export function PinGate({ onOk }: { onOk: () => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);

  async function verify(pin: string) {
    setChecking(true);
    const res = await fetch("/api/pin", { headers: { "x-jury-pin": pin } });
    setChecking(false);
    if (res.ok) {
      setPin(pin);
      onOk();
    } else {
      setError(true);
    }
  }

  return (
    <form
      className="gate"
      onSubmit={(e) => {
        e.preventDefault();
        verify(value.trim());
      }}
    >
      <div className="wizq">Santo y seña del jurado</div>
      <input
        type="password"
        value={value}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
        placeholder="PIN"
      />
      {error && <div className="error">PIN inválido — probá de nuevo</div>}
      <button className="btn-main" type="submit" disabled={checking}>
        Abordar
      </button>
    </form>
  );
}

export function usePinVerified(): [boolean | null, () => void] {
  const [ok, setOk] = useState<boolean | null>(null);
  // verificación inicial con el PIN guardado
  useEffect(() => {
    fetch("/api/pin", { headers: { "x-jury-pin": getPin() } }).then((res) => setOk(res.ok));
  }, []);
  return [ok, () => setOk(true)];
}
