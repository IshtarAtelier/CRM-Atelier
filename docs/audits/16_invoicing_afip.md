# Auditoría del Proceso de Facturación Electrónica (AFIP / ARCA)

## 1. Integración y Configuración Base
- **Librería Utilizada:** El sistema utiliza `@afipsdk/afip.js` para la comunicación con los Web Services de ARCA (ex AFIP).
- **Manejo de Cuentas (Multitenancy):** Soporta múltiples perfiles de facturación (`ISH` para Ishtar Pissano y `YANI` para Yani Pissano). Se eligen dinámicamente según el método de pago registrado o por selección manual en facturación ambivalente.
- **Seguridad y Credenciales:** Certificados (`.crt`) y claves privadas (`.key`) se administran mediante variables de entorno en formato PEM. El código cuenta con una función robusta `formatPem` para sanear los strings (útil si se deforman al cargarse en plataformas como Railway).
- **Instancias cacheadas:** Las instancias del SDK de AFIP se manejan mediante un patrón Singleton por cuenta (`afipInstances`), lo cual evita lecturas innecesarias de certificados y demoras en cada petición.

## 2. Fiabilidad y Tolerancia a Fallos
- **Retry Pattern:** Las llamadas críticas a los servidores de AFIP (`getLastVoucher`, `getVoucherInfo`, `createNextVoucher`) se envuelven en un helper `retryWithBackoff`. Esto es vital dada la conocida inestabilidad de los web services de AFIP.
- **Transacciones Atómicas de Base de Datos:** La creación del registro en la base de datos (`invoice`) y el registro en el historial del cliente (`interaction`) se hacen bajo un `prisma.$transaction`. Si falla la BD, no queda inconsistente.
- **Sistema de Recuperación (Recovery Mechanism):** Antes de solicitar un nuevo CAE, el sistema obtiene el último número de comprobante registrado en AFIP. Si este no se encuentra en la base de datos (por ejemplo, debido a un timeout previo), valida si el monto, tipo de documento y número coinciden con el intento actual. De coincidir, **recupera el CAE existente** sin generar un comprobante duplicado. Esta es una práctica excelente y sumamente defensiva.

## 3. Validaciones de Negocio y Regulatorias
- **Límite Unitario de Monotributo:** El código posee un control estricto que rechaza ítems cuyo precio unitario supere el máximo permitido por la normativa de Monotributo (`UNIT_PRICE_LIMIT = 499000`).
- **Control de Sobre-facturación:** Calcula lo facturado previamente más el monto que se intenta facturar, y comprueba que **no supere el monto total pagado** en la orden (`maximumInvoiceable`). Evita la doble facturación de un mismo saldo.
- **Restricción de Acceso:** La ruta `/api/billing/invoice` controla el rol del usuario, asegurando que solo cuentas con rol `ADMIN` puedan generar facturas.

## 4. Manejo de Comprobantes y PDF
- **Tipo de Comprobante:** Se emiten exclusivamente Facturas C (`CbteTipo: 11`).
- **Composición de Ítems:**
  - Facturación Total: Se envían al PDF los ítems detallados exactos con su descripción de producto, cantidad y precio.
  - Facturación Parcial: Se agrupa en un ítem genérico denominado `"Productos Ópticos — Venta #XXXX"`, lo cual es una estrategia correcta para parciales donde no se discrimina cada ítem.
- **Generación de PDF y QR:** La generación de comprobantes visuales está correctamente estructurada, solicitando primero un PDF a la API del SDK (vía `afip.ElectronicBilling.createPDF`). A la vez, hay un sistema de respaldo (`generateInvoicePDF` en `invoice-generator.ts`) que es capaz de generar Facturas C con formato profesional, que incluye el código QR con el string JSON en formato base64 tal como AFIP lo exige.

## Conclusión
El proceso de facturación electrónica en el sistema es **altamente robusto y fiable**. Presenta salvaguardas avanzadas tanto para prevenir errores de usuario (límites por ítem y prevención de doble facturación) como para contrarrestar problemas de red y tiempos de espera de la API gubernamental (Retry con Backoff y Recuperación de CAE). Está preparado para funcionar eficientemente en producción.
