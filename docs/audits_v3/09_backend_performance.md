# Reporte de Rendimiento del Backend: Prisma, Caché y Queries

Este documento detalla los hallazgos de la auditoría de rendimiento sobre la capa de acceso a datos (Prisma), el uso de caché y posibles cuellos de botella por consultas ineficientes.

## 1. Problemas de Consultas N+1

El patrón N+1 ocurre cuando el código realiza una consulta a la base de datos dentro de un bucle, multiplicando exponencialmente la latencia a medida que crece la cantidad de registros.

**Hallazgos:**
- **Crítico en `api/sales-opportunities/route.ts`**: Al iterar sobre los carritos abandonados (`abandonedCarts`), se ejecuta un `await prisma.client.findFirst(...)` por cada carrito para buscar si el cliente ya existe por número de teléfono. Si hay 100 carritos, habrá 100 consultas a la base de datos de forma secuencial.
- **Scripts de Administración (`api/admin/fix-phones/route.ts`, `fix-names/route.ts`)**: Tienen múltiples bucles anidados con `await prisma.model.update` y `findMany`. Al ser rutas de mantenimiento, no afectan al usuario final, pero pueden causar timeouts (Serverless Functions) si la tabla es muy grande.
- **Buenas Prácticas detectadas**: En endpoints como `api/dashboard/route.ts` (con `localInteractions`) y `api/doctors/commissions/route.ts`, se está usando correctamente el operador `IN` (`clientId: { in: clientIds }`) para resolver relaciones en bloque sin caer en N+1.

**Recomendaciones:**
- Refactorizar el endpoint de `sales-opportunities`. Extraer todos los números de teléfono, hacer un único `prisma.client.findMany` con operador `IN`, agruparlos en un Map de JavaScript y luego cruzar los datos.

## 2. Ineficiencia por Descarga Masiva y Agregación en Memoria

Varios endpoints están extrayendo registros enteros de la base de datos (Full Table Scans a nivel aplicación) para calcular sumatorias o promedios usando JavaScript (`reduce` o `forEach`), en lugar de usar funciones de agregación SQL (`SUM()`, `COUNT()`).

**Hallazgos Críticos:**
- **Dashboard API (`api/dashboard/route.ts`)**:
  - `allClientsWithOrders`: Extrae **toda la historia** de clientes que tienen ventas, incluyendo todas sus órdenes de tipo SALE y todos sus pagos, únicamente para calcular el "Saldo Pendiente Global" sumando y restando en memoria.
  - `allOrders`: Se extraen absolutamente todas las órdenes históricas del sistema. A medida que el negocio escale a miles de órdenes, este endpoint superará el límite de memoria del servidor (OOM) y elevará drásticamente los tiempos de carga (TTFB).
- **Reportes API (`api/reports/route.ts`)**:
  - Extrae masivamente órdenes (`findMany`) incluyendo relaciones profundamente anidadas (`client`, `items`, `product`, `payments`, `tags`, `invoices`) dentro de un rango de fechas, para luego hacer iteraciones en memoria calculando rentabilidad y totales.

**Recomendaciones:**
- Emplear `prisma.order.aggregate` o `prisma.order.groupBy` para que la base de datos resuelva las sumas matematicamente y solo devuelva el resultado (ej. `_sum: { total: true }`).
- Para el "Saldo Pendiente Global" complejo, implementar una consulta nativa con `$queryRaw` que ejecute la aritmética a nivel SQL o agregar un campo `balance` / `debt` al modelo de `Client` que se actualice mediante webhooks / triggers en cada pago y se consulte directamente.

## 3. Uso de Caché (Next.js & Server)

El manejo de caché es vital para que las pantallas principales carguen instantáneamente y para proteger a la base de datos.

**Hallazgos:**
- **Frontend (eCommerce)**: 🟢 **Excelente implementación**. Las páginas estáticas y de listado de productos (`/receta`, `/tienda`, `/arma-tus-lentes`) utilizan ISR (`export const revalidate = 300;`). Esto significa que las rutas públicas responden con caché y se reconstruyen en background cada 5 minutos, garantizando SEO perfecto y 0 carga a la DB para las visitas concurrentes.
- **Backend/API**: 🔴 **Nulo uso de caché**. Todos los endpoints analizados exportan `dynamic = 'force-dynamic'`, forzando lecturas en caliente para el 100% de los requests. 

**Recomendaciones:**
- Implementar estrategias de caché en memoria (ej. `node-cache`, LRU Cache o Redis) para los datos estadísticos que no cambian en tiempo real. 
- En el dashboard, la estadística de los meses anteriores jamás cambiará. Esos cálculos hiper-pesados deberían generarse una sola vez y guardarse en caché (o en una tabla dedicada de resúmenes mensuales) para no recalcularlos con cada F5 del administrador.
- Next.js 15+ ofrece `unstable_cache` para encapsular las llamadas de base de datos pesadas en el lado del servidor y revalidarlas con etiquetas (tags) cuando hay cambios reales.

## 4. Estado de los Índices en la Base de Datos

Los índices en PostgreSQL/Prisma evitan escaneos completos de tablas.

**Hallazgos:**
- El esquema de Prisma cuenta con índices muy razonables para el inicio del proyecto (`@@index([orderType, isDeleted])`, `@@index([status])`, `@@index([createdAt])`, `@@index([clientId])`).
- En el modelo `Interaction`, se suele filtrar frecuentemente por `clientId` y `type`, pero el índice es solo por `clientId`.
- Las queries combinan mucho `isDeleted: false` con fechas (`createdAt`), pero Prisma los asimila bien con índices separados (PostgreSQL usa *Bitmap And*).

**Recomendaciones:**
- Si las consultas de interacción se vuelven lentas, agregar `@@index([clientId, type])` al modelo `Interaction`.
- Si el listado de órdenes en el panel admin se vuelve lento, revisar índices compuestos sobre `[orderType, isDeleted, createdAt]` para acelerar las vistas predeterminadas.
