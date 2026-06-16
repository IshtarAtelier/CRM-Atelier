# Auditoría del Esquema de Base de Datos (schema.prisma)

## 1. Resumen Ejecutivo
El esquema de Prisma (`schema.prisma`) presenta un estado maduro y robusto, con un buen uso de las características de Prisma y PostgreSQL. Está claramente diseñado para soportar múltiples módulos funcionales de la óptica (CRM, Inventario, Ventas, Laboratorio, Finanzas, y E-Commerce/Blog). Sin embargo, a medida que la aplicación ha crecido, algunos modelos se han convertido en tablas excesivamente anchas ("God Objects"), y hay oportunidades de mejora en el tipado estricto y la normalización para asegurar la integridad de datos y el rendimiento a largo plazo.

## 2. Análisis de Modelos y Arquitectura

### 2.1 Tablas "God Objects" (Modelos Sobrecargados)
- **`Order` (Pedido):** Es el modelo más grande del esquema (más de 60 campos). Combina datos financieros (descuentos, pagos, recargos), datos de laboratorio (medidas, estado de laboratorio, materiales), y metadatos del estado del pedido inteligente (`smartLab`).
  - *Oportunidad:* Se recomienda evaluar a futuro separar la información del laboratorio en un modelo `OrderLabDetails` (relación 1:1) y la información financiera en un `OrderFinance` para mantener el modelo principal más ligero y mejorar el rendimiento en consultas generales.
- **`Product` (Producto):** Ocurre algo similar; mezcla inventario básico, características ópticas (rangos de esferas y cilindros), medidas físicas del armazón y metadatos SEO/E-commerce.
  - *Oportunidad:* Extraer el SEO a un modelo `ProductSEO` y las medidas físicas a un modelo `ProductSpecs`.

### 2.2 Tipos de Datos y Validación
- **Uso de `String` vs `Enum`:** La mayoría de los campos de estado y tipo (`status`, `role`, `type`, `labStatus`) están definidos como `String` con un valor `@default` (Ej: `Order.status @default("PENDING")`).
  - *Oportunidad:* Utilizar `enum` nativos de PostgreSQL aportaría validación a nivel de base de datos y evitaría errores sutiles de tipeo en el código.
- **Campos JSON parseados como String:** El campo `Order.smartLabDetails` está definido como `String` pero documentado explícitamente como JSON (`// JSON: [{num, sector, progress...}]`).
  - *Oportunidad:* Cambiar a tipo `Json` para permitir consultas, filtrados y mutaciones más eficientes dentro de los objetos JSON. `AuditLog` y `CheckoutSession` ya usan el tipo `Json` correctamente.

### 2.3 Normalización y Consistencia
- **Médicos (`Doctor`):** Existe un modelo `Doctor` para pagos, pero en el modelo `Client`, el médico asignado es texto libre (`doctor String?`). Esto rompe la normalización y puede generar registros inconsistentes.
- **Marcas y Categorías:** `Product.brand` y `Order.userFrameBrand` son campos de texto libre. A medida que crezca el catálogo, considerar la creación de modelos normalizados (como `Brand`).

## 3. Relaciones e Integridad Referencial
- **Políticas de Borrado:** Excelentemente implementado. Se utiliza `onDelete: Cascade` correctamente en dependencias lógicas (ej: al eliminar `Client`, se eliminan `Interaction`, `ClientTask`, `Prescription`). Asimismo, se utiliza `onDelete: Restrict` en registros críticos, como la vinculación de `Order` a `User` o `CashMovement` a `User`, evitando la eliminación accidental de un usuario que ha procesado ventas.
- **Relaciones Nulas (SetNull):** El uso de `onDelete: SetNull` en `OrderItem` -> `Product` o `Order` -> `Prescription` es una decisión acertada para mantener intacto el historial de ventas y registros financieros incluso si un producto o receta del catálogo se elimina.
- **Muchos a Muchos:** Se utilizan relaciones implícitas de Prisma (ej: `ClientToTag`, `OrderToTag`), lo cual es la mejor práctica en Prisma para reducir verbosidad a menos que se necesiten atributos adicionales en la tabla intermedia.

## 4. Optimización e Índices (`@@index`)
- El esquema posee una sólida estrategia de indexado en las tablas de búsqueda intensiva. `Client`, `Order`, y `Product` tienen múltiples índices para acelerar búsquedas frecuentes (ej: `Client.phone`, `Client.dni`, `Product.name`, `Product.brand`).
- El modelo `WhatsAppMessage` utiliza inteligentemente un índice de ordenamiento (`@@index([chatId, createdAt(sort: Desc)])`) mejorando la carga del chat en tiempo real.
- **Nuevos Índices Recomendados:**
  - `CashMovement`: Al requerirse listados por mes o día, sugerimos agregar `@@index([createdAt])` o `@@index([type, createdAt])`.
  - `Payment`: Se recomienda agregar un índice `@@index([date])` para acelerar los reportes financieros que involucran pagos realizados.
  - `Order`: Para los filtros en los tableros de producción, un índice compuesto en `@@index([status, createdAt])` o `@@index([labStatus])` aceleraría el filtrado.

## 5. Recomendaciones y Siguientes Pasos (Roadmap Técnico)

1. **Corto Plazo (Refactorización menor):**
   - Modificar campos que guardan JSON en formato String (como `smartLabDetails`) a tipo `Json`.
   - Añadir los índices faltantes recomendados en `CashMovement` y `Payment` para acelerar cierres de caja y tableros financieros.

2. **Medio Plazo (Consistencia de Datos y Tipado):**
   - Evaluar la migración paulatina de columnas de estados críticos (`status`, `type`, `role`) a `Enum` de PostgreSQL.
   - Relacionar formalmente el campo `Client.doctor` con la entidad `Doctor` en lugar de utilizar texto libre, migrando los datos históricos.

3. **Largo Plazo (Desacople de Modelos Gigantes):**
   - Analizar los patrones de consulta. Si el tamaño de las tablas comienza a afectar el desempeño o el uso de RAM de PostgreSQL, dividir la tabla `Order` en `Order`, `OrderFinance`, y `OrderLabDetails`, relacionándolas 1:1.
