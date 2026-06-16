# Auditoría de Rendimiento del Backend

## Resumen Ejecutivo
Se realizó un análisis exhaustivo del backend del proyecto, específicamente en la interacción con la base de datos mediante Prisma, el uso de caché, y la eficiencia de las consultas. El sistema presenta graves deficiencias de escalabilidad debido a que favorece el filtrado y agrupamiento en memoria (JavaScript) en lugar de delegar el trabajo al motor de base de datos. Además, el uso de caché es prácticamente inexistente.

---

## 1. Filtrado y Procesamiento en Memoria (El Mayor Cuello de Botella)
La velocidad de respuesta y el uso de memoria (RAM) se verán muy afectados a medida que crezca la base de datos. Se detectaron múltiples lugares donde se obtiene gran parte de la base de datos para filtrarla o calcular estadísticas en NodeJS:

- **Cálculo de Saldos Pendientes (`ContactService.getOrdersWithBalance`):** 
  Para obtener los pedidos que deben dinero, el sistema hace un `prisma.client.findMany` que trae a memoria **todos los clientes que alguna vez compraron**, incluyendo `orders`, `items`, `products` y `payments` de forma anidada. Luego itera todo el JSON gigantesco en el backend para saber quién debe dinero.
- **Listado de Órdenes (`api/orders/route.ts`):** 
  Al filtrar por la opción `hasBalance`, el backend ignora la paginación a nivel SQL. Obtiene absolutamente todos los pedidos (cientos o miles) a memoria, calcula `PricingService.calculateOrderFinancials(o)` para cada uno, filtra los que deben dinero, y finalmente hace el `.slice(skip, skip + limit)` para simular la paginación.
- **Dashboard (`api/dashboard/route.ts`):** 
  Para obtener estadísticas simples, como cuántos clientes confirmó un vendedor o para extraer las etiquetas (`contactSource`) existentes, se descarga el arreglo de clientes enteros o de ventas del mes a un array y se hacen `filter` o mapeos de arrays.

## 2. Consultas N+1 (N+1 Queries)
Aunque los listados principales (como el GET de orders) utilizan el `select`/`include` correctamente para evitar el N+1 de lectura, las operaciones de mantenimiento y sincronización presentan N+1 durante la escritura:

- **Sincronización Web (`bulkCreate` en `product.service.ts`):** 
  Al hacer una subida masiva de productos (bulk create), la transacción se ejecuta correctamente, pero luego el código realiza un bucle `for` tradicional ejecutando `syncToWebProduct`. Dicha función ejecuta `findFirst` + `create/update` por separado. Si se suben 1,000 productos, se ejecutan más de 2,000 queries independientes de forma secuencial.
- **Scripts de Mantenimiento (`admin/fix-names`, `admin/fix-phones`):** 
  Estos scripts recorren miles de entidades y realizan sentencias `prisma.client.update` o `prisma.product.update` dentro de ciclos `.map()` o `.forEach()` sin paralelización ni optimizaciones (como sentencias batch/bulk).

## 3. Uso de Caché
El aprovechamiento de capas de caché en el proyecto es **nulo o muy primitivo**:
- **Ausencia de Caché a Nivel de Datos:** No hay Redis, ni se están utilizando primitivas de Next.js (`unstable_cache` o `React.cache`) para almacenar resultados pesados.
- **Dashboard No Cacheado:** El panel de control recalcula facturación, funnels de conversión, promedios y desglose de items vendidos recalculando decenas de operaciones cada vez que cualquier usuario entra a la ruta. 
- **Excepciones Menores:** Las únicas cachés existentes son variables en memoria globales (`logoBase64Cache` en facturación y una pseudo-caché para credenciales de AFIP).

---

## Recomendaciones de Mejora (Plan de Acción)

1. **Denormalizar Saldos Puntos Críticos:**
   - Crear un campo `balance` y `hasBalance` dentro del modelo `Order`. Este valor debe actualizarse en base de datos al momento de registrar o eliminar un `Payment`.
   - Esto permitirá que la paginación de deudores se haga directamente en la base de datos con un simple `where: { hasBalance: true }`, bajando drásticamente los tiempos de carga y liberando MBs de memoria RAM.

2. **Delegar Estadísticas a Prisma:**
   - En el Dashboard y reportes, utilizar las utilidades nativas de Prisma: `_sum`, `_avg`, `count`, y `groupBy` en lugar de traer los arreglos a JavaScript.
   - Para etiquetas únicas usar `distinct: ['contactSource']`.

3. **Caché en Endpoints Pesados:**
   - Envolver las peticiones pesadas (como el Dashboard general y las configuraciones públicas) en `unstable_cache` de Next.js, configurando una revalidación periódica de 5 o 10 minutos (`revalidate: 300`). 
   
4. **Optimización de Escrituras:**
   - Para actualizaciones de web products reemplazar el bucle por instrucciones de tipo `Upsert` transaccionales o en lotes (batch operations) dividiendo los arrays en chunks de 100/200 registros a la vez con `Promise.all()`.
