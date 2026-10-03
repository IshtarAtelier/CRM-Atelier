# Módulos de laboratorio

Un módulo por laboratorio, todos con la misma forma (`src/services/lab-modules`).
Nació el 30/9/2026 con Vitolen (Hoya + Pentax). Optovisión y Grupo Óptico siguen
con sus integraciones de siempre y se migran al marco cuando convenga: el marco
no las toca.

## Qué hace un módulo

| Capacidad | Qué es | Quién la dispara |
|---|---|---|
| **Seguimiento** | Entra al portal, lee TODOS los pedidos de una vez, los refleja en `LabPortalOrder` y mueve la venta: `IN_PROGRESS` cuando el lab lo recibió, `FINISHED` cuando todos los pares terminaron (con el aviso "pedido listo"). Si el portal da el nº de pedido y la venta tiene uno provisorio, lo escribe. | El tick de 10 min (`/api/cron/lab-modulos`), 8 a 20 h |
| **Costos** | Lee comprobantes y los registra en el cruce (`upsertEntry`), igual que Optovisión y Grupo Óptico. | La diaria de las 8:30 (`/api/cron/lab-invoices`), vía `LAB_PROVIDERS` |
| **Carga asistida** | Arma el pedido desde la venta, lo llena en el portal hasta la pantalla de resumen, saca una captura y **frena**. Una persona aprueba mirando la captura. Recién ahí el robot confirma y escribe el nº de pedido en la venta. | Desde la venta, en /admin/pedidos |

**El OK de la carga lo da siempre una persona** (regla de Ishtar, 30/9/2026).
El robot nunca confirma un pedido que nadie miró.

## Las piezas compartidas

- `contrato.ts` — la forma de todo módulo y los tipos normalizados (`PedidoEnPortal`, `EstadoEnPortal`).
- `registro.ts` — `REGISTRO_MODULOS`. Sumar un laboratorio = agregar su módulo acá.
- `portal/navegador.ts` — un solo lanzador de Chromium (con el `PLAYWRIGHT_BROWSERS_PATH` que le faltó a SmartLab 14 días) y la espera del login por resultado, que distingue "clave rechazada" de "portal lento".
- `portal/turno.ts` — una pasada a la vez por portal, con vencimiento. La diaria espera a un pase rápido; nadie espera a una completa.
- `portal/salud.ts` — última corrida buena, corte desde cuándo, alerta a las 12 h con enfriamiento de 12 h; credencial rechazada avisa en el acto; "restablecido" solo si se había alertado.
- `espejo.ts` — `LabPortalOrder` y la vinculación pedido ↔ venta: por nº de pedido, por el código corto de la venta (`#A1B2`) o por nombre del cliente, **solo si la llave da una única venta**.
- `estados.ts` — la única función que mueve una venta desde un portal. Nunca baja un estado, nunca toca READY/DELIVERED (los pone una persona), no afirma nada sobre un estado que no entendió.
- `carga/borrador.ts` — `LabOrderDraft`: PREPARADO → EN_REVISION → APROBADO → CARGADO (o RECHAZADO / ERROR). Aprueba solo una persona identificada.
- `corrida.ts` — una corrida de seguimiento con turno, salud y avisos. Los avisos van a `PRIVATE_ADMIN_EMAILS`, una vez por día y por conjunto. Un módulo puede declarar `cadenciaRapidaMin` (Vitolen: 30): el tick sigue siendo cada 10 min, pero el pase rápido se saltea mientras la última corrida buena sea más reciente que eso — un portal con pocos pedidos no necesita 70 logins por día.

Toda escritura del robot queda en el historial del cliente y en el AuditLog
con el nombre `Robot <laboratorio>`.

## Avisos que solo existen gracias al espejo

- **Venta enviada sin pedido en el portal**: marcada "enviada" en el CRM, pero el lab no tiene un pedido con su número ni con su código pasado un día. O no se cargó, o se cargó sin identificar la venta.
- **Pedido atrasado**: la fecha estimada del laboratorio venció y no está terminado.

## Vitolen

- Portal: `gestion.vitolen.com`. Credenciales: `VITOLEN_USER` / `VITOLEN_PASSWORD` (Railway y `.env`; nunca en el código). Sin ellas el módulo avisa en el acto como si la clave estuviera rechazada.
- **Todo lo que el robot sabe del portal** (login, listado y sus filtros, estados reales, detalle, cuenta corriente, nombres de los campos del formulario, ids de diseños y materiales): `docs/vitolen-portal.md`. Si el portal cambia, primero se corrige ahí.
- Cómo se carga un pedido a mano y las promos: `docs/vitolen-pedidos-y-promos.md`.
- Módulo (`lab-modules/vitolen/`): `portal.ts` (sesión; las páginas se piden desde adentro del navegador porque el certificado viene sin la cadena intermedia), `pedidos.ts` (parseo puro del listado JS), `estados.ts` (Confirmación → INGRESADO, En Proceso / Tránsito a OF → EN_PROCESO, En Oficina → TERMINADO, Despachado → DESPACHADO), `modulo.ts` (seguimiento; costos y carga apagados hasta su etapa).
- Carga asistida: `materiales.ts` elige **por texto** la opción del portal para cada cristal del CRM (`portal-materiales.ts` es el relevamiento de los 10 diseños Progresivo con sus ids; un cristal cuyo diseño no está relevado —Nulux, Sync, Tact, Visión Simple, Pentax— no se prepara y se dice). `carga.ts` deja en el payload el logo (`portalDiseno`) y la opción exacta (`portalMaterial`) que se van a marcar, así la persona revisa eso mismo. `llenar.ts` escribe el formulario campo por campo (comprueba que el texto de cada opción sea el esperado: un cambio de ids en el portal corta ahí) y aprieta **"Crear"**, que en Vitolen crea un **borrador sin confirmar** con id propio y muestra su resumen (comprobado el 3/10/2026 con un pedido de prueba). `borrador-portal.ts` guarda la captura de ese resumen y deja el borrador del CRM EN_REVISION; al **aprobar**, el robot aprieta "Confirmar" en el portal, lee el nº de trabajo, lo escribe en la venta (`aplicarEstadoEnVenta`) y el borrador pasa a CARGADO; al **rechazar**, aprieta "Cancelar" (si no puede, lo anota para hacerlo a mano). Lo que el CRM no guarda lo pone quien prepara: la forma (1‑12) y el eje de la diagonal mayor (0‑180). La promo del 2º par se asocia a mano con "Modificar" en el portal antes de aprobar (decisión de Ishtar, 3/10/2026).
- Ensayado el 3/10/2026 contra el portal real con la base local: 7 pedidos históricos de 2024 al espejo, ninguno vinculado, ninguna venta tocada; pase rápido 3 s, completa 4 s.
- Costos (`modulo.ts: recolectarCostos`, lo dispara la diaria de las 8:30 vía `LAB_PROVIDERS`, con el turno del portal): el listado de 90 días, la cuenta corriente (`cuenta-corriente.ts`: qué facturas anuló una nota de crédito) y, por cada pedido, el PDF `facturacion_automatica.pdf?codigo=<nº sin L>00` con TODAS sus facturas (`pdf.ts` + `comprobantes.ts`, puro). Cada pedido entra al cruce con la suma de los TOTALES de sus facturas vigentes del MISMO pedido (Factura A: Atelier es monotributo y el IVA es costo; `LABS_FACTURA_A` en `cost-matching.ts`), con `invoiceRefs` y link; sin facturas queda "esperando factura". Está en `BACKFILL_LABS`: el primer barrido en producción es silencioso.
- Catálogo con códigos del portal: `lab-modules/vitolen/catalogo.ts`, GENERADO desde la lista L96 con `node scripts/maintenance/precios-vitolen/generar-catalogo-ts.mjs`. No se edita a mano.
- El vendedor pone el **código corto de la venta** (`#A1B2`, el que muestra el CRM) en "Nro de Caso Interno" del portal: es lo que permite vincular sin tipear el nº de pedido.

## Verificación

- `npm run check:lab-modulos` (CI, sin base ni red): turno, salud, transiciones de venta, vinculación, alertas, máquina de estados de la carga.
- En local con `CRONS_LOCALES=1` el tick llama al cron; sin credenciales el módulo avisa "credencial" y no rompe nada.
