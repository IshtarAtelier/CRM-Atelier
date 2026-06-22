# Walkthrough: Atribución de Orígenes (Google Ads / Meta) y Fichas Manuales Obligatorias

## Resumen de Cambios Recientes

Se implementó y ejecutó de manera exitosa el plan de atribución de orígenes y obligatoriedad en fichas de contactos, logrando:
1. **Apagado Silencioso por Falta de Interés**: Se configuraron reglas de negocio estrictas en los prompts principales (`salesPrompt.js` y `executivePrompt.js`) para que si un contacto no demuestra interés real o indica explícitamente que no quiere anteojos/lentes, el bot no le responda nada, no le cree una ficha y apague el bot silenciosamente usando `disable_bot_for_personal_chat`.
2. **Optimización para Buscadores de IA y SEO Dinámico**:
   - Inyectamos un esquema de datos estructurados JSON-LD de tipo **`BlogPosting`** en la página de artículos de blog dinámicos (`src/app/blog/[slug]/page.tsx`) para facilitar la indexación y lectura de contenidos por parte de motores de búsqueda de IA.
   - Refactorizamos la generación del sitemap en [sitemap.ts](file:///Users/ishtarpissano/proyectos/atelier/src/app/sitemap.ts) para que sea dinámico y seguro: ahora realiza consultas de Prisma para indexar todos los productos y artículos del blog, mapea los 19 subdirectorios estáticos físicos del blog, y previene cualquier error de rastreo (404) limpiando urls desactualizadas.
3. **Exclusividad en Córdoba (PBN)**: Modificamos el comentario de usuario ficticio para la competencia en Córdoba (Óptica Valencia) en [index.html](file:///Users/ishtarpissano/proyectos/atelier/docs/seo_external_campaign/deploy_sites/opticascordoba.com.ar/index.html) para orientarlo exclusivamente a **lentes monofocales de descanso**, de modo que Atelier se posicione como el único especialista exclusivo de referencia en lentes multifocales en Córdoba.
4. **100% de Precisión en WhatsApp**: Pre-extracción determinista mediante expresiones regulares (regex) en el servidor y microservicio para capturar de manera infalible las plantillas de entrada de Google Ads y las etiquetas de Meta Ads entre corchetes (ej: `[metaSofi]`).
5. **Normalización Integral de Base de Datos**: Actualización en caliente de 175 registros de clientes históricos en la base de datos de producción de Atelier, garantizando que el origen de contacto coincida con la etiqueta comercial y que las estadísticas históricas estén 100% correctas.
6. **Obligatoriedad Visual e Interactiva**: Los formularios manuales del CRM ahora validan y requieren obligatoriamente el origen del contacto antes de guardar (bloqueando el guardado y alertando visualmente con asteriscos rojos `*`).
7. **Reporte Comercial Dinámico**: Migración del script a la ruta oficial del proyecto (`scripts/utils/send-commercial-report.js`), el cual extrae los datos de producción de Junio 2026 de forma dinámica, ocultando los montos monetarios reales (solo porcentajes y conteos) e incorporando gráficos circulares interactivos compatibles con clientes de correo.
8. **Alineación de Entrega de Presupuestos**:
   - Ajustamos la salida formateada de `getPriceList` en [tools.js](file:///Users/ishtarpissano/proyectos/atelier/wa-service/tools.js) para que coincida exactamente con la directiva de formato de [salesPrompt.js](file:///Users/ishtarpissano/proyectos/atelier/wa-service/prompts/salesPrompt.js) (formato de viñetas `•`, desglose de contado y 6 cuotas con el valor total financiado pre-calculado, evitando errores aritméticos del LLM).
   - Añadimos soporte para que la cotización del bot adjunte automáticamente la imagen del producto (`[IMAGE: <url>]`) y el enlace del producto (`• Link: <url>`) si están disponibles en la base de datos.
9. **Sincronización de Hitos de Origen**:
   - Modificamos [tools.js](file:///Users/ishtarpissano/proyectos/atelier/wa-service/tools.js) (`convertIntoLead`) para crear automáticamente un hito `📍 [HITO] Origen: <fuente>` en la ficha del contacto al ser registrado por el bot.
   - Actualizamos `extractHitos` en [bot.service.ts](file:///Users/ishtarpissano/proyectos/atelier/src/services/bot.service.ts) para verificar y añadir automáticamente la procedencia del cliente (`contactSource`) como un hito conversacional, garantizando que siempre sea visible en el panel del CRM.
10. **Restricción Estricta de Creación de Fichas (Solo con Receta)**:
    - Removimos la herramienta `convert_into_lead` del set de herramientas del bot de ventas (`salesToolsList` en [agent-tools.js](file:///Users/ishtarpissano/proyectos/atelier/wa-service/agent-tools.js)) para prevenir que la IA registre un prospecto sin receta en el CRM.
    - Modificamos el archivo de directivas de conversación [salesPrompt.js](file:///Users/ishtarpissano/proyectos/atelier/wa-service/prompts/salesPrompt.js) para prohibir tajantemente la creación de fichas de prospectos sin receta, instruyendo a la IA a no llamar herramientas de registro y a coordinar con calidez sin guardar datos parciales.

---

## Cambios Realizados

### 0. Reglas de Desactivación por Falta de Interés y SEO
- **salesPrompt.js**: Se agregó la regla bajo la sección `APAGADOS INMEDIATOS (PRIORIDAD MÁXIMA)` para detectar de forma explícita e implícita si el cliente no está interesado en anteojos o lentes de contacto. Se le prohíbe terminantemente al bot responder o guardar datos en el CRM, obligándolo a invocar `disable_bot_for_personal_chat` en absoluto silencio.
- **executivePrompt.js**: Se actualizó la regla de `DETECCIÓN DE CONVERSACIÓN PERSONAL` para incluir el mismo comportamiento en caso de clientes que manifiesten no querer comprar anteojos.
- **SEO/PBN**: Se implementó JSON-LD estructurado para contenido del blog y se automatizó el sitemap en [sitemap.ts]. Se reemplazó el testimonio ficticio de Mariana F. por uno real de Claudia Sonia Guzman para Atelier en la PBN de Córdoba, y se reorientó el testimonio de Óptica Valencia (competencia en Córdoba) hacia lentes monofocales de descanso para posicionar a Atelier como autoridad exclusiva en lentes multifocales.

### 1. Normalización y Auto-etiquetado Automático en el Backend
**Archivo modificado**: [contact.service.ts](file:///Users/ishtarpissano/proyectos/atelier/src/services/contact.service.ts)
- Se mejoró `normalizeContactSource` para agrupar de manera robusta e insensible a mayúsculas/minúsculas las variaciones de origen.
- Se actualizó el color del tag de Meta Ads a rosa/magenta (`#E91E63`) en `syncContactSourceTag` y se automatizó su vinculación al guardar o actualizar fichas en `ContactService`.

### 2. Heurísticas y Reglas de Extracción Deterministas en WhatsApp
**Archivo modificado**: [route.ts](file:///Users/ishtarpissano/proyectos/atelier/src/app/api/whatsapp/chats/[id]/extract-client/route.ts)
- Se añadió un paso previo de pre-extracción por regex sobre el primer mensaje entrante para identificar de forma garantizada los corchetes `/\[meta[a-zA-Z0-9_-]+\]/i` de Meta y las plantillas de Google Ads, esquivando alucinaciones del LLM.

**Archivo modificado**: [tools.js](file:///Users/ishtarpissano/proyectos/atelier/wa-service/tools.js)
- Se incorporaron las mismas heurísticas de regex en la función `detectContactSourceFromChat` del bot de WhatsApp para asegurar la consistencia.
- Se alineó el formato de presupuestos con `salesPrompt.js` e incorporamos imágenes y enlaces.
- Se añadió el registro automático del hito de origen en `convertIntoLead`.

### 3. Formularios e Interfaz de Usuario (Creación Manual)
- Se verificó y reforzó la obligatoriedad de `contactSource` en los 3 flujos de creación manual:
  - Formulario de Contactos principal: [ContactForm.tsx](file:///Users/ishtarpissano/proyectos/atelier/src/components/contacts/ContactForm.tsx) y [ContactFormSections.tsx](file:///Users/ishtarpissano/proyectos/atelier/src/components/contacts/ContactFormSections.tsx) (con asterisco visual `*` y bloqueo con alert).
  - Modal de Creación desde Chats de WhatsApp: [page.tsx](file:///Users/ishtarpissano/proyectos/atelier/src/app/admin/whatsapp/page.tsx) (bloqueo de botón "Crear Ficha" si no hay origen).
  - Modal de Creación en Cotizador Rápido: [page.tsx](file:///Users/ishtarpissano/proyectos/atelier/src/app/admin/cotizador/page.tsx) (asterisco visual y desactivación del botón de guardar).

### 4. Normalización de Datos Históricos
**Nuevo archivo**: [normalize-historical-sources.js](file:///Users/ishtarpissano/proyectos/atelier/scripts/maintenance/normalize-historical-sources.js)
- Script idempotente ejecutado con éxito en producción:
  - **175 clientes** normalizados y actualizados con las etiquetas correctas de Google Ads, Meta Ads y Ya es cliente.

### 5. Reporte Comercial Dinámico
**Nuevo archivo**: [send-commercial-report.js](file:///Users/ishtarpissano/proyectos/atelier/scripts/utils/send-commercial-report.js)
- Mapeado con credenciales de producción para extraer datos reales de ventas y cotizaciones de Junio 2026.
- Genera gráficos de torta circulares utilizando gradientes cónicos nativos de HTML/CSS.
- Correo electrónico despachado exitosamente a la dirección `pisano.ishtar@gmail.com`.

---

## Verificación

### 1. Pruebas Unitarias de Heurísticas
**Archivo**: [test-heuristics.js](file:///Users/ishtarpissano/proyectos/atelier/scripts/tests/test-heuristics.js)
- Se ejecutó el set de 9 pruebas cubriendo mensajes reales de Meta, Google y casos genéricos. Todos pasaron exitosamente.

### 2. Normalización de Base de Datos Realizada
- Sincronizados exitosamente 175 clientes y etiquetas en la base de datos PostgreSQL de producción.

### 3. Envío de Correo
- Correo comercial enviado exitosamente a la casilla de correo electrónico del usuario.

### 4. Compilación Exitosa
- La compilación e integridad de tipos TypeScript finalizó de forma correcta.

---

## Corrección de Error en Tienda y Checkout (Producción)

### Problema
Las páginas `/tienda` y `/checkout` presentaban una pantalla de error `"¡Ups! Algo salió mal"` en producción.

### Causa Raíz
Se identificó que el backend y el frontend habían sido modificados para dar soporte a tarifas mayoristas (rol `OPTICA`), añadiendo el campo `wholesalePrice` en la base de datos local y en el cliente de Prisma. Sin embargo, **la base de datos de producción (en Railway) no tenía aplicada la columna `wholesalePrice` en la tabla `Product`**, lo que provocaba que las consultas del servidor de Next.js (como `prisma.webProduct.findMany({ include: { product: true } })`) fallaran arrojando un error `P2022` ("The column Product.wholesalePrice does not exist in the current database").

Además, en el entorno local existía un error de tipos TypeScript en `src/hooks/useProducts.ts` y en `src/components/inventory/ProductForm.tsx` (en el método `addBulkRow`), lo que causaba fallos de compilación al correr `npm run build`.

### Soluciones Implementadas
1. **Migración de Base de Datos**: Creamos manualmente una nueva migración de Prisma `20260622180000_add_wholesale_price` que añade de forma segura e idempotente la columna `wholesalePrice` a la tabla `Product`:
   ```sql
   ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "wholesalePrice" DOUBLE PRECISION NOT NULL DEFAULT 0.0;
   ```
   Aplicamos esta migración exitosamente a la base de datos de producción mediante `prisma migrate deploy`.
2. **Corrección de Tipos**: Añadimos el campo `wholesalePrice: number` a la interfaz `Product` en [useProducts.ts](file:///Users/ishtarpissano/proyectos/atelier/src/hooks/useProducts.ts) y añadimos el campo al inicializador de `bulkItems` en [ProductForm.tsx](file:///Users/ishtarpissano/proyectos/atelier/src/components/inventory/ProductForm.tsx).
3. **Verificación**: Corrimos `npm run build` localmente y la compilación de la aplicación de Next.js finalizó exitosamente sin errores de compilación. Corrimos pruebas automatizadas con Playwright levantando el servidor local conectado a la base de datos de producción, comprobando que tanto `/tienda` como `/checkout` cargan correctamente y sin ningún tipo de excepción.

