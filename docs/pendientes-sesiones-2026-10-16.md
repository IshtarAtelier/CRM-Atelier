# Pendientes de otras sesiones — inventario del 16/10/2026

Relevado al cerrar la sesión del arreglo de Vitolen. Ningún worktree tenía
cambios sin commitear. Se cerraron 13 worktrees cuyo trabajo ya estaba en
producción y se borraron 20 ramas locales ya mergeadas (quedan 70).

## A. Trabajo reciente SIN deploy (decidir qué se sube)
Cada rama vive en su worktree (`proyectos/atelier-<nombre>`), commiteada.

| Rama | Commits reales | Último | Qué es |
|---|---|---|---|
| feat/novedad-solicitar-factura (esta carpeta) | 7 | 16/10 | Desafío de reseñas para Matías, robot que confirma reseñas en Google, specs Kazwini, docs, helper comprobante-vs-forma-de-pago (sin conectar) |
| feat/lab-permisos-y-anulados | 1 | 16/10 | Solo Milena y admin procesan laboratorio; cambiar un nº pide motivo |
| feat/optovision-modulo | 3 | 16/10 | Plan y alcance del 3er módulo de laboratorio (solo carga asistida) |
| feat/feed-modelos | 2 | 16/10 | Carrusel diario alternando Agostina y Massaru |
| feat/rostro-segunda-foto | 2 | 16/10 | Tienda en celular: tarjeta central; 2ª foto de cada ficha |
| feat/blog-marcas-cristales | 1 | 16/10 | Notas Hoya y Pentax con fotos oficiales |
| feat/feed-obras-de-arte | 1 | 16/10 | Reel "cine: detrás de tu cristal" (scripts; los videos, 203 MB, fuera de git) |
| feat/creatividades-ficha-google | 8 | 10/10 | Placas y captions para la ficha de Google, Stellest |
| fix/alertas-credito-ia | 2 | 8/10 | Aviso del 402 del prepago; gastos Gemini/Railway/WhatsApp desde recibos |
| fix/audios-transcripcion | 1 | 8/10 | WhatsApp: audios entrantes guardados transcritos |
| feat/aviso-precios-viejos | 1 | 5/10 | Presupuestos con precios viejos: aviso y candado |
| fix/plantilla-resenas | 1 | 5/10 | Pedido de reseña: un solo armado del mensaje |
| feat/cobro-saldos | 7 | 29/9 | Cuadro de saldos, cierre con descuento especial, recordatorio semanal |
| feat/google-conversiones-offline | 9 | 25/9 | Google Ads: negativas, sitelinks, auto-aplicar, tablero WhatsApp |
| feat/gastos-mercadopago | 5 | 25/9 | Gastos: comisión MP del mes; saldos un mail por semana |
| feat/placas-cupon-rediseno | 2 | 25/9 | Placas del cupón rediseñadas (Ishtar las aprobó así, ver memoria) |
| atelier-integracion (HEAD suelto, sin rama) | 16 | 25/9 | Fichas renombradas redirigen, agotados, auditoría tienda rondas 1-2. Ponerle rama antes de tocar nada. |
| deploy/bot-recetas (atelier-auditoria) | 1 | 25/9 | Solo un "rescate" de fotos y piezas sin commitear |

## B. Ramas viejas sin worktree (julio–agosto) con commits que nunca llegaron
Probablemente superadas. Pedir OK y borrar con `-D`; si alguna importa, se revisa antes.
subagent-Unused-Code-Dependency-Cleaner (16/6) · hotfix/payway-debito · feat/mayorista-catalogo-preview (24) · feat/resend · feat/tienda-profesional-medible (19) · fix/pago-duplicado-nro-operacion (22) · claude/vibrant-boyd (29) · cotizador-rangos (32) · deploy-cotizador-rangos · activar-pixel-meta · auditoria-tienda-julio21 (12) · deploy/cupon-comprobantes · parte-laboratorio · seo-medicion-fixes · medicion-ads-conversion · voucher-varilux · voucher-varilux-limpio · auditor-diario · fix/catalogo-mayorista-privado · ads/estado-conjuntos · claude/keen-fermat (12) · fix/csp-google-ads · ui/whatsapp-cabecera · mercado-pago-respaldo · fix/regeneracion-permisos · fix/regeneracion-rebase · feat/narrar-video (12) · deploy/fix-vencimiento-cupon · feat/gastos-ads-diario · perf/lighthouse-accesibilidad (23) · deploy/tercer-armazon · fix/fichas-renombradas-redirigen (13, 25/9) · fix/lab-2x1-par-bonificado (11, 29/9) · rescate/oferta-web-metal-3oct2026 · deploy/factura-15oct · fix/tienda-15oct

## C. Respaldos y stashes (pasados 30 días: pedir OK y borrar)
- Stashes: `estado-parcial-mezclado-NO-USAR`, `mis-cupones-temp`, `wip-otra-sesion` (julio). Los tres ya existen como ramas `backup/stash-*` y `rescate/*`: el stash es redundante.
- Ramas backup/*: desarrollo-28jul2026, main-local-28jul, main-local-16sep-pre-sync, whatsapp-perf-inbox, wip-20260703, stash-0/1/2.
- rescate/*: cupones-temp, stash-mezclado-no-usar, wip-otra-sesion, multifocales-untracked-10ago.

## D. CI en `main` fallando
El pipeline "CI/CD Pipeline" falla desde hace 7 pushes por el check de tipo de
lente / seguimientos con fechas vencidas (`vencida: true`). Railway despliega
igual, pero el CI dejó de servir de alarma. Arreglar el check.
