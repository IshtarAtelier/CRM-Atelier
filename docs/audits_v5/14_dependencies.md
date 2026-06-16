# Auditoría de Dependencias

Se ha revisado el estado de las dependencias definidas en `package.json` y `package-lock.json`. A continuación, el detalle de dependencias obsoletas y el reporte de seguridad (vulnerabilidades).

## 1. Dependencias Obsoletas (Outdated)

Se encontraron múltiples dependencias que no están en su última versión. Algunas de ellas representan cambios mayores (breaking changes) si se actualizan a la versión más reciente (`Latest`).

- **@aws-sdk/client-s3**: `3.1048.0` → `3.1069.0`
- **@aws-sdk/s3-request-presigner**: `3.1048.0` → `3.1069.0`
- **@google/genai**: `2.4.0` → `2.8.0`
- **@langchain/core**: `1.1.48` → `1.1.49`
- **@langchain/langgraph**: `1.3.4` → `1.4.2`
- **@prisma/client**: `5.22.0` → `7.8.0` *(Versión mayor)*
- **@tailwindcss/postcss**: `4.3.0` → `4.3.1`
- **@types/node**: `20.19.41` → `25.9.3` *(Versión mayor)*
- **@types/nodemailer**: `8.0.0` → `8.0.1`
- **@types/react**: `19.2.14` → `19.2.17`
- **axios**: `1.16.1` → `1.18.0`
- **better-sqlite3**: `12.10.0` → `12.11.1`
- **date-fns**: `4.2.1` → `4.4.0`
- **eslint**: `9.39.4` → `10.5.0` *(Versión mayor)*
- **eslint-config-next**: `15.1.11` → `16.2.9` *(Versión mayor)*
- **firebase-admin**: `13.10.0` → `14.0.0` *(Versión mayor)*
- **framer-motion**: `12.38.0` → `12.40.0`
- **googleapis**: `172.0.0` → `173.0.0` *(Versión mayor)*
- **lucide-react**: `0.575.0` → `1.20.0` *(Versión mayor)*
- **next**: `15.1.11` → `16.2.9` *(Versión mayor)*
- **nodemailer**: `8.0.7` → `9.0.0` *(Versión mayor)*
- **openai**: `6.38.0` → `6.42.0`
- **playwright**: `1.60.0` → `1.61.0`
- **prisma**: `5.22.0` → `7.8.0` *(Versión mayor)*
- **react** y **react-dom**: `19.0.0` → `19.2.7`
- **tailwindcss**: `4.3.0` → `4.3.1`
- **typescript**: `5.9.3` → `6.0.3` *(Versión mayor)*
- **zustand**: `5.0.13` → `5.0.14`

---

## 2. Vulnerabilidades (Audit)

Se detectaron **19 vulnerabilidades** en total (1 Crítica, 6 Altas, 12 Moderadas):

### Crítica
- **next** (`9.3.4-canary.0` - `16.3.0-canary.5`): Múltiples vulnerabilidades severas que incluyen Denegación de Servicio (DoS), exposición de información, SSRF, Cross-Site Scripting (XSS), inyección de contenido en la optimización de imágenes y envenenamiento de caché de SSR/Server Components.

### Altas
- **@grpc/grpc-js** (`1.14.0` - `1.14.3`): Riesgo de caída (crash) del servidor debido a mensajes o peticiones malformadas.
- **form-data** (`>=4.0.0 <4.0.6` || `<2.5.6`): Inyección CRLF mediante nombres de archivo y campos sin escapar.
- **protobufjs** (`<=7.6.2`): Problemas con nombres derivados de esquemas y riesgo de DoS al convertir un JSON expansivo.
- **ws** (`8.0.0` - `8.20.1`): Agotamiento de memoria DoS debido al envío de fragmentos de datos muy pequeños y numerosos.
- **xlsx** (`*`): Vulnerabilidades de Prototype Pollution y ReDoS. **No hay parche disponible** en la versión de NPM actual por parte de SheetJS.

### Moderadas
- **dompurify** (`<=3.4.8`): Múltiples problemas relacionados a XSS y vulneración del modo de sanitización `IN_PLACE`.
- **js-yaml** (`<=4.1.1`): Complejidad cuadrática en el merge de alias causando ataques DoS.
- **nodemailer** (`<=8.0.8`): Inyección de cabeceras CRLF en mensajes y problemas validando certificados TLS durante obtención de token OAuth2.
- **postcss** (`<8.5.10`): Vulnerabilidad de XSS al exportar cadenas CSS con etiquetas sin escapar.
- **uuid** (`<11.1.1`): Falta de verificación de límites de buffers en versiones v3, v5 y v6, afectando indirectamente por medio de librerías como `@google-cloud/storage`.

---

## 3. Plan de Acción y Recomendaciones

1. **Aplicar actualizaciones seguras (Menores/Patches)**:
   Ejecutar `npm audit fix` para resolver automáticamente las vulnerabilidades moderadas y altas que tengan parches retrocompatibles disponibles sin introducir *breaking changes*.
2. **Revisión exhaustiva para Next.js y dependencias mayores**:
   Dada la criticidad en `next`, es urgente su actualización. Sin embargo, realizar un `npm audit fix --force` subirá dependencias fuera de sus rangos (por ej. `next` a `15.5.x` o `16.x`), lo cual requerirá validar a fondo la aplicación debido a los cambios estructurales. Se debe hacer lo mismo con dependencias que impactan backend, como `prisma`, `firebase-admin` o `nodemailer`.
3. **Sustitución de dependencias riesgosas (`xlsx`)**:
   La librería `xlsx` (SheetJS) presenta vulnerabilidades de tipo alto y **no tiene corrección (fix) oficial en npm**. Se aconseja eliminar esta dependencia y sustituirla por otra alternativa más segura y activa, como `exceljs` o `node-xlsx`.
