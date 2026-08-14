"use client";

import { useState } from "react";
import { CARDS, type Card } from "@/lib/cards";
import { credits, type Defense, type Game, type Team } from "@/lib/game";
import { mutate } from "@/lib/client";

type Step = "atk" | "card" | "target" | "def" | "redirect" | "confirm";

const DEFENSES: { key: Defense | "no"; name: string; hint?: string; desc?: string }[] = [
  { key: "no", name: "No" },
  { key: "casco", name: "Casco blindado", hint: "bloquea", desc: "Bloquea el sabotaje: ambas cartas se gastan y no pasa nada." },
  { key: "viento", name: "Viento en contra", hint: "redirige", desc: "Redirige la maldición hacia otro barco que elige el defensor." },
  { key: "kraken", name: "Maldición del Kraken", hint: "a ambos", desc: "La maldición aplica a ambos: víctima y atacante a la vez." },
  { key: "botin", name: "Botín de repuesto", hint: "sufre +1 ayuda", desc: "Sufre la maldición igual, pero gana una carta de ayuda de compensación." },
];

const CRUMBS: Record<Step, { n: string; label: string }> = {
  atk: { n: "1", label: "Barco" },
  card: { n: "2", label: "Carta" },
  target: { n: "3", label: "Objetivo" },
  def: { n: "4", label: "Defensa" },
  redirect: { n: "4b", label: "Redirigir" },
  confirm: { n: "final", label: "Confirmar" },
};

// El "?" abre un popover sin disparar la selección del chip que lo contiene.
function Qmark({ id, open, setOpen, title, body }: {
  id: string; open: string | null; setOpen: (v: string | null) => void; title: string; body: string;
}) {
  return (
    <>
      <span
        className="qmark"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(open === id ? null : id);
        }}
      >
        ?
      </span>
      {open === id && <span className="pop"><b>{title}</b>{body}</span>}
    </>
  );
}

export function Wizard({ game, nowMs, onClose, onDone }: {
  game: Game; nowMs: number; onClose: () => void; onDone: () => void;
}) {
  const [trail, setTrail] = useState<Step[]>(["atk"]);
  const [atk, setAtk] = useState<Team | null>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [target, setTarget] = useState<Team | null>(null);
  const [defense, setDefense] = useState<Defense | "no" | null>(null);
  const [redirect, setRedirect] = useState<Team | null>(null);
  const [sending, setSending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pop, setPop] = useState<string | null>(null);

  const step = trail[trail.length - 1];
  const go = (s: Step) => {
    setServerError(null);
    setPop(null);
    setTrail((t) => [...t, s]);
  };
  const back = () => {
    setServerError(null);
    setPop(null);
    setTrail((t) => (t.length > 1 ? t.slice(0, -1) : t));
  };

  async function register() {
    if (!atk || !card) return;
    setServerError(null);
    setSending(true);
    const sabotaje = card.type === "sabotaje";
    const body = {
      attackerId: atk.id,
      cardId: card.id,
      ...(sabotaje && target ? { victimId: target.id } : {}),
      ...(sabotaje && defense && defense !== "no" ? { defense } : {}),
      ...(sabotaje && defense === "viento" && redirect ? { redirectId: redirect.id } : {}),
    };
    try {
      const res = await mutate("/api/plays", "POST", body);
      if (res.ok) {
        onDone();
      } else {
        setServerError((await res.json()).error ?? "no se pudo registrar");
      }
    } catch {
      setServerError("no se pudo registrar — revisá la conexión");
    } finally {
      setSending(false);
    }
  }

  const now = new Date(nowMs);
  const finalVictim = defense === "viento" ? redirect : target;
  const victimCursed =
    card?.type === "sabotaje" &&
    defense !== "casco" &&
    finalVictim !== null &&
    game.effects.some((e) => e.victimId === finalVictim.id && new Date(e.endsAt).getTime() > nowMs);

  return (
    <div className="overlay open">
      <div className="modal">
        <div className="inner">
          <h2>Registrar carta</h2>
          <div className="crumb">Paso <b>{CRUMBS[step].n}</b> · {CRUMBS[step].label}</div>

          {step === "atk" && (
            <>
              <div className="wizq">¿Qué barco juega la carta?</div>
              <div className="chips">
                {game.teams.map((t) => (
                  <button key={t.id} className="chip" onClick={() => { setAtk(t); go("card"); }}>
                    {t.name}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === "card" && (
            <>
              <div className="wizq">¿Qué carta juega {atk?.name}?</div>
              <div className="grp">
                <div className="g sab">Sabotaje</div>
                <div className="chips">
                  {CARDS.filter((c) => c.type === "sabotaje").map((c) => (
                    <button key={c.id} className="chip" onClick={() => { setCard(c); go("target"); }}>
                      {c.name} <small>{c.minutes} min</small>
                      <Qmark
                        id={c.id}
                        open={pop}
                        setOpen={setPop}
                        title={c.name}
                        body={`${c.effect}${c.minutes ? ` · dura ${c.minutes} min` : ""}`}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <div className="grp">
                <div className="g ayu">Ayuda</div>
                <div className="chips">
                  {CARDS.filter((c) => c.type === "ayuda").map((c) => (
                    <button key={c.id} className="chip" onClick={() => { setCard(c); go("confirm"); }}>
                      {c.name}
                      <Qmark
                        id={c.id}
                        open={pop}
                        setOpen={setPop}
                        title={c.name}
                        body={`${c.effect}${c.minutes ? ` · dura ${c.minutes} min` : ""}`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === "target" && (
            <>
              <div className="wizq">¿Contra qué barco?</div>
              <div className="chips">
                {game.teams.filter((t) => t.id !== atk?.id).map((t) => (
                  <button key={t.id} className="chip" onClick={() => { setTarget(t); go("def"); }}>
                    {t.name}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === "def" && (
            <>
              <div className="wizq">¿{target?.name} responde con defensa?</div>
              <div className="chips">
                {DEFENSES.map((d) => (
                  <button
                    key={d.key}
                    className="chip"
                    onClick={() => {
                      setDefense(d.key);
                      go(d.key === "viento" ? "redirect" : "confirm");
                    }}
                  >
                    {d.name} {d.hint && <small>{d.hint}</small>}
                    {d.desc && (
                      <Qmark id={d.key} open={pop} setOpen={setPop} title={d.name} body={d.desc} />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === "redirect" && (
            <>
              <div className="wizq">Viento en contra: ¿hacia qué barco se redirige?</div>
              <div className="chips">
                {game.teams.filter((t) => t.id !== target?.id).map((t) => (
                  <button key={t.id} className="chip" onClick={() => { setRedirect(t); go("confirm"); }}>
                    {t.name}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === "confirm" && atk && card && (
            <>
              <div className="resumen">
                <b>{atk.name}</b> juega <span className="cardname">{card.name}</span>
                {card.type === "ayuda" && <> — {card.effect}.</>}
                {card.type === "sabotaje" && target && (
                  <>
                    {" "}contra <b>{target.name}</b>
                    {(!defense || defense === "no") && <>. Sin defensa: la maldición corre <b>{card.minutes} min</b>.</>}
                    {defense === "casco" && <>. <b>Casco blindado</b>: bloqueada, ambas cartas usadas, sin efecto.</>}
                    {defense === "viento" && redirect && (
                      <>. <b>Viento en contra</b>: la maldición se redirige a <b>{redirect.name}</b> por {card.minutes} min.</>
                    )}
                    {defense === "kraken" && <>. <b>Maldición del Kraken</b>: el efecto corre para ambos barcos por {card.minutes} min.</>}
                    {defense === "botin" && <>. <b>Botín de repuesto</b>: sufre la maldición {card.minutes} min y gana una carta de ayuda.</>}
                  </>
                )}
              </div>
              {credits(game, atk.id, now) <= 0 && (
                <div className="warn">⚠ {atk.name} no tiene cartas disponibles esta hora — podés registrar igual si el jurado lo avala.</div>
              )}
              {victimCursed && finalVictim && (
                <div className="warn">⚠ {finalVictim.name} ya está bajo una maldición — solo puede sufrir una a la vez. Terminá la anterior o registrá igual.</div>
              )}
              {serverError && <div className="warn">⚠ {serverError}</div>}
            </>
          )}

          <div className="modal-actions">
            <button
              className="btn-ghost"
              style={{ visibility: trail.length > 1 ? "visible" : "hidden" }}
              onClick={back}
            >
              ← Atrás
            </button>
            <div className="right">
              <button className="btn-ghost" onClick={onClose}>Cancelar</button>
              {step === "confirm" && (
                <button className="btn-main" onClick={register} disabled={sending}>
                  {sending ? "Registrando…" : "Registrar"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
