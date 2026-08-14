# 🏴‍☠️ Hackaton Tracker 2026

Tracker de cartas de poder para la Hackathon 2026 de Mimiquate. El jurado registra qué cartas
juega cada equipo; el tablero muestra las maldiciones en curso con countdown y expiración
automática.

- **[SPEC.md](SPEC.md)** — reglas, modelo de datos, API y stack (spec-driven development).
- **[docs/mockup.html](docs/mockup.html)** — mockup navegable aprobado, fuente de verdad visual.

## Correr local

```bash
npm install
npm run dev
```

Sin variables de entorno usa un estado en memoria (se pierde al reiniciar) y no pide PIN.
En Vercel el estado en memoria no sirve (cada instancia serverless tiene el suyo): las
variables de Upstash son obligatorias en producción.

- Tablero público: http://localhost:3000
- Vista jurado: http://localhost:3000/jurado

## Deploy (Vercel)

1. Importar el repo en Vercel.
2. En el marketplace de Vercel agregar **Upstash Redis** al proyecto — inyecta
   `KV_REST_API_URL` y `KV_REST_API_TOKEN` (también sirven `UPSTASH_REDIS_REST_URL` y
   `UPSTASH_REDIS_REST_TOKEN` si la base se crea a mano en Upstash).
3. Agregar la env var `JURY_PIN` (el PIN compartido del jurado). Es obligatoria: en
   producción, sin `JURY_PIN` toda mutación se rechaza con 401. La apertura sin PIN
   existe solo para desarrollo local.
4. Deploy. `/` es el tablero público, `/jurado` la vista del jurado.

## Avisos por Slack (opcional)

Cada carta registrada se anuncia en un canal de Slack, con el arte de la carta y el link
al tablero. Para prenderlo:

1. En [api.slack.com/apps](https://api.slack.com/apps) → tu app → **Incoming Webhooks** →
   *Add New Webhook to Workspace* → elegir el canal. Slack devuelve una URL
   `https://hooks.slack.com/services/...`.
2. Cargarla en Vercel como `SLACK_WEBHOOK_URL` y **redeployar** (las env vars se toman
   recién en el deploy siguiente).

El día del evento alcanza con crear el canal, generar el webhook y repetir el paso 2; se
puede probar antes apuntando a un canal privado. Sin la variable la app no manda nada, y
si Slack falla o tarda la jugada se registra igual — el aviso nunca bloquea al jurado.

## Tests

```bash
npm test
```
