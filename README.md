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
   `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`.
3. Agregar la env var `JURY_PIN` (el PIN compartido del jurado). Sin `JURY_PIN` las
   mutaciones quedan abiertas al público — no falla, simplemente no pide PIN.
4. Deploy. `/` es el tablero público, `/jurado` la vista del jurado.

## Tests

```bash
npm test
```
