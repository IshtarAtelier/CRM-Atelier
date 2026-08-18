# WhatsApp API oficial — scripts de la migración

Acompañan a `docs/plan-whatsapp-api-oficial.md`. Todos leen `.env` de la raíz
(`WA_SERVER_URL`, `BOT_API_KEY`, `DATABASE_URL`) y **por defecto no escriben**:
hay que pasar `--apply` para que hagan algo.

| Script | Qué hace | Contra qué pega |
|---|---|---|
| `crear-plantillas.ts` | Da de alta en Meta las plantillas del catálogo `src/lib/whatsapp/templates.ts` (las que falten). Sin `--apply` solo muestra el JSON que mandaría. Con `--solo nombre` una sola. | wa-service `/api/templates` (que a su vez pega a Graph). Necesita `WA_TRANSPORT=cloud` y `WA_CLOUD_WABA_ID` en el bot. |
| `estado-plantillas.ts` | Sincroniza y lista el estado de las plantillas (APPROVED / PENDING / REJECTED) y las que faltan del catálogo. Solo lee. | wa-service `/api/templates/sync` |
| `migrar-waid-e164.mjs` | Pasa `WhatsAppChat.waId` de `<num>@c.us` a E.164 (`<num>`); los `@lid` se resuelven por `realPhone` / teléfono de la ficha, y los que no se puedan quedan listados y **archivados**, nunca borrados. Sin `--apply` es dry-run. | la base que diga `DATABASE_URL` (por defecto la LOCAL). Para producción hay que pasar `--prod` y tener OK explícito. |

Orden: primero `estado-plantillas` (para ver qué hay), después `crear-plantillas
--apply` de a una o dos por vez (Meta mira ráfagas), y `migrar-waid-e164` recién
en la Fase 4, después de que el número esté en la API.

Ejemplos:

```bash
npx tsx scripts/maintenance/whatsapp-api-oficial/estado-plantillas.ts
npx tsx scripts/maintenance/whatsapp-api-oficial/crear-plantillas.ts --solo pedido_listo --apply
node scripts/maintenance/whatsapp-api-oficial/migrar-waid-e164.mjs            # dry-run local
node scripts/maintenance/whatsapp-api-oficial/migrar-waid-e164.mjs --prod --apply   # solo con OK
```
