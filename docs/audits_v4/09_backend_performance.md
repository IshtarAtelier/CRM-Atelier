# Reporte de Rendimiento del Backend

## 1. Velocidad de Consultas Prisma
El análisis del código revela problemas críticos de rendimiento relacionados con cómo se obtienen y procesan los datos con Prisma:

- **Falta de paginación o límites de registros**: En rutas clave como `src/app/api/dashboard/route.ts`, se ejecutan consultas como `const allOrders = await prisma.order.findMany({...})` sin usar `take` ni filtrar por fechas estrictas en base de datos. Esto significa que a medida que crezca el historial de la óptica, estas consultas traerán miles de registros, saturando la memoria del servidor de Node.js.
- **Agrupación y filtros en memoria en lugar de SQL**:
  - En el Dashboard (`allClientsWithOrders`), el código descarga TODOS los clientes que han tenido ventas y TODAS sus órdenes/pagos, para luego hacer un cálculo de `Math.max(0, totalSales - totalPaid)` utilizando un bucle `reduce` en Javascript. Este cálculo debería hacerse a nivel base de datos utilizando consultas SQL agregadas o `Prisma.groupBy()`.
  - En la ruta `src/app/api/orders/route.ts` (cuando se busca por balance), se descargan primero todas las órdenes que coinciden, y luego se filtran mediante `ordersWithBalance = allMatchingOrders.filter(...)` y *recién ahí* se pagina de forma manual. Esto es un grave cuello de botella y generará timeouts progresivos.

## 2. Problemas de N+1 Queries
Existen múltiples lugares en el código donde se hacen consultas a la base de datos dentro de bucles `for`, lo que genera el clásico problema N+1:

- **Sales Opportunities**: En `src/app/api/sales-opportunities/route.ts`, al evaluar los carritos abandonados (`abandonedCarts`), se hace un bucle donde se ejecuta un `await prisma.client.findFirst(...)` secuencialmente para cada carrito encontrado.
- **Validaciones y Stock del Checkout**: En `src/app/api/checkout/payway/route.ts`, se hace un bucle por cada producto en el carrito ejecutando `findUnique` para revisar el stock, y luego otro bucle individual para actualizarlo. Prisma permite enviar múltiples IDs en un `findMany({ where: { id: { in: [...] } } })` para resolver las lecturas en una sola query.
- **Sincronización de Contactos**: En `src/services/contact.service.ts`, al vincular chats, se iteran arrays ejecutando `await prisma.whatsAppChat.update(...)` de manera individual. Esto debería unificarse utilizando `updateMany`.

## 3. Uso de Caché
La implementación de caché es prácticamente inexistente en las consultas al backend.

- **Endpoints de Next.js (`cache: 'no-store'`)**: Casi todos los componentes globales del dashboard (ej. `GlobalLabReady`, `GlobalTasks`) realizan `fetch` forzando `cache: 'no-store'`. Esto causa que el Dashboard golpee repetidamente la base de datos con consultas complejas ante cada navegación o renderizado.
- **Cero uso de Redis o Memoria Temporal**: La aplicación carece de capas de caché en memoria para los datos de sólo lectura o de alta frecuencia de consulta.
- **Datos Estáticos desde BBDD**: Rutas como `GET /api/settings` o catálogos web consultan recurrentemente a Prisma. Al ser datos que cambian con poca frecuencia, es imperativo incorporar utilidades nativas de Next.js (`unstable_cache` o Revalidación Incremental Estática - ISR).

## Recomendaciones Inmediatas
1. **Refactorizar Dashboard:** Migrar cálculos financieros a Raw SQL Queries (`$queryRaw`) evitando traer listados masivos y mapearlos a la memoria de Node.
2. **Resolver N+1 en APIs concurrentes:** Priorizar operaciones bulk (`updateMany`, `createMany` y validaciones con `.in`) sobre las lecturas/escrituras en bucles `for`.
3. **Caché para metadatos:** Incorporar ISR o SWR (React Cache) para la configuración del sistema, catálogo de colores de cristales y Dashboard temporal.
