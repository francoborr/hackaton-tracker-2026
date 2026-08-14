# Hackaton Tracker 2026 — Especificación

Tracker de cartas de poder para la Hackathon 2026 de Mimiquate (7 de septiembre, temática pirata).
El jurado registra qué cartas juega cada equipo y la app muestra qué equipos están bajo un efecto,
con expiración automática.

El diseño de referencia es `docs/mockup.html` (abrir en el navegador): es la fuente de verdad
visual y de flujo. Esta spec es la fuente de verdad de reglas y arquitectura.

## Usuarios y vistas

Dos vistas que renderizan el mismo estado:

- **Vista Jurado** (5 jurados, cada uno desde su dispositivo): tablero + acciones.
  Protegida por un PIN compartido (env var `JURY_PIN`); se ingresa una vez y queda en
  `localStorage`.
- **Tablero Público** (sin PIN, pensada para proyectar): solo lectura — maldiciones en curso y
  cartas disponibles por barco.

Secciones (ver mockup):

1. **Maldiciones en curso**: un tile por efecto activo con "⚔ {atacante} maldijo a {víctima}",
   nombre de la carta, efecto, countdown grande y una mecha que se consume. En vista jurado cada
   tile tiene una "✕" para terminarlo antes de tiempo. Al llegar a 0 el efecto desaparece solo.
   Sin efectos: "El mar está en calma".
2. **Cartas disponibles por barco**: lista vertical, una fila por equipo, con anclas (⚓ llenas =
   créditos disponibles, apagadas = usados). Sin créditos: "sin cartas esta hora".
3. **La flota** (solo jurado): alta de barcos por nombre (solo nombre, sin más campos) y baja
   con "✕". Se carga días antes del evento.

## Reglas del juego que la app modela

- **Crédito horario**: cada equipo habilita 1 carta por hora de evento. `disponibles(equipo) =
  horas_transcurridas + bonus(equipo) − cartas_usadas(equipo)`. El reloj corre continuo desde el
  inicio (el almuerzo no pausa). La app **avisa pero no bloquea** si un equipo sin crédito juega
  una carta (override del jurado, siempre).
- **Una maldición por víctima**: un equipo no puede estar sufriendo más de un efecto a la vez.
  **Bloqueo duro, sin override** (a diferencia del crédito): el server rechaza la jugada (422) y
  el wizard deshabilita los barcos malditos como objetivo/redirección (y el Kraken si el
  atacante está maldito). Para desbloquear: esperar a que expire o terminarla con la ✕. Del lado
  del que juega no hay límite: un equipo puede tener varias jugadas activas si acumuló créditos.
- **Inicio del evento**: la vista jurado muestra "Hora N de travesía". Antes de arrancar hay un
  botón "Zarpar" que fija `startedAt` (único elemento no presente en el mockup).
- Las cartas son transferibles entre equipos fuera de la app: **no se trackea inventario**, solo
  usos y efectos.

## Mazo de cartas (fijo, en código)

Las cartas viven como constante en el código (`lib/cards.ts`). No hay UI de edición: un cambio de
mazo es un commit. Set oficial "Poderes v2":

**Sabotaje** (generan efecto con countdown sobre la víctima):

| Carta | Efecto | Duración |
| --- | --- | --- |
| Naufrago | Sin internet | 5 min |
| Guardia nocturna | Sin hablar | 5 min |
| El catalejo del capitán | Una sola pantalla | 15 min |
| Secuestro de tripulación | Sin un integrante | 10 min |
| Mano de garfio | Escriben con una mano | 10 min |
| Tabla de castigo | Sin sillas | 15 min |
| Bandera extranjera | Hablan en inglés | 15 min |
| Código del corsario | Disfrazados de pirata | 15 min |

**Ayuda** (uso puntual, sin countdown; solo consume crédito):

- Consejo de cartógrafo — consulta a Javi
- Consejo del almirante — consulta a un CEO de Mimiquate
- Señal de humo — consulta al jurado

**Defensa** (reactivas: se juegan cuando te atacan, en el mismo registro del ataque):

| Carta | Resolución en la app |
| --- | --- |
| Casco blindado | El sabotaje queda bloqueado: ambas cartas usadas, sin efecto |
| Viento en contra | El efecto se redirige al barco que elija el defensor (paso extra del wizard) |
| Maldición del Kraken | El efecto corre para ambos: víctima y atacante (dos efectos gemelos) |
| Botín de repuesto | La víctima sufre el efecto normal y gana +1 crédito (carta de ayuda random) |

Usar una defensa consume el crédito del defensor.

## Flujo: registrar carta (wizard)

Un paso por pantalla, seleccionar avanza, "← Atrás" siempre disponible:

1. **Barco**: quién juega la carta.
2. **Carta**: sabotaje o ayuda (una sola). Ayuda → salta a confirmar.
3. **Objetivo**: contra qué barco (excluye al atacante).
4. **Defensa**: No / Casco / Viento / Kraken / Botín. Viento agrega el paso 4b (elegir redirigido).
5. **Confirmar**: resumen en prosa de lo que va a pasar + warnings (atacante sin crédito, víctima
   ya maldita). Botón "Registrar" recién acá.

## Correcciones

- **✕ sobre un efecto activo**: lo termina ya (queda como usado, no devuelve crédito).
- Nada de edición: si se registró mal, se termina con ✕ y se registra de nuevo.
- No hay historial/bitácora visible (decisión de scope).

## Modelo de datos

Un único documento JSON en Redis (key `game`), sin ORM ni migraciones:

```jsonc
{
  "startedAt": "2026-09-07T12:00:00Z",       // null hasta "Zarpar"
  "teams": [{ "id": "t1", "name": "La Perla Negra" }],
  "effects": [
    {
      "id": "e1",
      "cardId": "mano-de-garfio",
      "attackerId": "t4",
      "victimId": "t1",
      "endsAt": "2026-09-07T14:30:00Z"       // expiración calculada al registrar
    }
  ],
  "usages": [
    { "id": "u1", "teamId": "t4", "cardId": "mano-de-garfio", "at": "..." }
    // una entrada por carta usada: ataques, ayudas y defensas
  ],
  "bonus": { "t1": 1 }                        // créditos extra (Botín de repuesto)
}
```

- La expiración es pasiva: nadie borra efectos por timer. Un efecto está activo si
  `endsAt > now`; los clientes calculan el countdown y el server filtra expirados al leer.
- Los `usages` alimentan la cuenta de créditos; no se muestran como historial.

## API (Next.js route handlers)

Mutaciones con header `x-jury-pin` validado contra `JURY_PIN`; lecturas públicas.

- `GET /api/state` → documento completo con efectos expirados filtrados.
- `POST /api/plays` → registra una jugada del wizard:
  `{ attackerId, cardId, victimId?, defense?: "casco"|"viento"|"kraken"|"botin", redirectId? }`.
  El server resuelve la defensa (crea 0, 1 o 2 efectos + usages + bonus) en una sola mutación.
- `DELETE /api/effects/:id` → terminar ahora.
- `POST /api/teams { name }` / `DELETE /api/teams/:id`.
- `POST /api/sail` → fija `startedAt`.

Concurrencia: 5 escritores, tráfico mínimo — lectura + escritura del doc completo alcanza
(last-write-wins). Sin websockets: los clientes hacen **polling de `GET /api/state` cada 5 s**.

## Stack y deploy

- **Next.js (App Router) + TypeScript**, deploy en **Vercel**.
- Estado en **Upstash Redis** (integración KV del marketplace de Vercel), acceso vía
  `@upstash/redis`.
- Sin librería de UI: CSS propio siguiendo el mockup (tema oscuro único: madera quemada,
  pergamino, oro; serif tipo Palatino en small caps; mecha con brasa como countdown).
- Env vars: `JURY_PIN`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.

## Fuera de alcance

- Historial/bitácora, auditoría.
- Tracking de inventario/trueques de cartas.
- Usuarios individuales, roles, auth real.
- Edición del mazo desde la UI.
- Reglas viejas descartadas: "misma carta dos veces seguidas" y "dos poderes al mismo equipo".
