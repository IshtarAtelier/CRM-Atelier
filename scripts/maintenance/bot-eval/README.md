# bot-eval — Dataset de conversaciones reales para evaluar el bot de WhatsApp

Minado de la base de **producción en SOLO LECTURA** el 30/8/2026. Teléfonos
anonimizados (últimos 4 dígitos); se conservan nombres de pila y el texto de
los mensajes. **Uso interno.**

## Archivos

| Archivo | Qué es |
| --- | --- |
| `conversaciones-reales.json` | 264 conversaciones reales donde participó el Bot (excluye chats internos del equipo y pruebas). Cada una: `id`, `categoria`, `resumen` (el `chatSummary` del CRM), `turnos` (`quien`: cliente/bot/humano + texto + fecha) y `problemas_detectados` con fragmento textual. |
| `casos-de-prueba.json` | 40 casos destilados: mensaje de cliente + criterios que una respuesta perfecta debe cumplir según `src/lib/business-info.ts` (horarios L-V 8-20 / Sáb 9-17, 15% efectivo y transferencia, 3/6 sin interés, "hasta 12 cuotas con MP" sin mencionar el %, 2x1 multifocales, UN cambio de cristal, Factura B o C, Essilor). **Si cambia una regla de negocio, actualizar los criterios antes de evaluar.** |
| `minar-conversaciones.mjs` | Etapa 1 — pega a la base (solo lectura, `select` explícito). `--relevar` imprime volumen; `--extraer` emite los hilos crudos por stdout. |
| `categorizar-y-detectar.mjs` | Etapa 2 — sin base: lee el dump crudo, categoriza por intención (heurísticas por palabras clave), detecta fallas y escribe `conversaciones-reales.json`. |

## Cómo se regenera

```bash
cd /Users/ishtarpissano/proyectos/atelier
DATABASE_URL="$(grep '^PROD_DATABASE_URL=' .env | cut -d= -f2- | tr -d '"')" \
  node scripts/maintenance/bot-eval/minar-conversaciones.mjs --extraer > /tmp/dump-crudo.json
node scripts/maintenance/bot-eval/categorizar-y-detectar.mjs /tmp/dump-crudo.json
```

Solo consultas de lectura (count/groupBy/aggregate/findMany). No escribe nada
en ninguna base.

## Volumen minado (30/8/2026)

- 2.079 chats, 52.153 mensajes (20.723 entrantes / 31.430 salientes), del 10/4/2024 al 30/8/2026.
- 1.175 chats con 5+ mensajes entrantes; 1.355 con diálogo real (3+ entrantes y 2+ salientes).
- El bot firmó 1.484 salientes (`senderName = 'Bot'`); participó en 264 conversaciones con diálogo real.
- Distribución por categoría (las 1.355): multifocales 457, otro 177, receta/graduación 157, estado de pedido 138, armazón/sol 133, obra social 112, precio 106, reclamo 44, turno/visita 24, post-campaña 7.

## Top fallas del bot (frecuencia sobre 264 conversaciones)

1. **Repite el saludo / se re-presenta** (89): vuelve a saludar en el mismo hilo como si fuera la primera vez, incluso a mitad de conversación.
2. **Precio citado por el bot** (65, a revisar): cotiza montos concretos ("$1.346.599") — hay que verificar cada uno contra lista vigente; el riesgo de precio desactualizado es alto porque el precio queda escrito en el chat.
3. **Respuesta idéntica repetida** (30): manda dos veces exactamente el mismo texto — casi siempre el seguimiento comercial ("¿Pudiste revisar las opciones? ¿Te mando fotitos?"), que se percibe robótico e insistente.
4. **Horario incorrecto** (21): informó "L-V 9 a 13:30 y 16 a 19:30, Sáb 10 a 14" cuando el real es L-V 8 a 20 y Sáb 9 a 17. El horario vive en `SystemSetting.bot_prompt` — quedó desactualizado ahí.
5. **Ignora lo que el cliente ya dijo**: el cliente repite "tengo receta pero no a mano" o "quiero ver los precios" y el bot sigue su guion (maps, horarios) antes de responder lo pedido (conv-007 es el ejemplo canónico).
6. **Ráfaga de mensajes cortos**: 3-5 salientes seguidos por turno; en pantalla se siente metralleta de bot, no conversación.
7. **Descuento desactualizado** (1 detectado): "20% de descuento en cristales" — la promo vigente es 15%.
8. **Cierre que reabre**: ante un "gracias!" de cierre, contesta con otro bloque de opciones o re-invita, en lugar de cerrar corto.
9. **No consulta estado real del pedido**: en `estado_pedido` tiende a respuestas de cortesía sin verificar contra el CRM ni derivar con claridad.
10. **Presupuesto denso**: bloques largos con asteriscos, emojis y 4 formas de pago juntas; el formato "6 cuotas sin interés (total $X)" junto al contado con descuento confunde a clientes ("¿me cobran interés entonces?").

Notas: no se detectaron casos de "cliente pide humano y el bot insiste" (cuando alguien menciona al bot suele ya estar hablando un humano), y las alertas internas de falla del bot ("🚨 ALERTA: FALLA EN BOT") van al chat interno del equipo — ese chat y los de prueba quedan excluidos del dataset.

## Recomendaciones (resumen)

- Inyectar horarios/promos SIEMPRE desde `business-info.ts` en el prompt (`bot_prompt` tenía horarios viejos — corregirlo ya).
- Regla dura de una sola presentación por conversación y prohibición de re-saludar si hay mensajes en las últimas 48 h.
- Precios únicamente vía tool contra la lista vigente; sin tool, derivar.
- Estado de pedido: tool de consulta al CRM o derivación explícita, nunca cortesía vacía.
- Dedupe de seguimientos: no reenviar un texto ya enviado; variar y espaciar.
- Agrupar la respuesta en 1-2 mensajes por turno.
