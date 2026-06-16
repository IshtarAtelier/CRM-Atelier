# Auditoría de Esquema de Base de Datos (Prisma)

## 1. Resumen General
- **Motor de Base de Datos**: PostgreSQL
- **ORM**: Prisma Client
- **Estructura**: El esquema consta de aproximadamente 30 modelos bien definidos que cubren CRM, facturación, productos, historia clínica (recetas), integraciones (WhatsApp) y configuraciones del sistema. El nivel de madurez del esquema es alto, cubriendo la mayoría de las necesidades comerciales de la óptica.

## 2. Modelos y Relaciones
El diseño general de relaciones es sólido y coherente. Se utilizan políticas de eliminación (`onDelete`) adecuadas para mantener la integridad referencial sin perder historial financiero.

**Aciertos:**
- **`Cascade`** utilizado correctamente en dependencias fuertes (`OrderItem` -> `Order`, `Invoice` -> `Order`, `ClientTask` -> `Client`).
- **`Restrict` y `SetNull`** usados estratégicamente para proteger datos históricos (`Order` -> `User` con Restrict, `OrderItem` -> `Product` con SetNull para evitar perder ítems facturados si un producto se elimina).
- Uso consistente de `cuid()` como clave primaria, lo que evita colisiones y es óptimo para escalabilidad.

**Áreas de Mejora y Desnormalizaciones:**
- **Relaciones Sueltas:**
  - El modelo `Client` tiene un campo `doctor String?`, pero existe un modelo `Doctor`. Se recomienda reemplazar este campo de texto libre con una relación formal (`doctorId String?` referenciando a `Doctor`) para evitar inconsistencias y facilitar la contabilidad y pagos a doctores.
  - `CashMovement` y `Product` tienen un campo `laboratory String?`, a pesar de existir el modelo `LaboratoryConfig`. Sería ideal estandarizarlo hacia una relación formal para mejorar la consistencia.

## 3. Tipos de Datos y Enums
Actualmente, la gran mayoría de los estados y tipos se definen como `String` con valores por defecto (ej. `status String @default("PENDING")`, `role String @default("STAFF")`).

**Recomendación:**
- Migrar campos que aceptan un conjunto cerrado de valores a **Enums** nativos de PostgreSQL a través de Prisma. Esto aportará seguridad de tipos (Type Safety) a nivel de base de datos y generará tipos estrictos en TypeScript.
  - Ejemplos de candidatos ideales: `role` en `User`, `status` en `Order`, `status` en `Client`, y `platform`/`format` en `SocialContent`.

## 4. Índices (@@index) y Rendimiento
El esquema hace un uso bastante bueno de índices en varios modelos base, pero considerando un crecimiento de volumen, se pueden optimizar algunas áreas para acelerar los filtros en la UI.

**Aciertos:**
- Índices en `clientId` a lo largo de interacciones, tareas, recetas y órdenes.
- Índices compuestos estratégicos como `@@index([orderType, isDeleted])` en `Order`.
- Índices únicos (`@@unique`) correctamente aplicados en `email`, `waId`, `slug`, etc.

**Oportunidades de Optimización:**
- **Modelo `Product`:** Carece de índices en campos por los cuales típicamente se filtra en el catálogo o sistema de caja.
  - *Sugerencia*: Agregar `@@index([category])` y `@@index([brand])`.
- **Modelo `Order`:** Falta un índice directo en el estado.
  - *Sugerencia*: Agregar `@@index([status])`, ya que los tableros probablemente filtran frecuentemente órdenes pendientes vs. completadas.
- **Modelo `Client`:** Agregar índices en `phone` y `dni` acelerará las búsquedas directas desde la barra de búsqueda superior.
  - *Sugerencia*: Agregar `@@index([phone])` y `@@index([dni])`.
- **Modelo `WhatsAppMessage`:** Dado el volumen masivo potencial de mensajes, las consultas de carga del chat podrían ralentizarse.
  - *Sugerencia*: Modificar `@@index([chatId])` a un índice compuesto para ordenamiento: `@@index([chatId, createdAt])`.

## 5. Auditoría, Flexibilidad y JSON
- El modelo `AuditLog` está bien estructurado.
- El uso de campos `Json` (`smartLabDetails` en `Order`, `cartData` en `CheckoutSession`, `details` en `AuditLog`) es muy acertado para manejar estructuras de datos flexibles y anidadas sin complicar innecesariamente el esquema relacional con tablas subsidiarias complejas.

## 6. Conclusión y Plan de Acción
El esquema está listo para un uso intensivo en producción. Para asegurar el rendimiento a largo plazo y la consistencia de los datos, se sugiere este plan de acción:
1. **Fase 1 (Rendimiento)**: Añadir los índices faltantes en `Product`, `Order`, y `Client`. Es un cambio seguro, sin impacto en la lógica de negocio y con alto ROI.
2. **Fase 2 (Integridad)**: Normalizar relaciones sueltas (`Doctor` -> `Client` y `LaboratoryConfig` -> `Product` / `CashMovement`) migrando los textos actuales hacia sus respectivos IDs.
3. **Fase 3 (Type Safety)**: Refactorizar progresivamente campos `String` a `Enum` de Prisma para los estados más críticos del flujo de negocio.
