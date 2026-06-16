# Auditoría de Rendimiento del Backend (Prisma, N+1, Caché)

## 1. Introducción
Este reporte analiza el estado de rendimiento del backend de Atelier, centrándose específicamente en la eficiencia de las consultas de Prisma ORM, la detección de problemas conocidos de N+1, el uso de mecanismos de caché y la configuración de índices a nivel de la base de datos.

## 2. Consultas Prisma (Queries y ORM)

### ✅ Aciertos y Buenas Prácticas
1. **Uso Efectivo de Relaciones (`include`)**: En la mayor parte del código (ej. en `src/services/order.service.ts` y componentes de vista), se utiliza el operador `include` de Prisma para trazar relaciones completas de una sola vez. Esto previene un problema de N+1 de lectura a nivel general.
2. **Índices de Base de Datos**: El esquema de la base de datos (`schema.prisma`) cuenta con un uso excelente de `@@index`. Los campos de mayor acceso (`status`, `clientId`, `createdAt`, `userId`, `orderType`) están bien indexados. Esto mantendrá las consultas de filtrado rápidas, incluso cuando los datos aumenten.
3. **Transacciones Seguras (`$transaction`)**: El backend encierra lógicas que requieren mutaciones múltiples (como crear una orden, descontar stock, generar interacciones, etc.) dentro de transacciones de Prisma. Esto no solo garantiza la integridad de los datos, sino que reutiliza una misma conexión temporal a la base de datos para la ejecución por lotes.

### ⚠️ Riesgos y Cuellos de Botella Críticos (OOM - Out of Memory)
El mayor peligro estructural de rendimiento radica en **`ReportService.generateReportData`** (`src/services/report.service.ts`).
* **El Problema**: Este método extrae *todas* las órdenes de la base de datos (`findMany`) junto con todas sus relaciones anidadas (`items`, `products`, `payments`, `client`, `user`) para alojarlas en la memoria de Node.js (Vercel/Railway) y realizar sumatorias (reduce).
* **El Riesgo**: Esto funcionará mientras la base de datos sea pequeña. Sin embargo, en un entorno de alto volumen, descargar decenas de miles de filas con joins completos consumirá cientos de megabytes, resultando en lentitud de la API, bloqueos del Event Loop de Node.js, y eventualmente **caídas por falta de memoria (Out of Memory)**.
* **Solución Propuesta**: Mover el esfuerzo computacional a la base de datos utilizando las funciones nativas: `prisma.order.aggregate` o `prisma.$queryRaw` agrupando mediante SQL puro (`GROUP BY`) para traer únicamente los subtotales calculados en el motor Postgres.

## 3. Análisis de Consultas N+1

Se detectó presencia de consultas iterativas N+1, específicamente de **escritura**, pero se encuentran encapsuladas.

1. **Decremento de Stock** (`src/services/order.service.ts`):
   Al convertir un presupuesto a una venta confirmada, el sistema itera producto por producto en un bucle `for...of` haciendo un `update` para descontar la cantidad.
   ```typescript
   for (const item of stockItems) {
       await tx.product.update({ ... });
   }
   ```
2. **Refresco de Precios** (`src/app/api/orders/[id]/refresh-prices/route.ts`):
   ```typescript
   for (const change of changes) {
       await tx.orderItem.update({ ... });
   }
   ```
* **Evaluación**: Prisma no permite actualizaciones por lotes heterogéneos (Bulk Update donde cada `id` lleva un valor distinto) de forma nativa a no ser que se utilicen comandos Raw de SQL.
* **Impacto**: Como estas actualizaciones se ejecutan dentro de bloques `await prisma.$transaction(async (tx) => { ... })`, la latencia de ida y vuelta a la DB es menor que en transacciones separadas. Para un volumen normal en un carrito de compras de una óptica (típicamente entre 1 y 5 ítems), el N+1 aquí es **inofensivo**. Sin embargo, si alguna vez hubieran operaciones masivas (ej. actualizar 500 ítems), el servidor sentirá el peso de la ejecución en cascada.

## 4. Estrategia de Caché

### ✅ Vista al Cliente (Web)
El código utiliza Incremental Static Regeneration (ISR) en las páginas principales orientadas a los clientes, como `src/app/tienda/page.tsx` o `/producto/[slug]`, usando `export const revalidate = 300;`. Esto es **excelente**, porque evita sobrecargar la base de datos con peticiones constantes de tráfico de visitantes anónimos o bots.

### ⚠️ Panel Administrativo y API CRM
Dentro de las rutas de la API del panel de control y de WhatsApp, se está abusando del `cache: 'no-store'` (o su equivalente Next.js).
1. **Datos Maestros Constantes**: Listas como Colores de Cristales, Laboratorios (`LaboratoryConfig`), y algunos Listados Generales de Precios se consultan directamente en la DB cada vez que se navega por el panel. Esto genera carga innecesaria en la DB de Postgres.
2. **Next.js Cache Missing**: No hay uso perceptible de la función `unstable_cache` de Next.js, ni un gestor externo (como Redis), y tampoco `React cache()`.
* **Impacto**: Los tiempos de carga del CRM serán los tiempos crudos de las sentencias SQL más la latencia de red de la base de datos en todos los endpoints, impactando en la "sensación de velocidad" del usuario del panel.
* **Solución Propuesta**: Para tablas estáticas o catálogos, implementar un mecanismo de caché en memoria básico de corta duración (`node-cache` para 5 minutos), o aprovechar `unstable_cache` para Server Actions relacionados con configuraciones.

## 5. Resumen de Acción (Plan de Mejoras)
1. **[Alta Prioridad] Refactor de Reportes**: Reescribir los cálculos del Dashboard (`report.service.ts`) para que utilicen `aggregate` y deleguen la responsabilidad de la matemática a PostgreSQL. Evitar cargar miles de registros completos a la RAM de la API.
2. **[Media Prioridad] Caché de Catálogo/Maestros**: Envolver consultas como `Laboratories`, `Pricing Categories` y similares dentro del CRM usando caché de React o `unstable_cache`.
3. **[Baja Prioridad] N+1 en Updates**: Para los N+1 hallados en carritos de compra, la solución actual con `$transaction` es adecuada para el contexto de negocio, a menos que el número de productos por orden crezca dramáticamente en el futuro.
