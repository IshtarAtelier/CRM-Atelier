# Auditoría de Confiabilidad: Proceso de Facturación Electrónica (AFIP / ARCA)

## 1. Arquitectura y Configuración
- **SDK Utilizado:** Se usa la librería oficial `@afipsdk/afip.js`.
- **Multicuenta:** Soporte integrado para dos cuentas de facturación simultáneas ('ISH' y 'YANI') con configuración instanciada por entorno.
- **Manejo de Credenciales:** Lectura desde variables de entorno, implementando un parsing robusto para recomponer certificados PEM y Private Keys que pudieran perder su formato de saltos de línea al inyectarse en los proveedores de hosting (como Railway o Vercel).
- **Entornos:** Discriminación automática entre Sandbox y Producción mediante la variable `AFIP_PRODUCTION_MODE`.

## 2. Prevención de Errores y Robustez (Reliability)
El sistema presenta mecanismos avanzados de tolerancia a fallos, demostrando alta confiabilidad:
- **Retry con Exponential Backoff:** Se utiliza una función propia `retryWithBackoff` (hasta 3 reintentos) para llamadas a la API de AFIP (`getLastVoucher`, `getVoucherInfo`, `createNextVoucher`).
- **Short-circuit para errores deterministas:** El algoritmo de reintento se interrumpe inmediatamente si el error es de autenticación, CUIT o Punto de Venta, ahorrando tiempo de procesamiento y evitando bloqueos innecesarios.
- **Mecanismo de Recuperación (Recovery Mechanism):** El sistema verifica si el último comprobante emitido en ARCA coincide con los datos del intento actual (Monto, DNI, Tipo de Documento) pero no está guardado en la base de datos local. Esto evita de forma efectiva la duplicación de facturas en caso de que la conexión TCP se interrumpa justo antes de recibir el código CAE desde AFIP.
- **Validación de Límites Fiscales:** Contiene un bloqueo duro si el monto unitario de algún ítem supera el límite legal de Factura C para monotributistas ($499.000 ARS por ítem).
- **Consistencia de Datos:** La inserción de la factura y la creación del evento de interacción en el historial del cliente se realizan dentro de una transacción atómica de base de datos (`prisma.$transaction`).
- **Prevención de Sobre-facturación Local:** Se verifica la sumatoria de facturas previas contra el total pagado (`PricingService.calculateOrderFinancials`) asegurando matemáticamente que el sistema impida facturar un monto superior al saldo límite real.

## 3. Generación y Almacenamiento de PDFs
- Delega el renderizado al motor de plantillas de AFIP SDK utilizando los parámetros oficiales (formato `invoice-c`).
- Los PDFs resultantes son guardados de forma persistente en un servicio de Storage y se exponen al cliente mediante URLs firmadas de corta duración, garantizando la privacidad de los documentos fiscales.

## 4. Puntos de Mejora y Riesgos Potenciales
1. **Falta de Backoff en Generación de PDF:** El método `afip.ElectronicBilling.createPDF` no está envuelto en el wrapper `retryWithBackoff`. Si la API de plantillas falla por un timeout transitorio, la operación completa arroja error en el último paso (aunque la factura ya haya sido autorizada exitosamente y posea CAE).
2. **Dependencia Externa para PDFs:** Depender del endpoint de una API de terceros (Afip SDK) para compilar los PDFs introduce un punto único de fallo (SPOF) ajeno a los servidores oficiales de AFIP. Sería recomendable contar con un generador local de PDF (fallback) o reintentos asíncronos.
3. **Caché en Memoria (`afipInstances`):** En entornos serverless, las instancias en memoria pueden reciclarse. Aunque su recreación no es un cuello de botella, la reconexión constante podría añadir milisegundos de latencia en "cold starts".

## 5. Conclusión General
El nivel de robustez técnica del módulo de facturación es **Alto**. La implementación táctica del chequeo de recuperación silencioso junto con las transacciones atómicas y los reintentos exponenciales posicionan a este módulo en un **estándar de grado de producción excelente**, ideal para mitigar las conocidas inestabilidades e intermitencias de los WebServices de AFIP/ARCA.
