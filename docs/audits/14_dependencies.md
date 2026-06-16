# Reporte de Auditoría de Dependencias

Este documento detalla el estado actual de las dependencias en `package.json` y `package-lock.json`, cubriendo vulnerabilidades de seguridad, dependencias obsoletas y paquetes duplicados o mal estructurados.

## 1. Vulnerabilidades de Seguridad (`npm audit`)
Se encontraron un total de **20 vulnerabilidades** (1 crítica, 7 altas, 12 moderadas):

*   **Next.js (Crítica y Altas):** Versiones menores a 15.5.19 (dependiendo del rango) sufren múltiples vulnerabilidades que incluyen DoS, SSRF, inyección de contenido y exposición de información.
*   **xlsx (Alta):** Vulnerabilidad de "Prototype Pollution" y DoS mediante RegEx. No hay solución disponible actualmente (se recomienda considerar alternativas a sheetjs/xlsx).
*   **DOMPurify (Alta):** Múltiples bypasses de sanitización que podrían derivar en XSS.
*   **ws (Alta):** Riesgo de DoS por agotamiento de memoria.
*   **form-data (Alta):** Inyección CRLF.
*   **protobufjs (Alta):** Denegación de servicio a través de expansiones unbounded y property shadowing.
*   **Moderadas:** Existen reportes para `nodemailer`, `uuid`, `postcss` y `js-yaml`.

**Recomendación:** Ejecutar `npm audit fix` para resolver los problemas menores y actualizar Next.js a una versión segura (requerirá probar compatibilidad). Considerar migrar de `xlsx` a otra biblioteca si se requiere máxima seguridad.

## 2. Dependencias Obsoletas (`npm outdated`)
Existen diversas dependencias que tienen versiones más recientes disponibles, de las cuales se destacan algunas actualizaciones mayores (breaking changes):

*   `@prisma/client` & `prisma`: 5.22.0 → **7.8.0** (Actualización Mayor)
*   `@types/node`: 20.19.41 → **25.9.3** (Actualización Mayor)
*   `eslint` & `eslint-config-next`: 9.39.4 / 15.1.11 → **10.5.0 / 16.2.9** (Actualizaciones Mayores)
*   `firebase-admin`: 13.10.0 → **14.0.0** (Actualización Mayor)
*   `nodemailer`: 8.0.7 → **9.0.0** (Actualización Mayor)
*   `typescript`: 5.9.3 → **6.0.3** (Actualización Mayor)
*   `next`: 15.1.11 → **16.2.9** (Actualización Mayor)
*   `react` & `react-dom`: 19.0.0 → **19.2.7** (Actualización Menor)

**Recomendación:** Se sugiere actualizar de manera incremental. Las actualizaciones mayores (como Prisma 7, Next 16 o Firebase 14) deben realizarse verificando las guías de migración de cada paquete debido a los cambios incompatibles.

## 3. Duplicados y Estructura en `package.json`

### Paquetes anidados duplicados
Al correr `npm dedupe --dry-run` se identificó que **12 paquetes anidados** pueden ser dedupicados, optimizando así la estructura en `package-lock.json` y el tamaño de `node_modules` (ej. `form-data`, `semver`, `gaxios`, `postcss`).

### Organización del `package.json`
Existen dependencias mal categorizadas que deberían moverse a `devDependencies`:
*   `@types/nodemailer`: Actualmente en dependencias de producción.
*   `@types/qrcode`: Actualmente en dependencias de producción.
*   `prisma`: El CLI de prisma debería residir en `devDependencies` para no ser empaquetado en producción (solo `@prisma/client` pertenece a `dependencies`).

**Recomendación:** 
1. Ejecutar `npm dedupe` para reducir duplicados en el `package-lock.json`.
2. Mover los `@types/*` y el CLI de `prisma` a `devDependencies`.
