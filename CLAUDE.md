# CLAUDE.md — Atelier (CRM + E-Commerce óptica)

Contexto e instrucciones para Claude Code. Leer al iniciar cada sesión.

## Qué es
CRM + tienda online para óptica. **Next.js 15** (App Router) + React 19 + TypeScript
+ Tailwind 4 + **Prisma** (PostgreSQL). Integraciones: AFIP/ARCA (facturación),
SmartLab (laboratorio), bot de **WhatsApp** (`wa-service/`), Payway (pagos),
Google GenAI/Vertex, envío de emails.

## 🔴 Reglas de seguridad (IMPORTANTE)
- **NUNCA correr nada contra la base de PRODUCCIÓN sin autorización explícita del usuario.**
- `DATABASE_URL` en `.env` apunta a la **base LOCAL** (`localhost:5432`, docker).
  La de producción vive en `PROD_DATABASE_URL` (Railway) — NO usarla para dev.
- Prisma CLI lee `.env` (no `.env.local`), por eso la URL local va en `.env`.
- Scripts sueltos en la raíz (`update_*.js`, `revert_inactive.js`, etc.) pueden
  ESCRIBIR en la base. No ejecutarlos sin confirmar contra qué base apuntan.
- El `.env` tiene secretos reales (Payway, JWT, Meta, credenciales Google). Está
  gitignoreado — mantenerlo así, nunca commitearlo ni imprimir sus valores.

## Flujo de trabajo
```
LOCAL (localhost:3000, base local) → rama `desarrollo` → testear → merge a `main` → push → Railway despliega
```
- Rama de trabajo: **`desarrollo`**. Producción se despliega desde **`main`** (Railway auto-deploy).
- Solo mergear a `main` cuando está testeado en local.

## Comandos
- `npm run dev` — levanta localhost:3000 (usa base local)
- `docker compose up -d db` — levanta Postgres local (contenedor `atelier-postgres`, puerto 5432)
- `npx prisma migrate status` — estado de migraciones
- `npx prisma migrate deploy` — aplica migraciones pendientes (a la base local)
- `npx prisma generate` — regenera el cliente
- `npm run lint` / `npm run build` — lint y build de producción

## Base de datos local (docker)
- Contenedor: `atelier-postgres` — `postgresql://postgres:localpassword@localhost:5432/atelier`
- Inspeccionar: `docker exec atelier-postgres psql -U postgres -d atelier -c "\dt"`
- Si una migración falla por "column already exists" (drift): verificar que la
  columna exista y marcarla con `npx prisma migrate resolve --applied <nombre>`.

## Pendientes / notas
- Token de GitHub en texto plano en `.git/config` (remote origin) — conviene rotar
  y pasar a credential helper.
- ~40 ramas locales `subagent-*` (restos de corridas viejas) — se pueden borrar.
- Muchos scripts one-off en la raíz — conviene mover a `scripts/` o borrar.
