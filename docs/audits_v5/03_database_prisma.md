# Auditoría de Base de Datos (Prisma Schema)

## 1. Resumen Ejecutivo
Se ha realizado una auditoría exhaustiva del archivo `schema.prisma` que define la estructura de datos en PostgreSQL. El esquema presenta una estructura sólida y madura para soportar las operaciones de un CRM, E-commerce y punto de venta óptico. Sin embargo, se han detectado riesgos críticos relacionados con la integridad de datos financieros y oportunidades de optimización en índices y tipado.

## 2. Relaciones y Estructura (Integridad de Datos)

El esquema utiliza correctamente las capacidades de Prisma, pero hay **un riesgo crítico que debe solucionarse de inmediato**:

### 🚨 RIESGO CRÍTICO: Eliminaciones en Cascada (Cascade Delete) en Entidades Financieras
Actualmente, varias relaciones clave están configuradas con `onDelete: Cascade`:
- `Client` -> `Order` (`onDelete: Cascade`)
- `Order` -> `Invoice` (`onDelete: Cascade`)
- `Order` -> `Payment` (`onDelete: Cascade`)

**Problema:** Si un usuario elimina un cliente (por error o por limpieza de base de datos), **se eliminarán automáticamente todas sus órdenes, pagos y facturas (invoices)**. Esto es inaceptable para un sistema con impacto contable y fiscal.
**Solución recomendada:** 
Cambiar a `onDelete: Restrict` en estas relaciones y usar un enfoque de "Soft Delete" (como el que ya tiene `Order` con `isDeleted`) para los `Client`. No se debería poder eliminar un cliente que tenga historial de órdenes.

### Aspectos Positivos:
- Las relaciones N:M (ej. `Tag` con `Client` y `Order`) están definidas implícitamente de forma correcta, lo cual es ideal para mantener la simplicidad en Prisma.
- El uso de `SetNull` en relaciones opcionales (ej. `Product` en `OrderItem`, o `Prescription` en `Order`) es adecuado para mantener el historial (ej. conservar la línea de la orden aunque se elimine el producto de catálogo).

## 3. Auditoría de Índices (Rendimiento de Búsqueda)

El esquema hace un muy buen uso de `@@index`, especialmente en las Foreign Keys (ej. `clientId`, `userId`, `orderId`), lo cual previene cuellos de botella severos en los JOINs. 

### Índices Faltantes Recomendados:
Para optimizar las consultas y evitar "Sequential Scans" a medida que la base crezca, se recomiendan los siguientes índices:

1. **Tabla `Order`:**
   - Falta: `@@index([status])`
   - *Razón:* Los tableros del CRM seguramente filtran órdenes por estado (ej. "PENDING", "COMPLETED").
2. **Tabla `Product`:**
   - Falta: `@@index([category])`
   - *Razón:* Las búsquedas en la tienda online o en el catálogo interno frecuentemente filtran por categoría.
3. **Tabla `WhatsAppChat`:**
   - Falta: `@@index([status])` y potencialmente `@@index([unreadCount])`.
   - *Razón:* La interfaz de chat necesita cargar rápidamente los chats "OPEN" o aquellos que tienen mensajes sin leer.

### Índices Positivos Destacados:
- `@@index([chatId, createdAt(sort: Desc)])` en `WhatsAppMessage` es perfecto para cargar historiales de chat rápidamente.
- Los índices en `Client` (`status`, `doctor`, `name`, `phone`, `dni`) están muy bien pensados para el motor de búsqueda de contactos.

## 4. Diseño de Datos y Potenciales Cuellos de Botella

### A. Uso excesivo de `String` vs `Enum` nativos
Muchos campos que representan estados fijos utilizan el tipo `String` con valores por defecto (ej. `role` en `User`, `status` en `Order`, `type` en `CashMovement`, `orderType` en `Order`, etc.).
- **Problema:** Ocupa más espacio en disco, es más lento de indexar y permite la inserción de errores tipográficos a nivel de base de datos.
- **Solución:** Aprovechar que PostgreSQL soporta Enums nativos. Refactorizar estos campos a `enum Role { STAFF, ADMIN }`, `enum OrderStatus { PENDING, COMPLETED, CANCELLED }`, etc.

### B. Campos JSON no indexados
Tablas como `CheckoutSession` (`cartData`), `Order` (`smartLabDetails`) y `AuditLog` (`details`) utilizan tipos `Json`. 
- **Consideración:** Si en el futuro se necesita buscar *dentro* de estos JSON (ej. buscar todos los AuditLogs donde cambió un campo específico), Prisma no ofrece soporte nativo fácil para índices GIN. Si la búsqueda es necesaria, se deberían extraer esos campos clave a columnas regulares.

### C. "Fat Model" en `Order`
El modelo `Order` tiene casi 50 campos, muchos de los cuales son opcionales y exclusivos de la gestión del laboratorio (`labStatus`, `labSentAt`, `labNotes`, `labColor`, `labMaterial`, etc.).
- **Consideración:** A largo plazo, cargar un modelo tan ancho puede consumir más memoria de la necesaria si solo se requiere el subtotal. Podría evaluarse normalizar estos datos moviendo la información específica del laboratorio a una tabla 1:1 `OrderLabDetails`. No es urgente, pero es un potencial cuello de botella de I/O de red.

## 5. Resumen de Acciones Recomendadas

1. **[CRÍTICO - PRIORIDAD ALTA]** Remover `onDelete: Cascade` de `Client -> Order`, `Order -> Payment` y `Order -> Invoice`. Cambiar a `Restrict` e implementar "Soft Delete" (`isActive` o `isDeleted`) en `Client`.
2. **[PRIORIDAD MEDIA]** Agregar `@@index([status])` en `Order` y `WhatsAppChat`, y `@@index([category])` en `Product`.
3. **[PRIORIDAD BAJA / MEJORA TÉCNICA]** Migrar campos de estado de tipo `String` a `Enum` de Prisma/PostgreSQL para mejorar la integridad y reducir el tamaño de las filas.
4. **[MONITOREO]** Observar el rendimiento de la tabla `Order` debido a la gran cantidad de campos; considerar refactorización si las consultas se vuelven pesadas.
