# Módulo Optovisión (Essilor / Varilux / Kodak / Crizal) — plan por etapas

Estado al 15/10/2026. Rama `feat/optovision-modulo` (worktree `../atelier-optovision`).
Referencia: marco `src/services/lab-modules/` (Grupo Óptico, Vitolen), `docs/lab-modulos.md`.

## 1. Lo que ya se sabe

**Volumen (producción, solo lectura, ventas con cristal enviadas a fábrica, 90 días):**
Grupo Óptico 150 ventas / 352 cristales · **Optovisión 39 / 136** · Cámara 5 · Vitolen 1.
Por mes (Optovisión): jun 5 · jul 8 · ago 12 · sep 19 · **oct 1** (al 15/10).
Presupuestos de octubre con cristal Optovisión sin enviar a fábrica: **71** (GO: 190).
→ Hay que entender el corte de octubre antes de decidir la prioridad (ver §4).

**Catálogo:** 235 cristales (Varilux 48, Essilor 59, Kodak 44+8 "Mi primer…",
Sygnus 45, Optovisión 55). `LaboratoryConfig`: calibrado $23.000, IVA 21.

**Nº de pedido: no hay formato único.** Casi siempre dos nº de 6 dígitos (uno por
par) con separadores sueltos (`626134 -  626139`); también 7 dígitos (serie
TM/TI, `3581795`), 8 dígitos (`80527352`), textos (`3578631 - Ficha`) y vacíos.
El módulo debe guardar el nº que devuelve OVES, normalizado, uno por par.

**Costos hoy (por mail, IMAP/PDF):** 112 `LabCostEntry` (7 OK, 17 OVERCOST,
67 UNDERCOST, 16 UNMATCHED, 4 PENDING).

**Gmail (60 días), lo que manda el proveedor:**
- `procesos@optovisionsa.com.ar` → `FA_3008-000xxxxx.pdf`, una por comprobante.
- `procesos@essilor.com.ar` → "Comprobante electrónico" y el resumen de cuenta
  semanal (cuenta 123870).
- **No hay mail de confirmación de pedido ni de cambio de estado.** El seguimiento
  solo puede salir del portal OVES.

**Código existente:** `lab-recon/imap.ts`, `lab-providers/essilor-statement.ts`,
`optovision-parser.service.ts`, `optovision-audit.service.ts`,
`lab-recon/cost-matching.ts`; identidad en `lib/laboratorios/identidad.ts`
(`OPTOVISION` ya es `LabKey`, falta sumarlo a `LABS_CON_CARGA_ASISTIDA`).

## 2. Qué falta saber (relevamiento de OVES — lo hace Ishtar logueada)

La clave la tipea Ishtar en su Chrome; Claude solo mira, sin guardar ni confirmar.
Una ventana por sesión de OVES. Se documenta en `docs/oves-portal.md`:
pantallas, listado y estados de pedido, buscador (`bus_pedido` / `buscar_rx`),
formulario de carga campo por campo, comprobantes/cuenta corriente, peticiones
JSON si las hay, y si "guardar" crea algo (frenar y preguntar).

## 3. Etapas (OK de Ishtar en cada una)

| # | Etapa | Entrega | Depende de |
|---|---|---|---|
| 0 | Relevamiento OVES | `docs/oves-portal.md` | Ishtar logueada |
| 1 | Seguimiento por portal | `lab-modules/optovision/{portal,pedidos,modulo}.ts`, `LabPortalOrder`, estados → `estados.ts`, salud/turno del marco, registro | E0; credenciales en Railway (entorno) |
| 2 | Costos por portal | comprobantes y cuenta corriente del portal al cruce; el IMAP queda de respaldo; sin tercer mail (regla 25/9) | E1 |
| 3 | Carga asistida | `carga-asistida`, `borrador-portal`, `llenar`; `CargaLaboratorio` y "🤖 Hacé lo tuyo" con `LABS_CON_CARGA_ASISTIDA`; OK humano antes de confirmar | E1; E0 del formulario |
| 3b | Promos | los 4 pasos: cupón en la web de la promo, mail a promociones@ y cordoba@, observación en el 1º par con el cupón, observación en el 2º con el nº del 1º. Si un paso no se puede automatizar, el módulo frena y lo dice | E3 |
| 4 | Auditorías | loop arquitectura + robustez hasta que quede solo low; `check:*` nuevo sin red | cada etapa |
| 5 | Deploy | push a `main` solo con OK explícito; verificar workflow y `desarrollo` | E4 |

## 4. Decisiones abiertas (Ishtar)

1. ¿Por qué casi no hay ventas de Optovisión desde el 30/9? (precios/promos hacia GO,
   stock, ventas sin cerrar). Cambia el orden: si el volumen no vuelve, el valor
   mayor está en E2 (costos) y no en E3.
2. Credenciales de OVES: variables de entorno en Railway; ninguna en archivos.
   (La clave pegada en el chat el 15/10 queda en ese historial: conviene cambiarla.)
3. Promos: ¿el robot puede mandar los mails a promociones@/cordoba@ o los manda una persona?
4. Los 5 commits de `feat/grupo-optico-carga` siguen sin subir: esperan OK.
