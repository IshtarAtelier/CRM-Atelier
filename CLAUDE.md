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
- **La verdad es `origin/main`, nunca el `main` local.** El 28/7 el main local
  estaba 191 commits atrás de producción (cicatriz de sesiones cruzadas; el
  estado viejo quedó en `backup/main-local-28jul`). Antes de armar un deploy:
  `git fetch origin` y construir SIEMPRE sobre `origin/main`. Qué falta deployar
  se mide con `git cherry -v origin/main`.

## 🔴 Una sesión a la vez (IMPORTANTE)
El daño más caro de este proyecto no fueron bugs: fue trabajo perdido por dos
sesiones editando la misma carpeta. Los stashes `estado-parcial-mezclado-NO-USAR`
y `wip-otra-sesion` son la cicatriz.
- **Una sola sesión tocando `proyectos/atelier` por vez.** Para trabajar en
  paralelo, `git worktree add` en otra carpeta — nunca dos sesiones acá.
- **Un solo `npm run dev` prendido.** Varios en puertos distintos generan
  `.next-<nombre>` que después ensucian el `tsconfig.json`.
- **Commitear seguido, sin preguntar.** Commit no publica. Lo no commiteado es
  lo único que se pierde cuando otra sesión hace checkout o stash.
- Al abrir sesión: `git status && git stash list && git worktree list`. Si hay
  trabajo ajeno sin guardar, commitearlo ANTES de tocar nada.
- Al cerrar un worktree: `git worktree remove` — la rama y sus commits sobreviven,
  solo se va la carpeta. Lo único en riesgo es lo no commiteado.
- Push a `main`, merge y deploy: **solo con OK explícito del usuario.**

## Dónde va cada cosa
- `src/` — la app. Nada temporal acá.
- `scripts/checks/` — scripts de auditoría y diagnóstico (solo leen).
- `scripts/maintenance/` — scripts que escriben en la base. Nombre explícito.
- `docs/` — documentación (runbooks, pasos de deploy, notas de lanzamiento).
- `prisma/`, `wa-service/` — schema y bot de WhatsApp.
- **La raíz es solo configuración.** Nada de `*.tmp.js`, `probe*.mjs`, `dump*.mjs`
  ni scripts de un rato. Si sirve, va a `scripts/` con nombre que diga qué hace;
  si no sirve, se borra.

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

## 🔴 Reglas de negocio que el código no dice
Cada una nació de un dato mal calculado en producción. No deducirlas del código.
- **Los costos de cristales son POR PAR**: `item.eye ? cost / 2 : cost`. Grupo
  Óptico factura por línea, nunca el total del comprobante.
- **El saldo NUNCA es lista − cobrado.** Hay que convertir cada pago a su
  equivalente de lista; la resta directa inventó 76 saldos fantasma en prod.
- **Un cobro de más no redefine el precio de la venta.** Nada debe pisar
  `total` / `subtotalWithMarkup` con lo pagado.
- **`Order.paid` NO prueba que se haya cobrado.** La venta real se mide por filas
  de `Payment` o por `labStatus`. Hay filas con `paid` y cero pagos.
- **Vendedor de una venta = quien la envió a fábrica** (`labSentBy`).
- **Nombres de la tienda = estelar + color.** La marca (ej. Cápsula Escarlata) va
  en el campo marca, nunca en el nombre.
- **Fechas visibles en dd/MM/yyyy** vía `src/lib/format-date.ts`. No tocar el ISO interno.
- **Links en mails y notificaciones**: `/admin/ventas?id=` (nunca `?orderId=`).
  Lo que ve el cliente sale de `STORE_ORIGIN`.
- **Un comprobante trae VARIOS identificadores** (Mercado Pago tiene nº de
  operación Y código de identificación). Comparar contra uno solo acusa en falso.
- **Importe repetido al centavo no es doble facturación** — suele ser el mismo
  cristal a precio de lista.

## Arquitectura: cómo se agrega código sin pudrir el sistema
Reglas para que el proyecto escale sin volverse un mazacote.
- **La lógica de negocio vive en `src/services/`, no en las rutas.** Una ruta API
  valida, llama al service y responde. Si una ruta tiene un `prisma.` con lógica
  de negocio adentro, está mal ubicada.
- **Cálculo de plata: SOLO en `PricingService`.** Prohibido re-implementar
  totales, saldos o markups en un componente o ruta — cada copia divergió alguna
  vez y costó plata real.
- **Un dato que se muestra en más de un lugar se arma en UN helper de `src/lib/`**
  y todas las pantallas leen de ahí (patrón `lab-frame-summary.ts`: ficha, venta
  y PDF muestran lo mismo porque lo calcula un solo lugar). Si vas a copiar un
  bloque de JSX/lógica a una segunda pantalla, frená y extraé el helper.
- **Componentes compartidos en `src/components/<dominio>/`**; un componente que
  solo usa una página vive junto a esa página.
- **Constantes con nombre en `src/lib/constants/`** — nada de números mágicos ni
  strings repetidos (teléfonos, cutoffs, orígenes: ya viven ahí).
- **Toda integración externa (SmartLab, Payway, Meta, Resend, AFIP) se toca a
  través de su service** — nunca `fetch` directo desde una ruta o componente.
- **Schema Prisma**: todo campo nuevo llega por migración commiteada, nunca
  editando la DB a mano. Borrar columnas: primero dejar de leerlas en el código,
  deploy, y recién después la migración que las borra (el deploy viejo sigue
  corriendo durante el rollout).
- **Errores**: las páginas públicas usan `rethrowUnlessBuild` (`db-guard.ts`);
  el bot nunca muestra errores al cliente (calla y reintenta); los crons avisan
  por email, no autocorrigen.

## Higiene del repo (mantenerlo sin basura)
- **Ramas**: borrar la rama local después de que su trabajo llegue a `origin/main`
  (`git branch -d` avisa solo si falta algo). Objetivo: <10 ramas vivas. Las
  `backup/*` y `rescate/*` tienen fecha en el nombre o en el commit — pasados
  30 días sin reclamos, pedir OK y borrarlas.
- **Un experimento que no va a ninguna parte se borra**, no se stashea. El stash
  es para interrupciones de minutos, no almacenamiento — si vale, commit en una
  rama con nombre; si no, se tira.
- **Nada de archivos generados en git**: `.next*`, `tsconfig.tsbuildinfo`,
  dumps de DB, `node_modules`. Si aparece uno nuevo recurrente, va al `.gitignore`.
- **Los datos/entregables pesados** (JSON de fichas, listas de precios, PDFs de
  labs) van en `scripts/maintenance/<tema>/` con un README que diga qué son y
  cómo se aplican — nunca sueltos.
- **Los snapshots de `src/data/snapshots/` NO se commitean desde la base local.**
  Son el último recurso que sirve la tienda si producción no responde, y el build
  los regenera contra la base que vea. Un `npm run build` local los sobreescribía
  con el catálogo de docker (desincronizado). Ya hay una guarda en el script que
  se niega a escribir desde localhost — si aparecen modificados en `git status`,
  descartarlos con `git checkout -- src/data/snapshots/`.
- **Auditoría mensual** (o cuando algo se sienta sucio): `git status`,
  `git stash list`, `git worktree list`, `git branch -vv`, ramas mergeadas
  (`git branch --merged origin/main`), y tamaño de la carpeta. Todo lo que no se
  pueda explicar en una frase, se investiga o se borra.
- **Scripts one-off**: si se corrió una vez y no se va a repetir, se borra tras
  commitear el resultado. Si se puede repetir, nombre descriptivo + comentario
  de qué hace y contra qué base pega.

## Trampas conocidas
- **`npx prisma generate` SIEMPRE desde `atelier/`.** Corrido desde otra carpeta,
  toda ficha de cliente tira 500.
- **Prisma contra producción exige `select` explícito**, también en los `update`:
  el schema local está adelantado y devolver la fila entera revienta.
- **El 404 de una ficha de producto inexistente es a propósito.** No "arreglarlo".
- Una ruta que hace 404 o redirige no puede tener `loading.tsx` (soft-404 en Google).
- El horario que responde el bot vive en `SystemSetting.bot_prompt`, no en el
  código. Tocar los prompts y deployar NO cambia lo que contesta.
- Qué falta deployar se mide con `git cherry -v origin/main`, no contra el `main` local.

## Pendientes / notas
- Token de GitHub en texto plano en `.git/config` (remote origin) — conviene rotar
  y pasar a credential helper.
- Contraseña de la base de PRODUCCIÓN hardcodeada en `scripts/utils/` — rotar en Railway.
- Ramas `rescate/*`: son 3 stashes viejos convertidos en ramas para que no se
  pierdan. Revisar qué sobrevive y borrarlas.
- Queda 1 rama `subagent-*` sin mergear (`Unused-Code---Dependency-Cleaner`) —
  revisar antes de borrar con `-D`.
