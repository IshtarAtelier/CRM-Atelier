# Módulo Optovisión (Essilor / Varilux / Kodak / Crizal) — plan y estado

Rama `feat/optovision-modulo` (worktree `../atelier-optovision`, sobre `origin/main`).
Referencia: marco `src/services/lab-modules/` (Grupo Óptico, Vitolen), `docs/lab-modulos.md` § Optovisión,
relevamiento del portal en `docs/oves-portal.md`.

## Alcance (Ishtar, 16/10/2026)

**Solo la carga asistida.** El seguimiento y los costos siguen por la factura
(`lab-recon`): costos por IMAP, aviso de "corroborar" a los 5 días hábiles.
Operatoria idéntica a GO y Vitolen: el robot arma el pedido, muestra la
pantalla real del portal y una persona aprueba; botón "🤖 Hacé lo tuyo" en
Ventas y el mismo bloque `CargaLaboratorio` en la ficha.

## Lo que se sabe

- **Volumen** (producción, 90 días al 15/10): GO 150 ventas / Optovisión 39 /
  Cámara 5 / Vitolen 1. Por mes (Optovisión): jun 5 · jul 8 · ago 12 · sep 19 ·
  oct 1, con 71 presupuestos de octubre sin cerrar (pregunta abierta: ¿por qué?).
  **29 de las 39 ventas de 13 meses son promos.**
- **Catálogo CRM**: 235 cristales (Varilux 48, Essilor 59, Kodak 44 + 8 "Mi primer",
  Sygnus 45, Optovisión 55). `LaboratoryConfig`: calibrado $23.000, IVA 21.
- **Nº de pedido**: 6 dígitos (nº web de OVES), uno por par; la venta los guarda
  con separadores sueltos (`626134 -  626139`). El NRO RX de 7 dígitos
  (`TI-7104272`) es el de la factura. Hay 3 ventas con el campo vacío.
- **Costos hoy (IMAP/PDF)**: 112 `LabCostEntry` (7 OK, 17 OVERCOST, 67 UNDERCOST, 16 UNMATCHED, 4 PENDING).
- **Gmail**: `procesos@optovisionsa.com.ar` manda `FA_3008-…pdf`; `procesos@essilor.com.ar`,
  comprobantes electrónicos y el resumen de cuenta. No hay mails de confirmación
  de pedido ni de estado: el seguimiento solo podría salir de OVES.
- **OVES por dentro**: `docs/oves-portal.md` (relevado el 19/10/2026 desde el
  Chrome de Ishtar; catálogo de 685 productos verificado byte a byte).
- **Red**: desde la Mac de Ishtar y desde Anthropic el servidor (`200.80.42.219`)
  no contesta en 443/80 durante 3 días y con 2 IPs; desde el celular y el Chrome
  con extensión sí. Riesgo para el robot en Railway.

## Etapas

| # | Etapa | Estado |
|---|---|---|
| 0 | Relevamiento de OVES | **Hecho** 19/10 |
| 1–2 | Seguimiento y costos por portal | Fuera de alcance (siguen por la factura) |
| 3 | Carga asistida (`lab-modules/optovision/`, ficha, botón, `check:carga-optovision`) | **Escrita** 19/10, sin probar contra el portal real |
| 3b | Promo: cupón + observaciones + mail a promociones@ (cc cordoba@ y el local) | **Escrita**; el código del asunto es `OVES_USER` |
| 3c | Cupón automático: el robot lo genera en la web de la promo al aprobar el 1er par (`cupon-web.ts`, `cupon-robot.ts`, `docs/promos-optovision-web.md`) | **Escrita y auditada** 20/10 (3 vueltas, la 3ª dejó solo low), sin probar contra el sitio real: faltan `PROMO_VARILUX_*` en el entorno |
| 4 | Auditorías (arquitectura + robustez) hasta que quede solo low | **Hecho** 20/10: 4 vueltas, 3 de arreglos (commits d2df0b37, 57486b1b, 32ae0841, 2affdb0e); la 4ª dejó solo low |
| 5 | Prueba real con credenciales en `.env` → deploy (push a `main` solo con OK explícito) | Pendiente |

Corrida contra la copia de producción (39 ventas, 68 pares, 13 meses): 50
pares se arman, 6 van a mano con motivo (Stellest, HD MR7, nombres
archivados), 12 frenan por datos reales de la venta (altura del 2º armazón,
medidas del armazón, color del Transitions).

## Decisiones abiertas (Ishtar)

1. ~~Liso → Blue UV~~ **Resuelto 22/10**: Comfort, Comfort Max, Physio y Physio 3.0 no tienen versión blanca (liso) en OVES ni en la web de la promo; el equipo siempre los cargó con Blue UV (11 pedidos reales consultados en OVES) y el robot hace lo mismo, con aviso. Donde el blanco existe (XR Design/Pro) carga el blanco. Fijado en `check:carga-optovision`.
2. ~~Código de vendedor~~ **Resuelto 20/10**: el código del asunto es el usuario de OVES (`OVES_USER`, ATEL01). El robot manda el mail en producción cuando los pares están cargados.
3. ~~"Mi Primer" ¿lleva mail?~~ **Resuelto 20/10** (recordatorio de Optovisión): misma modalidad; el robot manda el mail con el único nº de trabajo.
4. **Credenciales**: `OVES_USER` / `OVES_PASSWORD` y `PROMO_VARILUX_USER` /
   `PROMO_VARILUX_PASSWORD` (la cuenta `atelier.optica.cerro@` de las webs de
   promo; las de Kodak son opcionales, caen a las de Varilux) en Railway y en el
   `.env` local para la prueba (las carga Ishtar; Claude no tipea claves). La
   clave de OVES pegada en el chat del 15/10 conviene cambiarla.
5. **Railway → OVES**: comprobar que llega, o pedirle a Optovisión que habilite la IP.
6. Los 5 commits de `feat/grupo-optico-carga` siguen esperando OK de push.
7. El corte de ventas de Optovisión en octubre.

## Restricción de diseño: OVES es un sistema viejo y lento (Ishtar, 16/10/2026)

Todo timeout del módulo es ANCHO (30 min por paso, `ESPERA_OVES_MS`), igual
criterio que Grupo Óptico: una pasada lenta que termina vale más que una
rápida que aborta. Reintentos pacientes, sin bajar los techos "para que el log
quede corto". El turno del portal (`portal/turno.ts`) garantiza un solo robot
a la vez.
