# Auditoría del Proceso de Facturación Electrónica (AFIP / ARCA)

## 1. Confiabilidad y Mecanismos Actuales (Fortalezas)
Al analizar el código actual (`src/services/billing.service.ts` y `src/lib/afip.ts`), se observa un nivel razonable de resiliencia y validación:
- **Reintentos Automáticos (Backoff Exponencial)**: Se implementó la función `retryWithBackoff`, que intercepta errores de red y realiza hasta 3 reintentos espaciados, previniendo caídas cuando la API de AFIP presenta latencia o errores 5xx pasajeros. Filtra correctamente fallos irreversibles (ej. errores de autenticación o punto de venta inhabilitado).
- **Control Financiero**: El sistema verifica que la sumatoria facturada (`totalInvoiced + totalAmount`) no supere el `maximumInvoiceable`, impidiendo facturar pagos no registrados. Además, incluye tope por ítem unitario ($499.000 para monotributistas).
- **Auto-Recuperación Básica (`[AFIP RECOVERY]`)**: Al solicitar facturar, el sistema chequea primero el último comprobante emitido (`lastVoucherNumber`). Si no figura en la base de datos local y sus montos y documentos coinciden con la solicitud en curso, se asume que un timeout interrumpió el proceso anterior, y el backend "recupera" el CAE preexistente en lugar de emitir un duplicado.

## 2. Vulnerabilidades y Puntos de Falla (Riesgos)
Existen escenarios concretos donde el modelo actual podría fallar y desincronizar la información:

- **Pérdida Permanente de Comprobantes (Voucher Gap)**:
  El mecanismo de recuperación solo revisa el *último* comprobante emitido en ARCA (`lastVoucherNumber`). 
  *Escenario de fallo:* La Factura A es aprobada por ARCA pero el backend se cae o da timeout antes de guardar en la DB (queda huérfana). Si luego otro usuario emite exitosamente la Factura B, el `lastVoucherNumber` en ARCA ahora apunta a la Factura B. La Factura A queda autorizada fiscalmente, pero permanentemente perdida en el CRM. La existencia del script manual `scratch/recover_invoice.ts` confirma que esto ha ocurrido en el pasado.
- **Ausencia de Bloqueos de Concurrencia (Race Conditions)**:
  La consulta del total ya facturado y la petición a ARCA se ejecutan de manera desprotegida (sin base locks). Si dos operadores (o doble clic del usuario) disparan el mismo request de facturación, ambos validarán el monto local simultáneamente, y ambos intentarán emitir un comprobante, resultando en facturación duplicada ante AFIP.
- **Transaccionalidad Incompleta**:
  Las transacciones Prisma (`prisma.$transaction`) abarcan solo la inserción en BD, pero dejan fuera la comunicación con AFIP. Es una buena práctica evitar bloquear la BD durante llamadas externas, pero sin un registro previo (ver sugerencias), cualquier fallo entre la respuesta de AFIP y la apertura de la transacción deja un comprobante emitido sin registro local.
- **Inexistencia de Auditoría Asíncrona (Cron Jobs)**:
  No se encontró ningún script o cron (como existen para SmartLab) encargado de sincronizar periódicamente comprobantes faltantes.

## 3. Sugerencias y Plan de Acción
Para dotar al proceso de una fiabilidad Enterprise, se sugiere implementar:

1. **Patrón "Intent to Bill" (Registro Previsto)**:
   Antes de llamar a ARCA, crear la factura localmente con estado `PENDING` (y guardando un token de idempotencia temporal). Al regresar la solicitud, actualizar a `COMPLETED`. Esto erradica por completo la pérdida de comprobantes si el servidor reinicia a la mitad.
2. **Implementar Bloqueo por `orderId` (Idempotencia)**:
   Añadir bloqueo en memoria (o en Redis/DB) por `orderId` para que llamadas concurrentes fallen rápidamente y se impida el doble cobro.
3. **Cron de Sincronización de AFIP**:
   Programar una tarea diaria (`src/app/api/cron/afip-sync`) que descargue el rango de `VoucherNumbers` recientes usando el SDK y rellene automáticamente cualquier hueco ("gap") ausente en la base de datos de Atelier.
