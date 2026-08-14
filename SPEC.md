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

1. **Maldiciones en curso**: un tile por efecto activo con el **arte de la carta**
   (`public/cards/<id>.jpg`, el mismo diseño que se imprime) a la izquierda y a la derecha
   "⚔ {atacante} maldijo a {víctima}", nombre de la carta, efecto, countdown grande y una mecha
   que se consume. Tres colores para distinguir los roles de un vistazo: **atacante** en azul
   acero, **víctima** en pergamino claro, **carta** en el color de su categoría (ciruela
   sabotaje / verde bendición). Si la carta ya no está en el mazo el tile va sin arte. En vista jurado cada
   tile tiene una "✕" para terminarlo antes de tiempo (pide confirmación). Al llegar a 0 el
   efecto desaparece solo. Si el atacante ya no está en la flota se muestra "¿?".
   Sin efectos: "El mar está en calma".
2. **Cartas disponibles por barco**: lista vertical, una fila por equipo, con una ancla ⚓ por
   crédito disponible. Sin créditos: "sin cartas esta hora"; si jugó de más: "debe N cartas".
3. **La flota** (solo jurado): alta de barcos por nombre (solo nombre, sin más campos) y baja
   con "✕". Se carga días antes del evento. Quitar un barco borra la maldición que estaba
   sufriendo y su historial de cartas (usos y bonus); las maldiciones que él lanzó siguen
   corriendo sobre sus víctimas.

## Reglas del juego que la app modela

- **Crédito horario**: cada equipo habilita 1 carta por hora de evento. `disponibles(equipo) =
  horas_transcurridas + bonus(equipo) − cartas_usadas(equipo)`. El reloj corre continuo desde el
  inicio (el almuerzo no pausa). **Bloqueo duro, sin override**: sin crédito un barco no puede
  atacar, ni bendecirse, ni defenderse — el server rechaza la jugada (422) y el wizard
  deshabilita el barco como atacante y sus defensas como víctima. Antes de zarpar nadie tiene
  cartas, así que no se puede registrar nada.
- **Una maldición por víctima**: un equipo no puede estar sufriendo más de un efecto a la vez.
  **Bloqueo duro, sin override**: el server rechaza la jugada (422) y
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

**Ayuda** (bendición de **10 minutos** sobre el propio barco; consume crédito): aparece en el
tablero como "Bendiciones en curso" (tile verde) con countdown y ✕ como cualquier efecto.
**Cada ayuda es un recurso exclusivo**: mientras una bendición corre, ningún otro barco puede
usar esa misma carta (bloqueo duro, server + wizard). Una bendición activa NO cuenta como
maldición: el barco puede ser atacado y jugar normalmente.

- Consejo de cartógrafo — consulta a Javi
- Consejo del almirante — consulta a un CEO de Mimiquate
- Señal de humo — consulta al jurado

**Defensa** (reactivas: se juegan cuando te atacan, en el mismo registro del ataque):

| Carta | Resolución en la app |
| --- | --- |
| Inmunidad (arte impreso; era "Casco blindado") | El sabotaje queda bloqueado: ambas cartas usadas, sin efecto |
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
5. **Confirmar**: resumen en prosa de lo que va a pasar + los bloqueos que apliquen (sin
   crédito, víctima ya maldita, ayuda en uso), que deshabilitan "Registrar". Botón recién acá.

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
  "bonus": { "t1": 1 },                       // créditos extra (Botín de repuesto)
  "rev": 7                                    // versión del doc, para el compare-and-set
}
```

- La expiración es pasiva: nadie borra efectos por timer. Un efecto está activo si
  `endsAt > now`; los clientes calculan el countdown y el server filtra expirados al leer.
- Los `usages` alimentan la cuenta de créditos; no se muestran como historial.

## API (Next.js route handlers)

Mutaciones con header `x-jury-pin` validado contra `JURY_PIN`; lecturas públicas.

- `GET /api/state` → documento completo con efectos expirados filtrados, más `serverNow`
  (la hora del server: los clientes corrigen su reloj con eso antes de contar).
- `POST /api/plays` → registra una jugada del wizard:
  `{ attackerId, cardId, victimId?, defense?: "casco"|"viento"|"kraken"|"botin", redirectId? }`.
  El server resuelve la defensa (crea 0, 1 o 2 efectos + usages + bonus) en una sola mutación.
- `DELETE /api/effects/:id` → terminar ahora.
- `POST /api/teams { name }` / `DELETE /api/teams/:id` (borra al barco, las maldiciones que
  sufría, sus usos y su bonus; no toca las que lanzó).
- `POST /api/sail` → fija `startedAt`.

## Avisos por Slack

Cada jugada registrada se anuncia en un canal de Slack vía Incoming Webhook
(`SLACK_WEBHOOK_URL`, opcional: sin la variable no se manda nada). El mensaje lo arma
`lib/slack.ts` con Block Kit: header según lo que pasó (jugado / bloqueado / redirigido /
espejado / con botín / ayuda), los datos en dos columnas, el arte de la carta como
miniatura (`<origen>/cards/<id>.jpg`) y un contexto con el link al tablero y la hora de fin
(formateada por Slack en el huso de cada uno).

Reglas: el aviso sale **después** de que la jugada se guardó, fuera del reintento de
concurrencia, así nunca se duplica ni se manda por una jugada que falló; y cualquier error
—red, timeout de 3 s, 4xx de Slack— se traga: la jugada ya está registrada y el jurado
recibe su 200 igual.

Concurrencia: 5 escritores, tráfico mínimo, pero el doc entero se reescribe en cada mutación:
va con **compare-and-set** sobre un campo `rev` (Lua en Redis, comparación directa en memoria).
Si otro jurado escribió en el medio, la mutación se reintenta sobre el doc nuevo (hasta 5
veces; después, 409). Sin websockets: los clientes hacen **polling de `GET /api/state` cada 5 s**.

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
