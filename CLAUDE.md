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

## Trazabilidad de actor
Toda mutación de negocio debe quedar firmada con quién la hizo — ficha del cliente,
AuditLog y emails/WhatsApp que la mencionen.
- El middleware (`src/middleware.ts`) valida el JWT de la cookie `session` y
  reinyecta `x-user-id` / `x-user-name` / `x-user-role` en TODA request API
  autenticada, sobrescribiendo lo que mande el cliente (son confiables). Leerlos
  SOLO con `getActor(request)` de `src/lib/actor.ts` — nunca a mano desde headers.
- Shape canónico para services NUEVOS: parámetro opcional final `actor?: Actor`
  (patrón de `contact.service.ts`). No inventar variantes nuevas — hoy conviven
  4 shapes distintas por deuda histórica (`Actor` tipado, `userId/userName`
  posicionales en `order.service.ts`, `actorId/actorName` sueltos en
  `billing.service.ts`, string armado en `copilot-tools.ts`); si tocás uno de
  esos archivos, migrar ese call site a `Actor` es bienvenido pero no obligatorio.
- Toda mutación de negocio: crea una `Interaction` firmada (`userId` + `userName`,
  y el nombre interpolado en `content`) y llama `logAudit()` aparte (nunca lanza,
  `src/lib/audit.ts`). Para borrados u otras mutaciones destructivas, `await`
  el `logAudit` (garantiza la fila commiteada antes de responder); para el resto,
  fire-and-forget con `.catch(console.error)` alcanza.
- Acciones sin humano detrás: usar `SYSTEM_ACTOR` / `BOT_ACTOR` de `actor.ts`
  (`'Sistema'` para crons/procesos automáticos, `'Bot'` para el bot de WhatsApp,
  `'Sistema (Payway)'` para pagos del checkout web).
- Extender `AuditAction` / `AuditEntityType` (`src/lib/audit.ts`) es agregar un
  valor al union type — la columna en Postgres es `String` plano, no requiere migración.
- Pendiente conocido: revalidación del JWT contra la DB (dura 24h; un usuario
  borrado o con rol degradado sigue operando con los permisos viejos hasta que
  expira). No resuelto — evaluar antes de cualquier cambio a la duración del token.

## Pendientes / notas
- Token de GitHub en texto plano en `.git/config` (remote origin) — conviene rotar
  y pasar a credential helper.
- ~40 ramas locales `subagent-*` (restos de corridas viejas) — se pueden borrar.
- Muchos scripts one-off en la raíz — conviene mover a `scripts/` o borrar.
