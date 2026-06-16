# Auditoría de Fiabilidad: Proceso de Facturación Electrónica (AFIP/ARCA)

## 1. Contexto y Arquitectura Actual
El proceso de facturación electrónica se gestiona principalmente en el archivo `src/services/billing.service.ts` utilizando la librería `@afipsdk/afip.js`.
El sistema permite emitir **Factura C (Tipo 11)** para Monotributistas mediante dos cuentas/CUITs independientes (Ishtar y Yani), delegando a `afipInstances` el manejo de los accesos y claves criptográficas.

La arquitectura sigue este flujo síncrono al llamar a `POST /api/billing/invoice`:
1. **Validación de Datos**: Control de permisos (solo ADMIN), chequeo del estado de la orden (solo `SALE` y no borrada), y verificación para impedir la sobre-facturación (doble factura).
2. **Chequeo de Topes**: Bloqueo de emisión si el monto unitario de un ítem supera el límite establecido para Monotributo.
3. **Mecanismo de Recuperación (Fallback)**: Consulta el último comprobante emitido (`getLastVoucher`) y revisa si falta en la base de datos local para recuperarlo (idempotencia en caso de timeout previo).
4. **Emisión AFIP**: Envío final a AFIP (`createNextVoucher`) y recepción de `CAE` y `Vencimiento de CAE`.
5. **Persistencia Atómica**: Uso de `prisma.$transaction` para grabar el comprobante y crear el registro de interacción en la bitácora del cliente al mismo tiempo.

---

## 2. Puntos Fuertes (Pros de Fiabilidad)

- **Estrategia de Reintentos (Retry with Backoff)**: El servicio implementa una función robusta `retryWithBackoff(fn, 3, 1000, 2)` que captura los errores de red (e intermitencias comunes de la API de ARCA) e intenta hasta 3 veces con tiempos de espera progresivos (1s, 2s, 4s). Al mismo tiempo, aborta rápidamente si detecta errores no recuperables (Cuit Inválido, Problemas de Autorización, Punto de Venta incorrecto).
- **Consistencia en Base de Datos**: La base de datos es protegida mediante una transacción (`$transaction`), garantizando que no se genere un "Invoice" en base de datos sin su contraparte en "Interactions".
- **Gestión Automática del Token de AFIP**: El Token (Ticket de Acceso) y su vencimiento están correctamente abstraídos gracias al SDK.
- **Recuperación Inteligente de Desconexiones (Orphan Vouchers)**: Al comenzar el ciclo de facturación, si el sistema detecta que el último voucher emitido en AFIP no existe localmente, evalúa si los montos e identificaciones coinciden para adoptarlo. Esto salva el desfasaje en casos donde AFIP aprueba la factura, pero la conexión se corta justo antes de recibir la respuesta.

---

## 3. Riesgos, Vulnerabilidades y Cons

1. **Riesgos de Concurrencia (Race Conditions)**:
   Actualmente **no existe un sistema de exclusión mutua (Locks)** para la emisión concurrente sobre la misma cuenta (ISH o YANI). Si dos facturaciones inician en paralelo exacto, ambas consultan el mismo `getLastVoucher` y ambas mandarán un request `createNextVoucher`. 
   - *Efecto*: Una orden será aceptada por AFIP, y la otra fallará indicando error de AFIP ("El comprobante enviado no es el próximo a autorizar").

2. **Falsos Positivos en la Recuperación de Comprobantes**:
   El mecanismo de rescate `[AFIP RECOVERY]` valida si el último comprobante no registrado de AFIP coincide con el `ImpTotal` (Total a facturar) y `DocNro` (DNI). Si dos clientes anónimos (`DocTipo: 99`, `DocNro: 0`) compran productos por el *mismo* monto total, y la primera facturación sufre un timeout, la *segunda* orden podría llegar a adjudicarse el CAE de la primera, omitiendo la emisión de una factura genuina para la segunda venta.

3. **Ejecución Totalmente Síncrona (Sin Colas / Background Jobs)**:
   La petición del cliente espera activamente hasta que AFIP responde. Cuando el webservice de AFIP entra en latencias altas (+30 segundos), esto suele traducirse en un "504 Gateway Timeout" en plataformas serverless (ej. Vercel) o PaaS (Railway).
   - *Mejora a largo plazo*: Manejar un estado "PENDING_AFIP" y un proceso en segundo plano (Worker/Cron) para las emisiones y reintentos silenciosos.

4. **Límite Unitario Estático ($499,000)**:
   La constante `UNIT_PRICE_LIMIT = 499000` está quemada en el código (`billing.service.ts`). Este monto tope fijado por el Gobierno Argentino para venta de bienes por monotributo sufre actualizaciones impositivas anuales (o semestrales según coyuntura inflacionaria). Este valor debería idealmente alojarse en las variables de entorno o la configuración de base de datos para no requerir un despliegue (deploy) ante cada cambio gubernamental.

---

## 4. Diagnóstico y Veredicto Final

**Nivel de Fiabilidad: Alto (Para operaciones asíncronas secuenciales).**

El sistema presenta una resiliencia sobresaliente para un entorno de comercio minorista al atrapar errores de micro-cortes y verificar la correlatividad del último comprobante para no duplicar en caso de pérdida de conexión.

**Plan de Acción Sugerido:**
- Convertir `UNIT_PRICE_LIMIT` a una variable de entorno.
- En caso de escalar a múltiples terminales/vendedores operando el sistema simultáneamente, incorporar una librería de "Locks" (como Redlock o un mutex local en memoria si es una única instancia Node) para asegurar que el método de facturación se ejecute secuencialmente a través de la API.
- Revaluar la lógica de la "Recuperación" en casos anónimos (`DocTipo 99`), potencialmente cruzando alguna observación extra o deshabilitando la recuperación si el comprador es genérico y el riesgo de choque es alto.
