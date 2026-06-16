# Auditoría de Base de Datos y Diseño de Datos (Prisma Schema)

El siguiente documento detalla el análisis del archivo `schema.prisma`, enfocándose en las relaciones entre modelos, índices de base de datos, tipos de datos y posibles cuellos de botella para la escalabilidad del sistema.

---

## 1. Relaciones y Riesgos de Cascada

El manejo de qué sucede cuando se elimina un registro padre es vital para la seguridad e integridad de la información del sistema.

- 🚨 **Riesgo Crítico en `Client` -> `Order`**: 
  La relación del cliente con sus órdenes está definida como `onDelete: Cascade`. Esto significa que si un usuario del sistema elimina un cliente, **se borrarán permanentemente y de manera automática todas sus órdenes**. Esto, a su vez, borrará en cascada todos los ítems (`OrderItem`), pagos (`Payment`) y facturas de AFIP (`Invoice`) asociados. Esto representa un grave riesgo contable y de auditoría.
  *Recomendación*: Cambiar a `onDelete: Restrict` o usar soft-deletes (`isDeleted`) en clientes.

- ⚠️ **Riesgo en `Order` -> `Invoice`**: 
  Las facturas también se eliminan en cascada (`onDelete: Cascade`) si se borra la orden. Las facturas (especialmente las que tienen CAE de AFIP) jamás deberían borrarse físicamente de la base de datos una vez emitidas.

- ✅ **Manejo de Recetas (`Prescription`)**: 
  En la relación con `Order`, la receta usa `onDelete: SetNull`. Esto es un enfoque más seguro, ya que permite eliminar una receta sin destruir el registro de venta, aunque se pierda el dato de con qué graduación exacta se procesó (para preservar esto, los campos de snapshot en la orden son vitales).

- ℹ️ **Relaciones Many-to-Many Implícitas (`Tag`)**: 
  Actualmente, las etiquetas (`Tag`) se relacionan de forma implícita con `Client` y `Order`. Si en el futuro es necesario auditar *cuándo* se asignó un tag o *quién* lo hizo, se deberá migrar a una tabla intermedia explícita (ej. `ClientTag`).

---

## 2. Índices y Rendimiento (Cuellos de Botella)

A medida que la base de datos crezca, la falta de índices específicos en columnas utilizadas para búsquedas y filtros ralentizará la aplicación.

- 🚨 **Falta de Índice en `Order.status`**: 
  Las órdenes son constantemente consultadas y filtradas por estado en el dashboard o tableros Kanban ("PENDING", "COMPLETED", etc.). Al no tener un índice en `status`, la base de datos realiza un escaneo completo de la tabla (Full Table Scan), lo cual será un cuello de botella grave a medida que aumente el volumen histórico.

- 🚨 **Consultas Financieras (`CashMovement` y `Payment`)**: 
  - `CashMovement` sólo está indexado por `userId`. Los reportes de cierres de caja y finanzas filtran fuertemente por rango de fechas (`createdAt`). Es imprescindible agregar `@@index([createdAt])`.
  - `Payment` carece de índice en su columna de fecha (`date`). Los cierres de caja diarios y mensuales serán lentos. Agregar `@@index([date])`.

- ⚠️ **Falta de Índice en `Product.category`**: 
  Para el catálogo web o el sistema de caja, filtrar productos por categoría es una de las acciones más comunes. La falta de este índice penaliza el rendimiento de estas consultas.

- ℹ️ **Filtros en el CRM de WhatsApp (`WhatsAppChat`)**: 
  Si el sistema prioriza chats no leídos o chats abiertos para atención, se sugiere agregar índices compuestos como `@@index([status])` y `@@index([unreadCount])`.

---

## 3. Diseño de Datos y Tipado

- 🚨 **Uso de `Float` para Moneda y Contabilidad**: 
  Los campos monetarios (`total`, `paid`, `price`, `cost`, `amount`) están definidos como `Float`. En bases de datos relacionales, esto usa punto flotante, lo que inevitablemente genera errores de precisión (por ejemplo, sumas o restas decimales que derivan en `0.99999999` o `0.30000000000000004`). 
  *Recomendación*: Migrar todo campo de dinero al tipo de dato `Decimal`.

- ⚠️ **Bloating (Tablas Gigantes o Sobrecargadas)**:
  - **Tabla `Order`**: Tiene más de 60 columnas. Mezcla metadatos base, contabilidad, información técnica de laboratorio (prismas, curvas base, etc.) e integración con "Smart Lab". Si bien Prisma lo soporta, escalar este modelo o añadir nuevas integraciones continuará inflando la tabla. Sería más escalable extraer los detalles de laboratorio a un modelo `LabOrderDetails` 1:1.
  - **Tabla `Product`**: Mezcla campos de SEO para web, dimensiones de armazones (mm) y rangos de recetas para cristales. Dependiendo de la categoría del producto, gran parte de estas columnas quedarán siempre nulas.

- ✅ **Inmutabilidad Histórica**: 
  El modelo `OrderItem` incluye campos como `productNameSnapshot` y `productBrandSnapshot`. Esta es una excelente práctica de diseño, asegurando que si un producto cambia de nombre o precio en el futuro, los registros históricos de venta permanezcan intactos.

- ✅ **Soft Deletes**:
  La presencia de `isDeleted` en `Order`, combinado con un índice `@@index([orderType, isDeleted])`, es muy acertada. Se sugiere expandir esta mecánica a otros modelos base (como `Client` o `Product`) para evitar las deleciones físicas y proteger la integridad relacional del sistema.
